import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { nativeSimulatorSave, sha256 } from '../../scripts/simulator-native.mjs';

const [mcp, simulator, gil, output] = process.argv.slice(2);
assert.ok(output, 'Usage: node tests/simulator/expanded-game.mjs <MCP> <Simulator> <GIL> <new output>');
assert.ok(!fs.existsSync(output), 'Use a new evidence directory');
fs.mkdirSync(output, { recursive: true });
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const lock = JSON.parse(fs.readFileSync(new URL('../../platform/toolchain-lock.json', import.meta.url)));
for (const [directory, tool] of [[mcp, lock.mcp], [simulator, lock.simulator]]) {
  assert.equal(git(directory, 'rev-parse', 'HEAD'), tool.commit);
  const changed = git(directory, 'diff', '--name-only', 'HEAD').split('\n').filter(Boolean);
  assert.ok(changed.every(file => file === 'npm-shrinkwrap.json'), `Pinned tool source changed in ${directory}`);
}

const build = JSON.parse(fs.readFileSync(path.join(path.dirname(gil), 'BUILD.json')));
const { catalog } = build.expanded;
const tiers = Array.from({ length: 6 }, (_, index) => catalog.filter(pet => pet.tier === index + 1));
assert.equal(catalog.length, 60);
assert.equal(new Set(catalog.map(pet => pet.id)).size, 60);
assert.equal(new Set(catalog.map(pet => pet.name)).size, 60);
assert.deepEqual(tiers.map(tier => tier.length), [10, 10, 10, 10, 10, 10]);
assert.deepEqual(tiers.flat(), catalog, 'Catalog codes must be ordered by shop tier');
assert.deepEqual(build.petTierCounts, tiers.map(tier => tier.length));
const idsByName = new Map(catalog.map(pet => [pet.name, pet.id]));
const codeById = new Map(catalog.map((pet, index) => [pet.id, index + 1]));
const { save, receipt } = await nativeSimulatorSave(mcp, gil);
assert.equal(receipt.mapSha256, build.sha256);
assert.equal(receipt.controls - 1, build.controls);
assert.ok(receipt.controls - 1 <= 1000);
const load = file => import(pathToFileURL(path.join(simulator, file)).href);
const [api, { LuaRuntime }, { renderPaintPng }, { ImageAssetStore }] = await Promise.all([
  load('studio/play/session.js'), load('client/lua-runtime/src/index.js'),
  load('studio/host-png.js'), load('studio/host/image-assets.js'),
]);
const mount = LuaRuntime.prototype.mountScript;
LuaRuntime.prototype.mountScript = function mountReadback(options) {
  const name = path.basename(options.path, '.lua');
  return mount.call(this, { ...options, params: receipt.scriptParameters[name] ?? {} });
};
const assets = new ImageAssetStore({ cacheDir: path.join(output, 'image-cache') });
const frames = [];
const results = [];

const replaySeed = 42;
const replayTeams = [[1, 15, 29, 43, 57], [2, 16, 30, 44, 60]].map((team, side) => team.map((code, index) => {
  const { attack, health } = catalog[code - 1];
  return [code, side * 5 + index + 1, attack, health, 1, 0];
}));
const formatLuaTeam = team => `{${team.map(([code, uid, attack, health, level]) =>
  `{id=native_catalog.pets[${code}].id,uid=${uid},attack=${attack},health=${health},level=${level}}`).join(',')}}`;
const lua = save.assets.scripts[0].source;
const oracle = execFileSync(process.env.LUA54 ?? 'lua5.4', ['-E', '-'], { encoding: 'utf8', input: [
  'local Enum = {CursorEventType={CursorClick=1}}', lua,
  'local battle = loadAutoPetsModule("autopets.battle")',
  `local result = battle.resolve(${replayTeams.map(formatLuaTeam).join(',')},${replaySeed},native_catalog)`,
  'assert(result.status ~= "strike_limit")', 'io.write(result.outcome)',
].join('\n') });
const replayOutcome = { win: 1, loss: 2, draw: 3 }[oracle];
assert.ok(replayOutcome, 'Readback Lua did not resolve the replay formation');

