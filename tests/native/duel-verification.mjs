import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function duelFixture(lua, lua54, project, profile) {
  const exportShop = executable => execFileSync(executable, ['-E', 'platform/m2_shop_data.lua', profile], {
    cwd: project, encoding: 'utf8', timeout: 10_000,
  });
  const shopData = exportShop(lua);
  assert.equal(exportShop(lua54), shopData);
  const catalog = [];
  const shelves = [];
  let startingLives;
  let shopFixture;
  for (const line of shopData.trimEnd().split('\n')) {
    const [kind, ...fields] = line.split('\t');
    if (kind === 'config') {
      const [gold, price, teamSize, offerSlots] = fields.map(Number);
      assert.equal(fields.length, 4);
      assert.ok([gold, price, teamSize, offerSlots].every(value => Number.isSafeInteger(value) && value > 0));
      assert.equal(teamSize, 5, 'The existing UI has five team slots');
      assert.equal(offerSlots, 3, 'The existing UI has three pet offers');
      shopFixture = { gold, price, teamSize, offerSlots, shelves };
    } else if (kind === 'pet') {
      const [code, id, name, attack, health, tier] = fields;
      assert.equal(Number(code), catalog.length + 1);
      assert.ok(/^[a-z0-9_]+$/.test(id) && name && /^\d+$/.test(attack) && /^\d+$/.test(health));
      assert.ok(/^\d+$/.test(tier));
      catalog.push({ code: Number(code), id, name, attack: Number(attack), health: Number(health), tier: Number(tier) });
    } else if (kind === 'lives') {
      [startingLives] = fields.map(Number);
      assert.ok(Number.isSafeInteger(startingLives) && startingLives > 0);
    } else {
      assert.equal(kind, 'offers');
      const [seat, round, ...offers] = fields.map(Number);
      assert.equal((round - 1) * 2 + seat - 1, shelves.length);
      assert.equal(offers.length, shopFixture.offerSlots);
      assert.ok(offers.every(pet => Number.isInteger(pet) && pet >= 1 && pet <= catalog.length));
      shelves.push(offers);
    }
  }
  assert.ok(shopFixture && catalog.length && startingLives && shelves.length === 4);
  return { shopFixture, shopData, catalog, startingLives };
}

export function duelReplayOracle(lua, lua54, project, profile) {
  function checkReplay({ seed, outcome, left, right }, board) {
    const input = [seed, left.join(' '), right.join(' ')].join('\n') + '\n';
    const oracle = executable => execFileSync(executable, ['-E', 'tests/native/m2-battle-oracle.lua', profile], {
      cwd: project, encoding: 'utf8', input, timeout: 10_000,
    });
    const result = oracle(lua);
    assert.equal(oracle(lua54), result);
    const [code, ...rows] = result.split('\n');
    assert.equal(BigInt(code), outcome, 'server combat and shared replay resolver disagree');
    for (let side = 0; side < 2; side += 1) {
      const count = Number(board[60 + side]);
      const head = Number(board[62 + side]);
      const fields = [];
      for (let slot = 0; slot < count; slot += 1) {
        const offset = (side * 5 + (head + slot) % 5) * 6;
        fields.push(...board.slice(offset, offset + 6));
      }
      assert.equal(fields.join(' '), rows[side], 'server and Lua terminal board disagree');
    }
    return rows[2] === '' ? [] : rows[2].split(' ');
  }
  return checkReplay;
}
