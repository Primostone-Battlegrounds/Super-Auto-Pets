import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { duelProbeButtons } from '../../platform/m2-duel-native.mjs';
import { duelFixture, duelReplayOracle } from './duel-verification.mjs';
import { verifyGraph as verifyDuel } from './m2-probe-graph.mjs';
import { verifyRoom } from './m3-room-graph.mjs';

function verifyLobby(source, ts) {
  let receive;
  let mode = 0n;
  let field = ['A'];
  let expected = 1n;
  const replies = [];
  const stage = Symbol('stage');
  const graph = { onSignal(name, callback) { assert.equal(name, 'AP_GameChooseMode'); receive = callback; } };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, { exports: {}, require: () => ({
    defineSignal: name => name, g: { server: () => graph },
  }) });
  const flow = {
    getListOfPlayerEntitiesOnTheField: () => field,
    equal: (a, b) => a === b,
    getListLength: list => BigInt(list.length),
    queryGameModeAndPlayerNumber: () => ({ playerCount: expected }),
    getSelfEntity: () => stage,
    getCustomVariable: (target, name) => ({ asType: () => {
      assert.equal(target, stage);
      assert.equal(name, 'AP_GameMode');
      return mode;
    } }),
    setCustomVariable(target, name, value, sync) {
      assert.equal(target, stage);
      assert.equal(name, 'AP_GameMode');
      assert.equal(sync, false);
      mode = value;
    },
    sendSignal(name, target, ...values) {
      assert.equal(name, 'client:AP_GameLobby');
      assert.ok(field.includes(target));
      replies.push([target, ...values]);
    },
  };
  function choose(actor, requested) {
    receive({ signalSourceEntity: actor, params: { mode: requested } }, flow);
    return replies.splice(0);
  }
  assert.deepEqual(choose('intruder', 8n), []);
  assert.deepEqual(choose('A', 2n), [['A', 0n, 1n, 0n]]);
  expected = 2n;
  assert.deepEqual(choose('A', 8n), [['A', 0n, 1n, 1n]]);
  field.push('B');
  assert.deepEqual(choose('A', 2n), [['A', 2n, 2n, 0n], ['B', 2n, 2n, 0n]]);
  assert.deepEqual(choose('B', 8n), [['B', 2n, 2n, 0n]]);
  for (let count = 1; count <= 8; count += 1) {
    field = Array.from({ length: count }, (_, index) => `P${index + 1}`);
    expected = BigInt(count);
    mode = 0n;
    assert.deepEqual(choose('P1', 8n), field.map(player => [player, 8n, expected, 0n]));
  }
  return 'mode choice authenticates field membership, waits for loading, and locks one gameplay authority';
}

export function verifyGame(game, ids, ts, { lua53, lua54, workspace, project, extracted, bindings }) {
  const source = key => game.graphs.find(graph => graph.graphId === ids[key]).code;
  const lobby = verifyLobby(source('lobby'), ts);
  const receipts = [];
  const positions = [];
  const room = verifyRoom([source('room'), source('roomFight')], ts, { ...game.roomSettings, gated: true }, receipts, positions);
  const tsv = (name, rows) => {
    const file = path.join(workspace, name);
    fs.writeFileSync(file, rows.map(row => row.join('\t')).join('\n') + '\n');
    return file;
  };
  const receiptsPath = tsv('room-receipts.tsv', receipts);
  const positionsPath = tsv('room-positions.tsv', positions);
  const run = (lua, args) => execFileSync(lua, ['-E', ...args], { cwd: project, encoding: 'utf8', timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024 });
  const replayCheck = lua => run(lua, ['tests/native/m3-room-replay.lua', receiptsPath, 'release', positionsPath]);
  const roomReplay = replayCheck(lua53);
  assert.equal(roomReplay, replayCheck(lua54));
  const { shopFixture, startingLives } = duelFixture(lua53, lua54, project, 'release');
  const buttons = duelProbeButtons.map(button => ({ ...button, id: Number(button.placeholder) }));
  const fixtureButtons = fs.readFileSync(path.join(project, 'platform/m2_probe_buttons.ts'), 'utf8');
  const duel = verifyDuel(source('duel'), fixtureButtons, source('duelFight'), buttons, ts,
    { ...shopFixture, startingLives, foodSlots: 2, release: true, gated: true },
    duelReplayOracle(lua53, lua54, project, 'release'));
  const practice53 = run(lua53, ['tests/native/m1-replay.lua', 'source', 'release']);
  assert.equal(practice53, run(lua54, ['tests/native/m1-replay.lua', 'source', 'release']));
  const client = (lua, suffix) => {
    const captures = path.join(workspace, `captures-${suffix}.tsv`);
    const trace = run(lua, ['tests/native/game-input.lua', extracted, bindings, captures]);
    return { trace, frames: fs.readFileSync(captures, 'utf8') };
  };
  const gameClient = client(lua53, '53');
  assert.deepEqual(gameClient, client(lua54, '54'));
  return { frames: gameClient.frames, evidence: { lobby, room, roomReplay: roomReplay.trim(), duel, client: gameClient.trace.trim() } };
}

export function readGameFrames(input, controls) {
  const frames = new Map();
  for (const line of input.trimEnd().split('\n')) {
    const [name, key, active, visible, x, y, width, height, image, colour, textColour, text] = line.split('\t');
    if (!frames.has(name)) frames.set(name, new Map());
    frames.get(name).set(key, { active: active === '1', visible: visible === '1', position: [Number(x), Number(y)],
      size: [Number(width), Number(height)], image: image ? Number(image) : undefined, colour, textColour, text });
  }
  const canvases = { mobile: { width: 1280, height: 720 }, pc: { width: 1600, height: 900 } };
  return {
    canvas: canvases.mobile, canvases,
    frames: Object.fromEntries(Array.from(frames, ([name, patches]) => {
      assert.equal(patches.size, controls.length);
      return [name, controls.map(base => {
        const { textColour, text, colour, image, ...patch } = patches.get(base.path);
        return { ...base, ...patch, image: image ?? base.image, colour: colour || base.colour, text: base.text && {
          ...base.text, content: text === '~' ? base.text.content : decodeURIComponent(text), colour: textColour || base.text.colour,
        } };
      })];
    })),
  };
}