function createView(canvasId, playerCount) {
  const start = performance.now();
  const session = api.startPlay(save.assets.server, { scripts: save.assets.scripts, templatesProject: save.assets.client,
    canvasId, playerCount, language: 'zh-CN' });
  const mountMs = performance.now() - start;
  let peakSampledRssBytes = process.memoryUsage.rss();
  let peakSampledRuntimeControls = 0;
  const count = node => 1 + node.children.reduce((total, child) => total + count(child), 0);
  const control = trail => trail.split('/').reduce((node, name) => node?.children.find(child => child.name === name),
    session.runtime.roots[0]);
  const presses = [];
  const boxFor = trail => api.runtimeLayout(session).get(control(trail).Id);
  function pointer(type, { centerX, centerY }) {
    api.injectPlayPointer(session, type, centerX, centerY);
    api.stepPlay(session, 1 / 60);
  }
  function click(trail) {
    const node = control(trail);
    assert.ok(node, `Missing control ${trail}`);
    const box = boxFor(trail);
    assert.equal(api.hitPlayControl(session, box.centerX, box.centerY)?.Id, node.Id, `${trail} is occluded`);
    api.injectPlayPointer(session, 'down', box.centerX, box.centerY);
    api.injectPlayPointer(session, 'up', box.centerX, box.centerY);
    api.stepPlay(session, 1 / 60);
    presses.push(trail);
  }
  function snapshot() {
    const frame = api.playSnapshot(session, { paint: true });
    assert.equal(frame.mountError, null);
    assert.deepEqual(frame.logs.filter(log => /error/u.test(log.level)), []);
    peakSampledRuntimeControls = Math.max(peakSampledRuntimeControls, count(session.runtime.roots[0]));
    peakSampledRssBytes = Math.max(peakSampledRssBytes, process.memoryUsage.rss());
    return frame;
  }
  function show(frame, trail) {
    return frame.paint.find(item => item.id === control(trail)?.Id);
  }
  function text(frame, trail) {
    const paint = show(frame, trail);
    assert.ok(paint?.text?.trim() && paint.textLayout?.fits && paint.textLayout.visibleLineCount > 0,
      `Missing or clipped ${trail}: ${paint?.text}`);
    return paint.text;
  }
  async function capture(name, frame = snapshot()) {
    const textDefects = frame.paint.filter(item => item.kind === 'textbox' && item.text.trim()
      && (!item.textLayout?.fits || item.textLayout.visibleLineCount === 0));
    assert.deepEqual(textDefects, [], name);
    const prepared = await assets.prepare(frame.paint);
    assert.deepEqual(prepared.warnings, [], name);
    const file = `${canvasId}-${name}.png`;
    const png = renderPaintPng(frame.paint, frame.canvasWidth, frame.canvasHeight, prepared).data;
    fs.writeFileSync(path.join(output, file), png);
    frames.push({ file, sha256: sha256(png) });
  }
  return { session, control, click, boxFor, pointer, snapshot, show, text, capture, presses,
    measurements: () => ({ mountMs, peakSampledRuntimeControls, peakSampledRssBytes }) };
}

function positions(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
}

function portraitLayers(frame, root, id) {
  assert.ok(root, `Missing portrait for ${id}`);
  const painted = new Set(frame.paint.map(item => item.id));
  const template = root.children.find(child => child.name === 'FittedPortraitLayers');
  const layers = [...root.children, ...(template?.children ?? [])]
    .filter(child => /^Layer\d+$/u.test(child.name) && painted.has(child.Id));
  const expected = build.artPreview?.animals[id]?.layers.length;
  if (expected) assert.equal(layers.length, expected, id);
  else assert.ok(layers.length > 0 && layers.length <= 16 && !template, id);
  return layers.length;
}

