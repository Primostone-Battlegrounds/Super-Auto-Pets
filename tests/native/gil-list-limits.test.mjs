import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { assertAssemblySourceLimits, checkRuntimeListCall, gilListAudit } from './gil-list-limits.mjs';

const checkout = process.env.MILIASTRA_MCP_CHECKOUT;
assert.ok(checkout, 'Set MILIASTRA_MCP_CHECKOUT to the pinned MCP checkout');
const requireTool = createRequire(path.join(fs.realpathSync(checkout), 'package.json'));
const load = name => import(pathToFileURL(requireTool.resolve(`genshin-ts/injector/${name}`)).href);
const [{ buildFile, encodeVarint }, { loadGiaProto }, audit] = await Promise.all([
  load('binary'), load('proto'), gilListAudit(requireTool),
]);
const { nodeGraphMessage } = loadGiaProto();
const ts = requireTool('typescript');

const firstId = 1073741827;
const secondId = 1073741829;
const envelope = { schema: 1, headTag: 0x326, fileType: 1, tailTag: 0x679 };
const message = (tag, bytes) => Buffer.concat([encodeVarint(tag * 8 + 2), encodeVarint(bytes.length), bytes]);
const gil = (...graphs) => buildFile(message(10, message(1, Buffer.concat(graphs.map(graph =>
  message(1, nodeGraphMessage.encode(graph).finish()))))), envelope);
const list = length => ({ class: 10002, bArray: { entries: Array.from({ length }, () => ({ class: 2, bInt: { val: 0 } })) } });
const graph = (id, values = [], nodes = []) => ({ id: { id, type: 20000, kind: 21001 }, graphValues: values, nodes });

function boundary(check, length, error) {
  if (length <= 100) assert.doesNotThrow(check);
  else assert.throws(check, error);
}

for (const length of [99, 100, 101, 115]) {
  const capacityError = new RegExp(`actual length ${length}, limit 100`);
  test(`saved graph defaults at ${length}`, () => {
    const input = gil(graph(firstId, [{ name: 'fainting', type: 8, values: list(length) }]),
      graph(secondId, [{ name: 'petEffects', type: 8, values: list(length) }]));
    boundary(() => audit(input), length, new RegExp(
      `graph ${firstId}, variable fainting: ${capacityError.source}\\n` +
      `graph ${secondId}, variable petEffects: ${capacityError.source}`));
    if (length <= 100) assert.deepEqual(audit(input).map(row => row.defaults.max), [length, length]);
  });

  test(`wrapped list pin and dictionary value at ${length}`, () => {
    const nested = { class: 10003, bMap: { mapPairs: [{ class: 10007, bMapPair: {
      key: { class: 2, bInt: { val: 1 } }, value: list(length),
    } }] } };
    const input = gil(graph(firstId, [{ name: 'stocks', type: 27, values: nested }], [
      { nodeIndex: 31, pins: [{ i1: { kind: 3, index: 2 }, type: 8,
        value: { class: 10000, bConcreteValue: { value: list(length) } } }] },
    ]));
    boundary(() => audit(input), length, new RegExp(
      `graph ${firstId}, variable stocks\\.pair\\[0\\]\\.value: ${capacityError.source}\\n` +
      `graph ${firstId}, node 31 pin 3/2: ${capacityError.source}`));
    if (length <= 100) assert.equal(audit(input)[0].parameters.max, length);
  });

  test(`assembly list at ${length}`, () => {
    const input = gil(graph(firstId, [], [{ nodeIndex: 23, genericId: { nodeId: 169 }, pins: [
      { i1: { kind: 3, index: 0 }, value: { class: 2, bInt: { val: length } } },
      ...Array.from({ length: 100 }, (_, index) => ({ i1: { kind: 3, index: index + 1 } })),
    ] }]));
    const code = `const board = f.assemblyList([${Array(length).fill('0n').join(', ')}], 'int');`;
    boundary(() => audit(input), length, new RegExp(`graph ${firstId}, node 23 assemblyList: ${capacityError.source}`));
    boundary(() => assertAssemblySourceLimits(firstId, code, ts), length,
      new RegExp(`graph ${firstId}, assemblyList board at line 1: ${capacityError.source}`));
    if (length <= 100) assert.equal(audit(input)[0].assemblies.max, length);
  });

  test(`runtime list growth at ${length}`, () => {
    const stock = Array(length - 16).fill(0n);
    const append = (list, tail) => { list.push(...tail); };
    const tail = Array(16).fill(0n);
    boundary(() => checkRuntimeListCall(firstId, 'concatenateList', append, [stock, tail]), length,
      new RegExp(`graph ${firstId}, runtime concatenateList argument 1: ${capacityError.source}`));
  });
}

test('transient insertion fails before removal can bring the list back to 100', () => {
  const stock = Array(100).fill(0n);
  const insert = list => { list.splice(0, 0, 1n); };
  assert.throws(() => checkRuntimeListCall(firstId, 'insertValueIntoList', insert, [stock]),
    /graph 1073741827, runtime insertValueIntoList argument 1: actual length 101, limit 100/);
});
