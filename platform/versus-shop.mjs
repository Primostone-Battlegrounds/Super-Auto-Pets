import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function shopExport(executable, kind, profile = 'compatibility') {
  return execFileSync(executable, ['-E', 'platform/versus_shop_data.lua', kind, profile], {
    cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
  });
}

export function nativeShop(lua, lua54 = 'lua5.4', profile = 'compatibility') {
  const definition = shopExport(lua, 'catalog', profile);
  assert.equal(shopExport(lua54, 'catalog', profile), definition);
  let source = fs.readFileSync(new URL('./versus_shop.ts', import.meta.url), 'utf8');
  const start = [];
  let levelThresholds;
  let petTierCounts;
  const catalog = { pet: [], food: [] };
  const rules = {};
  const ints = values => {
    assert.ok(values.every(value => /^-?\d+$/.test(value)), 'native shop export requires integers');
    return values.map(BigInt);
  };
  for (const line of definition.trimEnd().split('\n')) {
    const [kind, key, ...values] = line.split('\t');
    if (kind === 'const' || kind === 'list') {
      const marker = `AP_SHOP_${key}`;
      const numbers = ints(values);
      const literals = numbers.map(value => `${value}n`).join(', ');
      const placeholder = kind === 'const' ? `0n; // ${marker}` : `[0n], 'int'); // ${marker}`;
      const replacement = kind === 'const' ? `${literals};` : `[${literals}], 'int');`;
      assert.ok(source.includes(placeholder), `missing marker ${marker}`);
      source = source.replace(placeholder, replacement);
      if (kind === 'const') rules[key] = Number(values[0]);
      if (key === 'LEVEL_THRESHOLDS') levelThresholds = numbers.map(Number);
      if (key === 'PET_LIMITS') petTierCounts = numbers.slice(1).map((limit, index) => Number(limit - numbers[index]));
    } else if (kind === 'start') {
      assert.equal(Number(key), start.length + 1);
      start.push(ints(values));
    } else {
      assert.ok(kind === 'pet' || kind === 'food');
      assert.equal(Number(key), catalog[kind].length + 1);
      const [name, attack, health] = values;
      assert.ok(name);
      ints([attack, health]);
      catalog[kind].push({ name, attack: Number(attack), health: Number(health) });
    }
  }
  assert.doesNotMatch(source, /\/\/ AP_SHOP_/);
  assert.equal(start.length, 2);
  const packedSize = 6 + rules.PET_SLOTS + rules.FOOD_SLOTS + rules.TEAM_SIZE * 6;
  assert.ok(start.every(seat => seat.length === packedSize));
  return { source, start, catalog, rules, definition, levelThresholds, petTierCounts };
}
