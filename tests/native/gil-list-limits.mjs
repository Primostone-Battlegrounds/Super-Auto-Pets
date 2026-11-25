import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const listLimit = 100;

function violation(graphId, name, length) {
  return `graph ${graphId}, ${name}: actual length ${length}, limit ${listLimit}`;
}

export function assertListCapacity(graphId, name, length) {
  if (length > listLimit) assert.fail(violation(graphId, name, length));
}

// Uses the same decoder and graph index as the pinned GIL inspector. Scan the
// emitted graph values and node pins, including values nested in dictionaries.
export async function gilListAudit(requireTool) {
  const load = name => import(pathToFileURL(requireTool.resolve(`genshin-ts/injector/${name}`)).href);
  const [{ parseMessage, readUint32BE }, { buildNodeGraphFieldIndex, isClientGraphType }, { loadGiaProto }]
    = await Promise.all([load('binary'), load('node_graph'), load('proto')]);
  const { nodeGraphMessage } = loadGiaProto();
  return bytes => {
    assert.ok(bytes.length >= 24 && readUint32BE(bytes, 8) === 0x326
      && readUint32BE(bytes, bytes.length - 4) === 0x679
      && readUint32BE(bytes, 16) === bytes.length - 24, 'Invalid GIL envelope');
    const payload = bytes.subarray(20, -4);
    const fields = [];
    parseMessage(payload, 0, payload.length, 0, 0, 0, 0, 0, 0, 0, fields);
    const reports = [];
    const failures = [];
    for (const [id, matches] of buildNodeGraphFieldIndex(payload, fields)) {
      for (const { field, type } of matches) {
        if (isClientGraphType(type)) continue;
        const graph = nodeGraphMessage.decode(payload.subarray(field.dataStart, field.dataEnd));
        const { report, violations } = inspectGraphLists(id, graph);
        reports.push(report);
        failures.push(...violations);
      }
    }
    assert.ok(reports.length > 0, 'GIL contains no decoded server graphs');
    assert.ok(failures.length === 0, `Server GIL list capacity exceeded:\n${failures.join('\n')}`);
    return reports;
  };
}

function inspectGraphLists(id, graph) {
  const report = { id, defaults: { count: 0, max: 0 }, parameters: { count: 0, max: 0 },
    assemblies: { count: 0, max: 0 } };
  const violations = [];
  function record(kind, name, length) {
    report[kind].count += 1;
    report[kind].max = Math.max(report[kind].max, length);
    if (length > listLimit) violations.push(violation(id, name, length));
  }
  function visit(kind, name, value) {
    if (value?.bArray) {
      const items = value.bArray.entries ?? [];
      record(kind, name, items.length);
      items.forEach((item, index) => visit(kind, `${name}[${index}]`, item));
    }
    if (value?.bConcreteValue?.value) visit(kind, name, value.bConcreteValue.value);
    value?.bStruct?.items?.forEach((item, index) => visit(kind, `${name}.field[${index}]`, item));
    value?.bMap?.mapPairs?.forEach((pair, index) => visit(kind, `${name}.pair[${index}]`, pair));
    if (value?.bMapPair?.key) visit(kind, `${name}.key`, value.bMapPair.key);
    if (value?.bMapPair?.value) visit(kind, `${name}.value`, value.bMapPair.value);
  }
  for (const variable of graph.graphValues ?? []) {
    visit('defaults', `variable ${variable.name}`, variable.values);
  }
  for (const node of graph.nodes ?? []) {
    const label = `node ${node.nodeIndex}`;
    for (const pin of node.pins ?? []) {
      visit('parameters', `${label} pin ${pin.i1?.kind ?? 0}/${pin.i1?.index ?? 0}`, pin.value);
    }
    // The server assembly_list node stores the element count in input pin 0.
    // It has 100 element slots even when only a few are populated.
    if (node.genericId?.nodeId === 169) {
      const count = node.pins.find(pin => pin.i1?.kind === 3 && pin.i1.index === 0)?.value?.bInt?.val;
      assert.ok(Number.isInteger(count) && count >= 0, `graph ${id}, ${label}: missing assemblyList count`);
      record('assemblies', `${label} assemblyList`, count);
    }
  }
  return { report, violations };
}

// The pinned compiler rejects overlong assemblyList literals before it emits
// a GIL. Report their exact location and length before invoking the compiler.
export function assertAssemblySourceLimits(id, code, ts) {
  const source = ts.createSourceFile('graph.ts', code, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'assemblyList' && node.arguments.length > 0
        && ts.isArrayLiteralExpression(node.arguments[0])) {
      const declaration = ts.isVariableDeclaration(node.parent) ? ` ${node.parent.name.getText(source)}` : '';
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      assertListCapacity(id, `assemblyList${declaration} at line ${line}`, node.arguments[0].elements.length);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

export function checkRuntimeListCall(id, method, call, args) {
  const name = (method === 'get' || method === 'set') ? `variable ${args[0]}` : method;
  const check = (value, label) => {
    if (Array.isArray(value) && value.length > listLimit) assertListCapacity(id, `runtime ${name} ${label}`, value.length);
  };
  args.forEach((arg, index) => check(arg, `argument ${index + 1}`));
  const result = call(...args);
  check(result, 'result');
  // In-place operations may exceed capacity transiently before their caller
  // removes an element. Check them here, before the next native API call.
  if (Array.isArray(args[0])) check(args[0], 'argument 1');
  return result;
}