function integerText(value, suffix = '') {
  const match = new RegExp(`^([0-9]+)${suffix}$`, 'u').exec(value);
  assert.ok(match, `Expected ${suffix || 'numeric'} value, got ${value}`);
  return Number(match[1]);
}

async function practice(canvasId) {
  const view = createView(canvasId, 1);
  const { control, click, boxFor, pointer, snapshot, show, text, capture } = view;
  const press = name => click(`Practice/${name}/Hit`);
  const team = positions('Practice/Team', 5);
  const opponent = positions('Practice/Enemy', 5);
  const seenOffers = new Set();
  const actions = [];
  try {
    click('Lobby/Choices/Practice/Hit');
    press('Menu/Difficulty');
    assert.match(text(snapshot(), 'Practice/Menu/Difficulty/Title'), /入门/u);
    press('Menu/Continue');
    let fullBattle = false;
    let firstLoss;
    let finish;
    let maxTier = 0;
    for (let round = 1; round <= 40; round += 1) {
      const opened = snapshot();
      assert.equal(text(opened, 'Practice/Round/Value'), `第 ${round} 轮 · 准备`);
      const tier = Math.min(6, Math.floor((round + 1) / 2));
      assert.equal(text(opened, 'Practice/Shop/Caption'), `商店 · ${tier} 阶`);
      maxTier = tier;
      let state = opened;
      const money = () => integerText(text(state, 'Practice/Money/Value'));
      const teamSize = () => team.filter(trail => show(state, `${trail}/Name`)?.text).length;
      const currentOffers = () => positions('Practice/Shop/Pet', 3).flatMap((trail, index) => {
        const name = show(state, `${trail}/Name`)?.text;
        if (!idsByName.has(name)) return [];
        const id = idsByName.get(name);
        const attack = integerText(text(state, `${trail}/Detail`), '攻');
        const health = integerText(text(state, `${trail}/LifeValue`), '命');
        seenOffers.add(id);
        portraitLayers(state, control(`${trail}/Portrait`), id);
        return [{ id, slot: index + 1, attack, health }];
      });
      currentOffers();
      if (round === 2 * tier - 1) await capture(`practice-shop-${round}`, opened);
      while (money() >= 3 && teamSize() < 5) {
        const offer = currentOffers().sort((a, b) => b.attack + b.health - a.attack - a.health)[0];
        if (!offer) break;
        const before = money();
        const beforeTeam = teamSize();
        press(`Shop/Pet${offer.slot}`);
        press('Shop/Buy');
        state = snapshot();
        assert.equal(money(), before - 3);
        assert.equal(teamSize(), beforeTeam + 1);
        actions.push({ round, action: 'buy', ...offer });
      }
      for (const slot of [1, 2]) {
        if (money() < 3 || teamSize() < 5) break;
        const before = money();
        press(`Shop/Food${slot}`);
        press('Team1');
        state = snapshot();
        assert.equal(money(), before - 3);
        actions.push({ round, action: 'feed', slot });
      }
      press('Primary');
      const battle = snapshot();
      assert.equal(text(battle, 'Practice/Round/Value'), `第 ${round} 轮 · 战斗`);
      const cards = [...team, ...opponent].filter(trail => show(battle, `${trail}/Name`)?.text);
      for (const trail of cards) {
        const name = text(battle, `${trail}/Name`);
        portraitLayers(battle, control(`${trail}/Portrait`), idsByName.get(name) ?? name);
      }
      if (!fullBattle && cards.length === 10) {
        fullBattle = true;
        await capture('practice-five-v-five', battle);
        press('Battle/Auto');
        const event = text(snapshot(), 'Practice/Battle/Event');
        for (let index = 0; index < 12; index += 1) api.stepPlay(view.session, 0.05);
        assert.equal(text(snapshot(), 'Practice/Battle/Event'), event, 'Paused replay moved');
        press('Battle/Replay');
        assert.notEqual(text(snapshot(), 'Practice/Battle/Event'), event, 'Step did not advance replay');
        press('Battle/Auto');
        assert.equal(text(snapshot(), 'Practice/Battle/Auto/Title'), '暂停回放');
      }
      press('Primary');
      press('Primary');
      const settled = snapshot();
      const phase = text(settled, 'Practice/Round/Value');
      const lives = text(settled, 'Practice/Lives/Value');
      if (!firstLoss && lives !== text(opened, 'Practice/Lives/Value')) {
        const before = integerText(text(opened, 'Practice/Lives/Value'), ' / 5');
        assert.equal(integerText(lives, ' / 5'), before - 1);
        firstLoss = round;
        await capture('practice-loss', settled);
      }
      if (phase.endsWith('终局')) {
        const wins = text(settled, 'Practice/Wins/Value');
        assert.ok(wins === '10 / 10' || lives === '0 / 5');
        finish = { round, wins, lives };
        await capture('practice-terminal', settled);
        break;
      }
      press('Primary');
    }
    assert.ok(fullBattle, 'No complete five-v-five practice battle');
    assert.ok(firstLoss, 'Adaptive practice did not exercise a loss');
    assert.ok(finish, 'Adaptive practice run did not reach a terminal result');
    press('Primary');
    const restarted = snapshot();
    assert.equal(text(restarted, 'Practice/Round/Value'), '第 1 轮 · 准备');
    const firstOffer = 'Practice/Shop/Pet1';
    const offerName = text(restarted, `${firstOffer}/Name`);
    press('Shop/Pet1');
    press('Shop/Freeze');
    press('Shop/Reroll');
    const frozen = snapshot();
    assert.equal(text(frozen, 'Practice/Money/Value'), '9');
    assert.equal(text(frozen, `${firstOffer}/Name`), offerName);
    assert.equal(text(frozen, `${firstOffer}/Tag`), '已冻结');
    await capture('practice-frozen-reroll', frozen);
    const source = boxFor(`${firstOffer}/Hit`);
    const target = boxFor('Practice/Team1/Hit');
    pointer('down', source);
    pointer('move', target);
    pointer('up', target);
    const preview = snapshot();
    assert.equal(text(preview, 'Practice/Money/Value'), '9');
    assert.match(text(preview, 'Practice/Hint'), /点击标记站位确认/u);
    press('Team1');
    const bought = snapshot();
    assert.equal(text(bought, 'Practice/Money/Value'), '6');
    assert.equal(text(bought, 'Practice/Team1/Name'), offerName);
    await capture('practice-drag-purchase', bought);
    press('OpenMenu');
    press('Menu/Back');
    click('Lobby/Choices/Practice/Hit');
    press('Menu/Continue');
    const resumed = snapshot();
    assert.equal(text(resumed, 'Practice/Money/Value'), '6');
    assert.equal(text(resumed, 'Practice/Team1/Name'), offerName);
    await capture('practice-resumed', resumed);
    results.push({ mode: 'practice', canvasId, inputSource: 'pointer input against readback Lua rules',
      actions, presses: view.presses, seenOffers: [...seenOffers], maxTier, finish, fullBattle, firstLoss,
      ...view.measurements() });
  } finally {
    api.stopPlay(view.session);
  }
}

