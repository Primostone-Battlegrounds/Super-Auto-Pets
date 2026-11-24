import assert from 'node:assert/strict';

// Lower the arithmetic prefix of the real Lua damage function. Any change
// outside this small subset fails the build until the experiment is updated.
export function lowerDamage(luaSource, parse) {
  const { body } = parse(luaSource, { luaVersion: '5.3' });
  const kernel = body.find(node => node.type === 'FunctionDeclaration' && node.identifier?.name === 'damage');
  assert.ok(kernel, 'The battle damage function is missing');
  assert.deepEqual(kernel.parameters.map(parameter => parameter.name), ['state', 'source', 'target', 'amount']);
  const field = node => {
    assert.ok(node.type === 'MemberExpression' && node.indexer === '.' && node.base.name === 'target');
    return { shield: 'targetShield', health: 'targetHealth' }[node.identifier.name];
  };
  const locals = new Set(['amount']);
  function expression(node) {
    if (node.type === 'Identifier' && locals.has(node.name)) return node.name;
    if (node.type === 'NumericLiteral' && Number.isSafeInteger(node.value)) return `${node.value}n`;
    if (node.type === 'MemberExpression') {
      const name = field(node);
      assert.ok(name, 'Unsupported damage field');
      return name;
    }
    if (node.type === 'BinaryExpression' && node.operator === '-') {
      return `(${expression(node.left)} - ${expression(node.right)})`;
    }
    if (node.type === 'CallExpression' && node.base.type === 'MemberExpression' && node.base.base.name === 'math'
        && node.arguments.length === 2) {
      const method = { min: 'takeSmallerValue', max: 'takeLargerValue' }[node.base.identifier.name];
      assert.ok(method, 'Unsupported damage helper');
      return `f.${method}(${node.arguments.map(expression).join(', ')})`;
    }
    throw new Error(`Unsupported damage expression: ${node.type}`);
  }
  const result = [];
  for (const [index, name] of ['absorbed', 'remaining', 'targetShield', 'targetHealth'].entries()) {
    const statement = kernel.body[index];
    assert.equal(statement.variables.length, 1);
    assert.equal(statement.init.length, 1);
    const right = expression(statement.init[0]);
    if (index < 2) {
      assert.equal(statement.type, 'LocalStatement');
      assert.equal(statement.variables[0].name, name);
      locals.add(name);
      result.push(`const ${name} = ${right};`);
    } else {
      assert.equal(statement.type, 'AssignmentStatement');
      assert.equal(field(statement.variables[0]), name);
      result.push(`${name} = ${right};`);
    }
  }
  const emitsDamage = kernel.body.slice(result.length).some(node => node.type === 'CallStatement'
    && node.expression.base.name === 'emit' && /^(['"])damage\1$/.test(node.expression.arguments[1]?.raw));
  assert.ok(emitsDamage, 'Expected damage event after arithmetic');
  const limit = body.find(node => node.type === 'LocalStatement' && node.variables[0]?.name === 'strike_limit');
  assert.ok(limit?.init[0]?.type === 'NumericLiteral' && Number.isSafeInteger(limit.init[0].value)
    && limit.init[0].value > 0, 'Expected a positive integer strike limit');
  return { statements: result.join('\n    '), strikeLimit: limit.init[0].value };
}
