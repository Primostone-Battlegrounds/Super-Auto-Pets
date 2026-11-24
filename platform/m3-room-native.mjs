import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nativeBattle } from './m3-battle-opening.mjs';
import { nativeShop } from './versus-shop.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const declarations = read('./m3_room_signals.ts');
const types = { int: 'integer', int_list: 'integerList', bool: 'boolean' };
export const roomSignals = {};
for (const [, tagged, body] of declarations.matchAll(/defineSignal\('([^']+)', \[(.*?)\] as const\)/gs)) {
  const name = tagged.replace(/^client:/, '');
  const fields = [...body.matchAll(/\['([^']+)', '([^']+)'\]/g)]
    .filter(([, field, type]) => field !== 'player' || type !== 'entity')
    .map(([, field, type]) => ({ name: field, type: types[type] }));
  assert.ok(fields.length && fields.every(field => field.type));
  roomSignals[name] = fields;
}
assert.equal(Object.keys(roomSignals).length, 6);

function replace(source, marker, value) {
  assert.ok(source.includes(marker), `Missing graph template marker: ${marker}`);
  return source.replace(marker, value);
}

const literals = values => values.map(value => `${value}n`).join(', ');
const setList = (source, marker, values) =>
  replace(source, `[0n]), // AP_ROOM_${marker}`, `[${literals(values)}]),`);
const initialize = (source, marker, length) =>
  replace(source, `[0n], 'int'); // AP_ROOM_${marker}`, `[${literals(Array(length).fill(0))}], 'int');`);

export function nativeRoom(lua53, lua54, parse, roomId, fightId, seed, cadence = 1, wait) {
  assert.ok(Number.isInteger(cadence) && cadence >= 1 && cadence <= 3, 'Cadence must be 1–3 seconds');
  assert.ok(wait === undefined || Number.isInteger(wait) && wait >= 0 && wait <= 60, 'Room wait must be 0–60 seconds');
  const sources = executable => execFileSync(executable, ['-E', 'platform/m3_room_data.lua', String(seed)], {
    cwd: project, timeout: 30_000, encoding: 'utf8',
  });
  const configuration = sources(lua53);
  assert.equal(configuration, sources(lua54));
  const shop = nativeShop(lua53, lua54);
  const battle = nativeBattle(lua53, lua54, parse);
  const settings = {};
  const seeds = [];
  const ranks = [];
  const names = new Map();
  let random;
  for (const row of configuration.trimEnd().split('\n')) {
    const [kind, key, ...fields] = row.split('\t');
    assert.ok(fields.slice(kind === 'pet' ? 1 : 0).every(field => /^\d+$/.test(field)));
    if (kind === 'config') {
      assert.match(key, /^[A-Z_]+$/);
      assert.equal(fields.length, 1);
      settings[key] = Number(fields[0]);
    } else if (kind === 'random') {
      random = [key, ...fields].map(BigInt);
    } else if (kind === 'seat') {
      assert.equal(Number(key), seeds.length + 1);
      assert.equal(fields.length, 2);
      seeds.push(BigInt(fields[0]));
      ranks.push(BigInt(fields[1]));
    } else {
      assert.equal(kind, 'pet');
      assert.equal(fields.length, 1);
      assert.ok(fields[0] && !names.has(key));
      names.set(key, fields[0]);
    }
  }
  if (wait !== undefined) settings.WAIT = wait;
  assert.ok(seeds.length === 8 && new Set(ranks).size === 8 && random?.length === 2);
  assert.ok(names.size === battle.ids.length && battle.ids.every(id => names.has(id)));
  const battleCatalog = battle.ids.map(id => ({ name: names.get(id) }));
  let room = replace(read('./m3_room.ts'), 'id: 1073741825,', `id: ${roomId},`);
  for (const [name, value] of Object.entries(settings)) {
    room = replace(room, new RegExp(`[0-9]+n; // AP_ROOM_${name}\\b`).exec(room)[0], `${value}n;`);
  }
  room = replace(room, '1; // AP_ROOM_CADENCE', `${cadence};`);
  room = replace(room, '2n; // AP_ROOM_REPLY_WAIT', `${2 * cadence}n;`);
  settings.CADENCE = cadence;
  room = setList(room, 'TABLE', Array(72).fill(0));
  room = setList(room, 'PRIORITY', ranks);
  room = setList(room, 'SEEDS', seeds);
  room = setList(room, 'RANDOM', random);
  room = initialize(room, 'EMPTY_STOCK', 6 + shop.rules.PET_SLOTS + shop.rules.FOOD_SLOTS + 6 * shop.rules.TEAM_SIZE);
  let fight = replace(read('./m3_room_fight.ts'), 'id: 1073741826,', `id: ${fightId},`);
  fight = setList(fight, 'EFFECTS', battle.faintMetadata);
  fight = setList(fight, 'START_EFFECTS', battle.openingMetadata);
  fight = initialize(fight, 'BOARD', 12 * shop.rules.TEAM_SIZE + 6);
  assert.doesNotMatch(room + fight, /\/\/ AP_ROOM_/);
  return {
    roomSource: [shop.source, declarations, room].join('\n'),
    fightSource: [shop.source, battle.source, declarations, fight].join('\n'),
    configuration, shopCatalog: { ...shop.catalog, battle: battleCatalog }, settings,
  };
}