async function online(canvasId, mode, count, fullCatalog = true) {
  const duel = mode === 2;
  const view = createView(canvasId, count);
  const { session, control, click, snapshot, text, capture } = view;
  const shop = duel ? 'Duel' : 'Room/Match/Shop';
  const badgePool = duel ? `${shop}/MarketOffers/BadgePool` : `${shop}/BadgePool`;
  const onlineMode = duel ? 'duel' : 'eight-seat';
  const evidenceName = `${onlineMode}-${count}clients`;
  const teamPortraits = positions('Practice/Team', 5).map(trail => control(`${trail}/Portrait`));
  const shelfPortraits = [...positions('Practice/Shop/Pet', 3), ...positions('Practice/Shop/Food', 2)]
    .map(trail => control(`${trail}/Portrait`));
  const shelfLabels = positions(duel ? `${shop}/MarketOffers/OfferLabel` : `${shop}/Offer`, 3)
    .map(trail => duel ? trail : `${trail}/Text`);
  const teamLabels = positions(duel ? `${shop}/TeamLabel` : `${shop}/Team`, 5)
    .map(trail => duel ? trail : `${trail}/Text`);
  const shelfInspect = positions(duel ? `${shop}/MarketOffers/InspectPet` : `${shop}/InspectOffer`, 3)
    .map(trail => duel ? trail : `${trail}/Hit`);
  const teamInspect = positions(duel ? `${shop}/TeamInspection/InspectTeam` : `${shop}/InspectTeam`, 5)
    .map(trail => duel ? trail : `${trail}/Hit`);
  const requests = () => api.playSnapshot(session).server.inbound.filter(event =>
    event.name === (duel ? 'AP_DuelRequest' : 'AP_RoomRequest')).length;
  const entries = [];
  let version = 0;
  function publish(group, round, level, battling = false, player = 1) {
    version += 1;
    const tier = group[0].tier;
    const pets = [...group, ...Array(3 - group.length).fill(group[0])].map(pet => codeById.get(pet.id));
    const units = group.flatMap((pet, index) => [codeById.get(pet.id), index + 1, pet.attack + level - 1,
      pet.health + level - 1, level, [0, 2, 5][level - 1]]);
    const market = [round, tier, 11 - player, 0, 0, group.length, ...pets, 0, 0, ...units, ...Array(30 - units.length).fill(0)];
    const target = `Player${player}`;
    if (duel) {
      api.sendPlaySignal(session, 'AP_DuelSnapshot', [2, player, round, battling ? 3 : 0, battling, false, 0, version, version,
        0, 0, 30, 0, 5, 5, 0], target);
      api.sendPlaySignal(session, 'AP_DuelMarket', [round, version, market], target);
    } else {
      api.sendPlaySignal(session, 'AP_RoomView', [version, battling ? 3 : 2, round, player, version, count, 0, battling,
        Array(8).fill(5), Array(8).fill(0), [2, 1, 4, 3, 6, 5, 8, 7], Array(8).fill(0), market, 0, 42], target);
    }
  }
  try {
    api.sendPlaySignal(session, 'AP_GameLobby', [0, count, 0, 0, 0], 'AllPlayers');
    click(`Lobby/Choices/${duel ? 'Duel' : 'Room'}/Hit`);
    api.sendPlaySignal(session, 'AP_GameLobby', [mode, count, 0, mode, 0], 'AllPlayers');
    for (let player = 1; player <= count; player += 1) {
      publish(tiers[0].slice(0, 3), 1, 1, false, player);
      api.setPlayView(session, player);
      const frame = snapshot();
      const cash = text(frame, duel ? 'Duel/MarketGold' : `${shop}/Money`);
      assert.match(cash, new RegExp(`金币 ${11 - player}(?: |$)`, 'u'));
      if (!duel) assert.match(text(frame, 'Room/Standings/Count'), new RegExp(`${count} 真人 · ${8 - count} 机器人`, 'u'));
    }
    api.setPlayView(session, 1);
    for (const [tier, pets] of tiers.entries()) {
      if (!fullCatalog && tier !== 0 && tier !== 5) continue;
      for (let start = 0; start < (fullCatalog ? pets.length : 3); start += 3) {
        const group = pets.slice(start, start + 3);
        for (const level of [1, 2, 3]) {
          publish(group, 2 * tier + 1, level);
          const before = requests();
          for (const [index, pet] of group.entries()) {
            const shelf = level === 1;
            click((shelf ? shelfInspect : teamInspect)[index]);
            const state = snapshot();
            const title = text(state, `${shop}/AbilityTitle`);
            const body = text(state, `${shop}/AbilityBody`);
            assert.ok(title.startsWith(pet.name) && title.includes(`L${level}`), `${pet.id}: ${title}`);
            const label = text(state, (shelf ? shelfLabels : teamLabels)[index]);
            assert.equal(label, shelf ? pet.name : `${pet.name}${duel ? '\n' : ' '}L${level}`);
            const badge = index + (shelf ? 6 : 1);
            assert.equal(text(state, `${badgePool}/Attack${badge}`), `攻${pet.attack + level - 1}`);
            assert.equal(text(state, `${badgePool}/Life${badge}`), `命${pet.health + level - 1}`);
            const portrait = (shelf ? shelfPortraits : teamPortraits)[index];
            entries.push({ id: pet.id, name: pet.name, tier: pet.tier, code: codeById.get(pet.id), level,
              title, body, layers: portraitLayers(state, portrait, pet.id) });
          }
          assert.equal(requests(), before, 'Ability inspection mutated online shop requests');
          if (level === 1) await capture(`${evidenceName}-tier-${tier + 1}-shelf-${start / 3 + 1}-fixture`);
        }
      }
    }
    assert.equal(new Set(entries.map(entry => `${entry.id}:${entry.level}`)).size, fullCatalog ? 180 : 18);
    publish(tiers.at(-1).slice(0, 3), 11, 1, true);
    if (duel) {
      api.sendPlaySignal(session, 'AP_DuelReplay', [11, replaySeed, replayOutcome,
        ...replayTeams.map(team => team.flatMap(unit => unit.slice(0, 5)))], 'Player1');
    } else {
      api.sendPlaySignal(session, 'AP_RoomReplay', [11, 1, 2, replayOutcome, replaySeed,
        ...replayTeams.map(team => [5, ...team.flat()])], 'Player1');
    }
    const replay = snapshot();
    const replayBoard = duel ? 'Duel/ReplayBoard' : 'Room/Match/Replay';
    for (const [side, team] of replayTeams.entries()) {
      for (const [index, [code]] of team.entries()) {
        const pet = catalog[code - 1];
        const slot = `${replayBoard}/${side ? 'Enemy' : 'Own'}${index + 1}`;
        assert.equal(text(replay, slot).split('\n')[0], pet.name);
        const portrait = (side ? shelfPortraits : teamPortraits)[index];
        portraitLayers(replay, portrait, pet.id);
        if (build.artPreview?.animals[pet.id]) assert.equal(portrait.localScaleX, side ? -1 : 1, pet.id);
      }
    }
    await capture(`${evidenceName}-five-v-five-fixture`, replay);
    click(duel ? 'Duel/Back/Hit' : 'Room/Back/Hit');
    assert.ok([...teamPortraits, ...shelfPortraits].every(root =>
      root.children.every(child => child.name !== 'FittedPortraitLayers')));
    await capture(`${evidenceName}-return-fixture`);
    results.push({ mode: onlineMode, canvasId, clients: count, inputSource: 'pointer input against client wire fixtures',
      presses: view.presses, entries, replay: { seed: replaySeed, outcome: oracle, teams: replayTeams }, ...view.measurements() });
  } finally {
    api.stopPlay(session);
  }
}

for (const canvasId of ['pc-16-9', 'pc-21-9', 'mobile-16-9', 'mobile-19.5-9', 'mobile-4-3']) await practice(canvasId);
await online('pc-16-9', 2, 2);
await online('pc-16-9', 8, 2);
await online('mobile-16-9', 8, 1, false);
await online('mobile-16-9', 2, 2, false);
await online('mobile-16-9', 8, 8, false);
await online('mobile-19.5-9', 2, 2);
await online('mobile-19.5-9', 8, 8);
const report = { ...receipt, schemaVersion: 1, status: 'executed', sourceRevision: build.sourceRevision, designVersion: build.designVersion,
  mcpCommit: lock.mcp.commit, simulatorCommit: lock.simulator.commit, textDefects: [], assetDefects: [],
  scope: 'Actual readback Lua and software renderer. Practice is played using input; online client wires are fixtures.',
  officialClient: 'not-executed', frames, results };
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, gilSha256: report.mapSha256, frames: frames.length,
  suites: results.map(({ mode, canvasId, entries, finish }) => ({ mode, canvasId, inspected: entries?.length, finish })) }));
