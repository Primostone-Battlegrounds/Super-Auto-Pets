import assert from 'node:assert/strict';

// Lower arithmetic from the actual battle.lua AST. The native sample owns
// only the bounded scheduler and its packed board representation.
export function lowerCombatMath(luaSource, parse) {
  const { body } = parse(luaSource, { luaVersion: '5.3' });
  function member(node) {
    if (node?.type === 'Identifier') return node.name;
    assert.ok(node?.type === 'MemberExpression' && node.indexer === '.', 'Expected named battle field');
    return member(node.base) + '.' + node.identifier.name;
  }
  const fields = new Map([
    ['target.shield', 'targetShield'], ['target.health', 'targetHealth'], ['target.max_health', 'targetMaxHealth'],
    ['ability.power', 'power'], ['unit.level', 'level'], ['token.attack', 'tokenAttack'],
    // Miliastra node integers are signed 32-bit.
    ['math.maxinteger', '2147483647n'],
    ['data.rules.team_size', 'battleSlots'], ['state.catalog.rules.team_size', 'battleSlots'],
  ]);
  function expression(node, locals) {
    if (node.type === 'Identifier' && locals.has(node.name)) return node.name;
    if (node.type === 'NumericLiteral' && Number.isSafeInteger(node.value)) return `${node.value}n`;
    if (node.type === 'MemberExpression') {
      const name = fields.get(member(node));
      assert.ok(name, 'Unsupported battle field');
      return name;
    }
    if (node.type === 'UnaryExpression' && node.operator === '#' && node.argument.name === 'team') return 'size';
    if (node.type === 'BinaryExpression' && ['-', '+', '*'].includes(node.operator)) {
      return `(${expression(node.left, locals)} ${node.operator} ${expression(node.right, locals)})`;
    }
    if (node.type === 'CallExpression' && node.arguments.length === 2) {
      const method = { 'math.min': 'takeSmallerValue', 'math.max': 'takeLargerValue' }[member(node.base)];
      assert.ok(method, 'Unsupported battle arithmetic helper');
      return `f.${method}(${node.arguments.map(argument => expression(argument, locals)).join(', ')})`;
    }
    throw new Error(`Unsupported battle expression: ${node.type}`);
  }
  function compileAssignments(items, names, locals) {
    return names.map((name, index) => {
      const statement = items[index];
      assert.ok(statement?.variables?.length === 1 && statement?.init?.length === 1, 'Expected single assignment');
      const right = expression(statement.init[0], locals);
      if (statement.type === 'LocalStatement') {
        assert.equal(statement.variables[0].name, name);
        locals.add(name);
        return `const ${name} = ${right};`;
      }
      assert.equal(statement.type, 'AssignmentStatement');
      assert.equal(fields.get(member(statement.variables[0])), name);
      return `${name} = ${right};`;
    }).join('\n    ');
  }
  function findFunction(name) {
    const unit = body.find(node => node.type === 'FunctionDeclaration' && node.identifier && member(node.identifier) === name);
    assert.ok(unit, `Missing battle function: ${name}`);
    return unit;
  }

  const damage = findFunction('damage');
  assert.deepEqual(damage.parameters.map(parameter => parameter.name), ['state', 'source', 'target', 'amount']);
  const damageCode = compileAssignments(damage.body, ['absorbed', 'remaining', 'targetShield', 'targetHealth'], new Set(['amount']));
  const emitsDamage = damage.body.slice(4).some(node => node.type === 'CallStatement'
    && node.expression.base.name === 'emit' && /^(['"])damage\1$/.test(node.expression.arguments[1]?.raw));
  assert.ok(emitsDamage, 'Expected damage event after arithmetic');

  const buff = findFunction('effects.buff_front');
  const targetCheck = buff.body.find(node => node.type === 'IfStatement' && node.clauses[0]?.condition?.name === 'target');
  assert.ok(targetCheck, 'Expected buff of a living front');
  const buffCode = compileAssignments(targetCheck.clauses[0].body, ['amount', 'targetHealth', 'targetMaxHealth'], new Set());

  const summon = findFunction('effects.summon');
  const count = summon.body.find(node => node.type === 'LocalStatement' && node.variables[0]?.name === 'count');
  const generate = summon.body.find(node => node.type === 'ForNumericStatement');
  const summoned = generate?.body.find(node => node.type === 'LocalStatement' && node.variables[0]?.name === 'summon');
  const attack = summoned?.init[0]?.fields.find(field => field.key?.name === 'attack');
  assert.ok(count && attack, 'Expected summon limit and attack');
  const summonCode = [
    `const count = ${expression(count.init[0], new Set())};`,
    `const summonAttack = ${expression(attack.value, new Set())};`,
  ].join('\n      ');

  const limit = body.find(node => node.type === 'LocalStatement' && node.variables[0]?.name === 'strike_limit');
  assert.ok(limit?.init[0]?.type === 'NumericLiteral' && Number.isSafeInteger(limit.init[0].value)
    && limit.init[0].value > 0, 'Expected a positive integer strike limit');
  return { damageCode, buffCode, summonCode, strikeLimit: limit.init[0].value };
}
