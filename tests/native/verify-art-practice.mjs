import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { artPractice } from '../../platform/m1-art-preview.mjs';
import { nativeSimulatorSave, sha256 } from '../../scripts/simulator-native.mjs';

const [mcpArg, simulatorArg, rowsFile, outputArg] = process.argv.slice(2);
assert.ok(outputArg, 'Usage: node verify-art-practice.mjs <MCP> <Simulator> <six portrait rows JSON> <new output>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
const mcp = fs.realpathSync(mcpArg);
const simulator = fs.realpathSync(simulatorArg);
const output = path.resolve(outputArg);
assert.ok(!fs.existsSync(output), 'Use a new isolation directory');
fs.mkdirSync(output, { recursive: true });
const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
const project = new URL('../../', import.meta.url);
const sourceRevision = git(project.pathname, 'rev-parse', 'HEAD');
const requireCleanSource = () => assert.equal(git(project.pathname, 'status', '--porcelain', '--untracked-files=all'), '',
  'Build and verify the art sample on a clean checkout');
requireCleanSource();
const lock = JSON.parse(fs.readFileSync(new URL('platform/toolchain-lock.json', project)));
const mcpCommit = git(mcp, 'rev-parse', 'HEAD');
const simulatorCommit = git(simulator, 'rev-parse', 'HEAD');
assert.equal(mcpCommit, lock.mcp.commit);
assert.equal(simulatorCommit, lock.simulator.commit);
for (const directory of [mcp, simulator]) {
  const changed = git(directory, 'diff', '--name-only', 'HEAD').split('\n').filter(Boolean);
  assert.ok(changed.every(file => file === 'npm-shrinkwrap.json'), 'Tracked tool source changed: ' + changed.join(', '));
}
const load = (directory, file) => import(pathToFileURL(path.join(directory, file)).href);
const [{ Service }, { toolRegistry }, api, { renderPaintPng }, { ImageAssetStore }, { LuaRuntime }] = await Promise.all([
  load(mcp, 'src/core.mjs'), load(mcp, 'src/tool-registry.mjs'), load(simulator, 'studio/play/session.js'),
  load(simulator, 'studio/host-png.js'), load(simulator, 'studio/host/image-assets.js'),
  load(simulator, 'client/lua-runtime/src/index.js'),
]);
const { parse } = createRequire(path.join(mcp, 'package.json'))('luaparse');
const rows = fs.readFileSync(rowsFile);
const { layout, source, animals, layersPerSlot } = artPractice(parse, JSON.parse(rows));
const byName = new Map(Object.values(animals).map(animal => [animal.name, animal]));
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-art-practice-'));
let mapPath = path.join(workspace, 'input.gil');
fs.copyFileSync(path.join(mcp, 'tests/fixtures/editor-2026-10-26-shapes.gil'), mapPath);
assert.equal(sha256(fs.readFileSync(mapPath)), 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706');
const service = new Service({ workspace, saveRoots: [], allowLive: false });
assert.equal(service.capabilities().liveWriteEnabled, false);
assert.deepEqual(service.capabilities().saveRoots, []);
const tools = toolRegistry(service);
const stage = async (name, args) => {
  const tool = tools.find(tool => tool.name === name);
  const result = await tool.method(tool.schema.parse({ mapPath, ...args }));
  assert.equal(result.failed, undefined, JSON.stringify(result));
  mapPath = fs.realpathSync(result.mapPath);
  assert.ok(mapPath.startsWith(workspace + path.sep));
};
const seed = 8;
const mounted = { name: layout.script, values: { seed } };
await stage('scene_remove_entities', { names: ['积木样本'] });
await stage('scene_set_player_count', { min: 1, max: 1 });
await stage('scene_set_client_script', {
  name: layout.script, source, variables: [{ name: 'seed', type: 'integer', value: seed, public: true }],
});
await stage('scene_add_client_ui', { ...layout, script: mounted, outputName: 'six-animal-practice' });
const gil = path.join(output, 'six-animal-practice.gil');
fs.copyFileSync(mapPath, gil, fs.constants.COPYFILE_EXCL);
fs.copyFileSync(path.join(mcp, 'LICENSE'), path.join(output, 'MCP-FIXTURE-LICENSE.txt'));
const { save, receipt } = await nativeSimulatorSave(mcp, gil, layout.name);
const script = save.assets.scripts.find(script => script.source === source);
assert.ok(script, 'GIL does not contain the exact practice Lua');
assert.deepEqual(receipt.scriptParameters[layout.script], { seed });
assert.ok(receipt.controls - 1 <= 1000, 'Practice layout is over 1,000 controls');
const count = node => 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
assert.equal(receipt.controls - 1, layout.controls.reduce((sum, node) => sum + count(node), 0));
const originalMount = LuaRuntime.prototype.mountScript;
LuaRuntime.prototype.mountScript = function(options) {
  return originalMount.call(this, { ...options, params: receipt.scriptParameters[path.basename(options.path, '.lua')] ?? {} });
};

const input = fs.readFileSync(new URL('./release-practice-rounds.lua', import.meta.url), 'utf8');
function literal(node) {
  if (node.type === 'TableConstructorExpression') return node.fields.map(field => literal(field.value));
  if (node.type === 'NumericLiteral') return node.value;
  assert.equal(node.type, 'StringLiteral');
  return node.raw.slice(1, -1);
}
const rounds = literal(parse(input, { luaVersion: '5.3' }).body[0].arguments[0]);
const shopRounds = new Set([3, 5, 7, 8, 11]);
const battleRounds = new Set([4, 11]);
const imageAssets = new ImageAssetStore({ cacheDir: path.join(workspace, 'image-cache') });
const results = [];
const cardNames = ['Shop/Pet1', 'Shop/Pet2', 'Shop/Pet3',
  ...Array.from({ length: 5 }, (_, index) => 'Team' + (index + 1)),
  ...Array.from({ length: 5 }, (_, index) => 'Enemy' + (index + 1))];

for (const canvasId of ['pc-16-9', 'mobile-19.5-9']) {
  const started = performance.now();
  const session = api.startPlay(save.assets.server, { scripts: save.assets.scripts, canvasId, playerCount: 1, language: 'zh-CN' });
  const mountMs = performance.now() - started;
  const frames = [];
  const shownInBattle = new Set();
  const shownOnShelf = new Set();
  const portraitPeak = { layers: 0 };
  let pointerHits = 0;
  function control(trail) {
    return trail.split('/').reduce((node, part) => node?.children.find(child => child.name === part), session.runtime.roots[0]);
  }
  function press(name) {
    const trail = name + '/Hit';
    const node = control(trail);
    assert.ok(node, trail);
    const { centerX, centerY } = api.runtimeLayout(session).get(node.Id);
    assert.equal(api.hitPlayControl(session, centerX, centerY)?.Id, node.Id, trail);
    api.injectPlayPointer(session, 'down', centerX, centerY);
    pointer('up', { centerX, centerY });
    pointerHits += 1;
  }
  function pointer(type, { centerX, centerY }) {
    api.injectPlayPointer(session, type, centerX, centerY);
    api.stepPlay(session, 1 / 60);
  }
  function snapshot() {
    const frame = api.playSnapshot(session, { paint: true });
    assert.ok(!frame.mountError, frame.mountError);
    assert.deepEqual(frame.logs.filter(log => /error/u.test(log.level)), []);
    return frame;
  }
  function paintedCards(frame) {
    const items = new Map(frame.paint.map(item => [item.id, item]));
    const cards = [];
    for (const trail of cardNames) {
      const text = items.get(control(trail + '/Name').Id);
      if (!text || !items.has(control(trail + '/Detail').Id)) continue;
      assert.ok(text.textLayout.fits && text.textLayout.visibleLineCount > 0, trail);
      const portrait = control(trail + '/Portrait');
      assert.ok(portrait, 'Painted card has no active portrait ' + trail);
      const layers = portrait.children.filter(child => items.has(child.Id));
      assert.ok(layers.length > 0, trail);
      const fitted = byName.get(text.text);
      if (fitted) {
        assert.equal(layers.length, fitted.layers.length, trail);
        const scale = trail.startsWith('Shop/') ? 1.5 : 1;
        for (const layer of layers) {
          const row = fitted.layers[Number(layer.name.slice(5)) - 1];
          assert.equal(layer.imageId, row[0], trail + '/' + layer.name);
          assert.ok(Math.abs(layer.sizeDeltaX - row[3] * scale) < 1e-5 &&
            Math.abs(layer.sizeDeltaY - row[4] * scale) < 1e-5, trail + '/' + layer.name);
          for (const [field, value] of [['X', row[8]], ['Y', row[9]], ['Z', row[10]]]) {
            assert.ok(Math.abs((layer['localRotation' + field] ?? 0) - (value ?? 0)) < 1e-5, trail);
          }
        }
        assert.equal(portrait.localScaleX, trail.startsWith('Enemy') ? -1 : 1, trail);
      }
      cards.push({ trail, name: text.text, fitted: !!fitted, layers: layers.length });
    }
    return cards;
  }
  async function capture(name, frame, cards) {
    const assets = await imageAssets.prepare(frame.paint);
    assert.deepEqual(assets.warnings, [], name);
    const defects = frame.paint.filter(item => item.kind === 'textbox' && item.text && item.textLayout?.visibleLineCount === 0);
    assert.deepEqual(defects, [], name);
    const file = canvasId + '-' + name + '.png';
    const png = renderPaintPng(frame.paint, frame.canvasWidth, frame.canvasHeight, assets).data;
    fs.writeFileSync(path.join(output, file), png);
    frames.push({ file, sha256: sha256(png), cards, painted: frame.paint.length });
  }
  function checkPortraitPeak(cards) {
    portraitPeak.layers = Math.max(portraitPeak.layers, cards.reduce((sum, card) => sum + card.layers, 0));
  }
  try {
    press('Menu/Continue');
    for (const [index, [, ...actions]] of rounds.entries()) {
      const round = index + 1;
      if (shopRounds.has(round)) {
        const frame = snapshot();
        const cards = paintedCards(frame);
        for (const card of cards) if (card.fitted && card.trail.startsWith('Shop/')) shownOnShelf.add(card.name);
        checkPortraitPeak(cards);
        await capture('shop-' + round, frame, cards);
      }
      for (const [action, from, to] of actions) {
        if (action === 'buy' || action === 'combine') {
          press('Shop/Pet' + from);
          press(to ? 'Team' + to : 'Shop/Buy');
        } else if (action === 'feed') {
          press('Shop/Food' + from);
          press('Team' + to);
        } else if (action === 'move' || action === 'sell') {
          press('Team' + from);
          press(to ? 'Team' + to : 'Shop/Sell');
        } else if (action === 'reward') {
          press('Shop/Reward');
          press('Shop/Buy');
        } else {
          assert.equal(action, 'reroll');
          press('Shop/Reroll');
        }
      }
      press('Primary');
      if (battleRounds.has(round)) {
        const frame = snapshot();
        const cards = paintedCards(frame);
        assert.equal(cards.filter(card => card.trail.startsWith('Team')).length, 5);
        assert.equal(cards.filter(card => card.trail.startsWith('Enemy')).length, 5);
        for (const card of cards) if (card.fitted) shownInBattle.add(card.name);
        checkPortraitPeak(cards);
        await capture('battle-' + round, frame, cards);
        if (round === 4) {
          press('Battle/Auto');
          for (let event = 0; event < 31; event += 1) press('Battle/Replay');
          const summon = snapshot();
          const caption = summon.paint.find(item => item.id === control('Battle/Event').Id);
          assert.match(caption?.text, /入场/u);
          await capture('rabbit-summon', summon, paintedCards(summon));
        }
      }
      press('Primary');
      press('Primary');
      if (round < rounds.length) press('Primary');
    }
    const final = snapshot();
    assert.ok(final.logs.some(log => /phase=ended round=15 wins=10 lives=1/u.test(log.text)), 'No 15-round practice win');
    assert.deepEqual([...shownInBattle].sort(), [...byName.keys()].sort());
    assert.deepEqual([...shownOnShelf].sort(), [...byName.keys()].sort());
    await capture('victory', final, paintedCards(final));
    press('Primary');
    assert.ok(snapshot().logs.some(log => /phase=preparation round=1 wins=0/u.test(log.text)), 'Restart did not return to round 1');
    const sourceOffer = 'Shop/Pet1';
    const sourceName = snapshot().paint.find(item => item.id === control(sourceOffer + '/Name').Id).text;
    const boxes = api.runtimeLayout(session);
    const offer = boxes.get(control(sourceOffer + '/Hit').Id);
    const target = boxes.get(control('Team1/Hit').Id);
    pointer('down', offer);
    pointer('move', target);
    pointer('up', target);
    const preview = snapshot();
    assert.equal(preview.paint.find(item => item.id === control('Money/Value').Id).text, '10');
    assert.match(preview.paint.find(item => item.id === control('Hint').Id).text, /点击标记站位确认/u);
    press('Team1');
    const purchased = snapshot();
    assert.equal(purchased.paint.find(item => item.id === control('Money/Value').Id).text, '7');
    assert.equal(purchased.paint.find(item => item.id === control('Team1/Name').Id).text, sourceName);
    await capture('drag-purchase', purchased, paintedCards(purchased));
    results.push({ canvasId, mountMs, pointerHits, portraitPeak, shownOnShelf: [...shownOnShelf],
      shownInBattle: [...shownInBattle], frames });
  } finally {
    api.stopPlay(session);
  }
}
assert.equal(git(project.pathname, 'rev-parse', 'HEAD'), sourceRevision);
requireCleanSource();
const report = { status: 'executed', designVersion: 'v2.1.0', sourceRevision,
  rowsSha256: sha256(rows), inputSha256: sha256(input), mcpCommit, simulatorCommit, authoredControls: receipt.controls - 1,
  layersPerSlot, gilBytes: fs.statSync(gil).size, simulatorProcessRssBytes: process.memoryUsage.rss(),
  officialClient: 'pending', ...receipt, results };
fs.writeFileSync(path.join(output, 'ART-PRACTICE.json'), JSON.stringify(report, null, 2) + '\n');
fs.copyFileSync(new URL('platform/ART-PRACTICE.md', project), path.join(output, 'README.md'));
fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map(file =>
  sha256(fs.readFileSync(path.join(output, file))) + '  ' + file).join('\n') + '\n');
console.log(JSON.stringify({ status: report.status, authoredControls: report.authoredControls, gilBytes: report.gilBytes,
  results: results.map(({ canvasId, pointerHits, shownOnShelf, shownInBattle, portraitPeak }) =>
    ({ canvasId, pointerHits, shownOnShelf, shownInBattle, portraitPeak })) }));
