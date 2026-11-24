import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lowerCombatMath } from './m3_collision_lower.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function catalog(lua53, lua54, profile) {
  const extract = lua => execFileSync(lua, ['-E', 'platform/m3_battle_opening_data.lua', profile], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
  });
  const definition = extract(lua53);
  assert.equal(definition, extract(lua54));
  const openingMetadata = [];
  const faintMetadata = [];
  const ids = [];
  for (const line of definition.trimEnd().split('\n')) {
    const [id, ...numbers] = line.split('\t');
    assert.ok(id && numbers.length === 8);
    const values = numbers.map(BigInt);
    ids.push(id);
    openingMetadata.push(...values.slice(0, 3));
    faintMetadata.push(...values.slice(3));
  }
  return { ids, openingMetadata, faintMetadata };
}

function combatMath(parse) {
  return lowerCombatMath(fs.readFileSync(new URL('../src/autopets/battle.lua', import.meta.url), 'utf8'), parse);
}

function openingSource(math) {
  const source = fs.readFileSync(new URL('./m3_battle_opening.ts', import.meta.url), 'utf8')
    .replace('// AP_OPENING_DAMAGE', math.damageCode)
    .replace('// AP_OPENING_BUFF', math.buffCode)
    .replace('// AP_OPENING_SUMMON', math.summonCode);
  assert.doesNotMatch(source, /\/\/ AP_OPENING_/);
  return source;
}

export function nativeBattleOpening(lua53, lua54, parse, profile = 'compatibility') {
  const { openingMetadata } = catalog(lua53, lua54, profile);
  return { source: openingSource(combatMath(parse)), metadata: openingMetadata };
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
  return { source: collision + '\n' + openingSource(math), strikeLimit: math.strikeLimit, ...data };
}
