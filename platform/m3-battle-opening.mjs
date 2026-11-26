import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lowerCombatMath } from './m3_collision_lower.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// Column order matches the fields exported by Lua. Each column is indexed by
// battle code minus one and occupies its own bounded native list.
const openingFields = ['openingEffect', 'openingPower', 'openingTargets'];
const faintFields = ['faintEffect', 'faintPower', 'faintTarget', 'faintAttack', 'faintHealth'];

function columnize(rows, fields) {
  assert.ok(rows.every(row => row.length === fields.length));
  return Object.fromEntries(fields.map((name, index) => [name, rows.map(row => row[index])]));
}

export const faintColumns = rows => columnize(rows, faintFields);
export const openingColumns = rows => columnize(rows, openingFields);

function bindColumns(source, columns, marker) {
  const defaults = `// AP_${marker}_DEFAULTS`;
  const reads = `// AP_${marker}_READS`;
  assert.ok(source.includes(defaults) && source.includes(reads));
  return source.replace(defaults, Object.keys(columns).map(name =>
    `${name}: [${columns[name].map(value => `${value}n`).join(', ')}],`).join('\n    '))
    .replace(reads, Object.keys(columns).map(name => `const ${name} = f.get('${name}');`).join('\n  '));
}

export const bindFaintColumns = (source, columns) => bindColumns(source, columns, 'FAINT');
export const bindOpeningColumns = (source, columns) => bindColumns(source, columns, 'OPENING');
export const faintArguments = faintFields.join(', ');
export const openingArguments = openingFields.join(', ');

function catalog(lua53, lua54, profile) {
  const extract = lua => execFileSync(lua, ['-E', 'platform/m3_battle_opening_data.lua', profile], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
  });
  const definition = extract(lua53);
  assert.equal(definition, extract(lua54));
  const openingRows = [];
  const faintRows = [];
  const ids = [];
  for (const line of definition.trimEnd().split('\n')) {
    const [id, ...numbers] = line.split('\t');
    assert.ok(id && numbers.length === 8);
    const values = numbers.map(BigInt);
    ids.push(id);
    openingRows.push(values.slice(0, openingFields.length));
    faintRows.push(values.slice(openingFields.length));
  }
  return { ids, openingMetadata: openingColumns(openingRows), faintMetadata: faintColumns(faintRows) };
}

function combatMath(parse) {
  return lowerCombatMath(fs.readFileSync(new URL('../src/autopets/battle.lua', import.meta.url), 'utf8'), parse);
}

function openingSource(math, profile) {
  const release = profile === 'release';
  const source = fs.readFileSync(new URL('./m3_battle_opening.ts', import.meta.url), 'utf8')
    .replace(' /* AP_OPENING_HURT */', release ? ', 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n' : '')
    .replace('false /* AP_OPENING_HURT_CHECK */', release
      ? 'remaining > 0n && f.getCorrespondingValueFromList(openingEffect, code - 1n) === 5n' : 'false')
    .replace(/^ *\/\/ AP_REACTIVE_BEGIN\n([\s\S]*?)^ *\/\/ AP_REACTIVE_END\n/gm, (_, body) => release ? body : '')
    .replace('// AP_OPENING_DAMAGE', math.damageCode)
    .replace('// AP_OPENING_BUFF', math.buffCode)
    .replace('// AP_OPENING_SUMMON', math.summonCode)
    .replace('// AP_OPENING_RALLY', math.rallyCode);
  assert.doesNotMatch(source, /\/\/ AP_OPENING_/);
  return source;
}

export function nativeBattleOpening(lua53, lua54, parse, profile = 'compatibility') {
  const { openingMetadata } = catalog(lua53, lua54, profile);
  return { source: openingSource(combatMath(parse), profile), metadata: openingMetadata };
}

// Append the shared battle code to nativeShop source, which supplies its
// signed-range Park–Miller draw and the common execution-flow type import.
export function nativeBattle(lua53, lua54, parse, profile = 'compatibility') {
  const data = catalog(lua53, lua54, profile);
  const math = combatMath(parse);
  const collision = fs.readFileSync(new URL('./m3_battle_step.ts', import.meta.url), 'utf8')
    .replace(/^import type \{ ServerExecutionFlowFunctionsByMode \}.*\n/m, '')
    .replace('0n; // AP_STRIKE_LIMIT', `${math.strikeLimit}n;`)
    .replace('// AP_LOWERED_DAMAGE', math.damageCode)
    .replace('// AP_LOWERED_BUFF', math.buffCode)
    .replace('// AP_LOWERED_SUMMON', math.summonCode);
  assert.doesNotMatch(collision, /\/\/ AP_/);
  const release = profile === 'release';
  const reactions = release ? fs.readFileSync(new URL('./m3_battle_release_step.ts', import.meta.url), 'utf8') : '';
  const source = [collision, openingSource(math, profile), reactions].join('\n');
  return {
    source,
    strikeLimit: math.strikeLimit,
    collisionFunction: release ? 'gstsServerReleaseCollisionStep' : 'gstsServerCollisionStep',
    ...data,
  };
}
