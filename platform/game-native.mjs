import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bundleRun } from './m1-bundle.mjs';
import { button, group, image, label, pigment, unifiedRun } from './m1-ui.mjs';
import { duelClientSource, duelGraphs, duelLayout, duelSignals, duelVariables } from './m2-duel-native.mjs';
import { nativeBattle } from './m3-battle-opening.mjs';
import { nativeRoom, roomSignals } from './m3-room-native.mjs';
import { roomClientSource, unifiedRoomLayout } from './m3-room-ui.mjs';
import { nativeShop } from './versus-shop.mjs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

export const stageVariables = ['AP_GameMode', 'AP_RoomTicket'];
export const playerVariables = [...duelVariables, 'AP_LobbyRequest'];
export const signals = {
  AP_GameChooseMode: [{ name: 'mode', type: 'integer' }, { name: 'fill', type: 'boolean' },
    { name: 'requestId', type: 'integer' }],
  AP_GameLobby: ['mode', 'present', 'waiting', 'requested', 'reason', 'requestId', 'entry', 'duelReason', 'roomReason',
    'lastChoice'].map(name => ({ name, type: 'integer' })),
  ...roomSignals,
  ...Object.fromEntries(Object.entries(duelSignals).map(([name, fields]) =>
    [name, fields.map(([parameter, type]) => ({ name: parameter, type }))])),
};

export const gameScript = 'auto_pets_game';
export const gameInterface = 'AutoPetsGame';
export const practiceSeed = 8;

const back = (x, y) => button('Back', [x, y], [156, 48], '返回主菜单');
const view = (name, controls) => ({ ...group(name, [0, 0], [1280, 720], controls, false), active: false });
const guidePosition = -155;

function lobbyButton(name, position, size, title, { primary = false, small = false, visible = true } = {}) {
  const caption = label('Title', [0, 0], size, title, small ? 22 : 27, small ? pigment.cream : pigment.ink);
  Object.assign(caption.text, { background: small ? '#3b604e' : primary ? '#ffe1a0' : '#fff3d9', backgroundOpacity: 1 });
  return { ...group(name, position, size,
    [caption, { name: 'Hit', kind: 'cursorArea', size }], visible), active: visible };
}

function layout(duelRules) {
  const modeSize = [344, 112];
  const secondarySize = [224, 82];
  const practice = unifiedRun.controls.map(control => {
    if (/^Enemy[1-5]$/u.test(control.name)) {
      return { ...control, children: control.children.filter(child => child.name !== 'Portrait') };
    }
    if (control.name !== 'Menu') return control;
    return { ...control, children: [...control.children.map(child => {
      if (child.name === 'Heading') return { ...child, text: { ...child.text, content: '单人 AI 练习' } };
      return child;
    }), button('Back', [0, -218], [334, 82], '返回主菜单', false, 24)] };
  });
  const guide = label('Help', [0, 10], [1056, 222], [
    '单人 AI 练习 · 买入动物、编入阵容，再与电脑对战。',
    '好友 1v1 · 邀请一名好友进入同一房间，两人到齐即可开局。',
    '八人吃鸡 · 至少一名玩家即可开局，空席由机器人补齐。',
    '离开关卡 · 从系统菜单选择退出。',
  ].join('\n'), 24);
  Object.assign(guide.text, { background: pigment.cream, backgroundOpacity: 1 });
  return {
    name: gameInterface, script: gameScript, showCursor: true, blockCursor: true, blockKeys: true,
    controls: [
      { ...image('GameBackdrop', [0, 0], [1, 1], '#587454'), anchor: { min: [0, 0], max: [1, 1] } },
      group('Lobby', [0, 0], [1280, 720], [
        label('Title', [0, 218], [1112, 88], '小动物自走棋', 61, pigment.cream),
        label('Status', [0, 138], [1112, 52], '同步中…', 23, pigment.cream),
        group('Choices', [0, 31], [1112, 120], [
          lobbyButton('Practice', [-376, 0], modeSize, '单人 AI 练习', { primary: true }),
          lobbyButton('Duel', [0, 0], modeSize, '好友 1v1'),
          lobbyButton('Room', [376, 0], modeSize, '八人吃鸡'),
        ]),
        lobbyButton('Continue', [0, 31], modeSize, '', { primary: true, visible: false }),
        label('Feedback', [0, -76], [1112, 64], '', 24, '#ffe1a0'),
        { ...guide, visible: false, active: false },
        lobbyButton('Cancel', [-128, guidePosition], secondarySize, '取消等待', { small: true, visible: false }),
        lobbyButton('Guide', [0, guidePosition], secondarySize, '玩法说明', { small: true }),
      ]),
      view('Practice', practice),
      view('Duel', [...duelLayout(duelRules).controls, back(226, 306)]),
      view('Room', [...unifiedRoomLayout.controls, back(-145, 294)]),
    ],
  };
}

function gated(source, anchors, mode) {
  const gate = `if (f.getCustomVariable(f.getSelfEntity(), 'AP_GameMode').asType('int') !== ${mode}n) return;`;
  for (const anchor of anchors) {
    assert.equal(source.split(anchor).length, 2, 'Expected one authority callback to gate');
    source = source.replace(anchor, `${anchor}\n  ${gate}`);
  }
  return source;
}

export function nativeGame(lua53, lua54, parse, ids) {
  const profile = 'release';
  const shop = nativeShop(lua53, lua54, profile);
  const battle = nativeBattle(lua53, lua54, parse, profile);
  const room = nativeRoom(lua53, lua54, parse, ids.room, ids.roomFight, 1n, 1, undefined, profile);
  const [duel, duelFight] = duelGraphs(shop, battle, ids.duel, ids.duelFight, room.settings.STARTING_LIVES, true);
  const roomSource = gated(room.roomSource, [
    ".on('whenTimerIsTriggered', (event, f) => {", '.onSignal(roomRequest, (event, f) => {',
  ], 8);
  const duelSource = gated(duel, [
    ".on('whenTimerIsTriggered', (event, f) => {", '.onSignal(request, (event, f) => {',
  ], 2);
  const lobbySource = read('./game_lobby.ts').replace('id: 1073741825,', `id: ${ids.lobby},`);
  const clientLayout = layout(shop.rules);
  const source = bundleRun(parse, true, convert => {
    const wrap = (name, code, callbacks, argument = '') => [
      `local function ${name}(${argument})`,
      `local ${Object.values(callbacks).join(', ')}`,
      code,
      `return {${Object.entries(callbacks).map(([key, value]) => `${key} = ${value}`).join(', ')}}`,
      'end',
    ].join('\n');
    const practice = wrap('practice_view', convert('./m1_ui.lua'), {
      start: 'OnStart', enable: 'OnEnable', disable: 'OnDisable', update: 'OnUpdate', destroy: 'OnDestroy',
    });
    const duelUi = duelClientSource(convert('./m2_probe.lua'), shop, true)
      .replace('local root, offers = script.object, script.object',
        'local root, offers = view_root, view_root:GetChild("MarketOffers")');
    const duel = wrap('duel_view', duelUi, { start: 'OnStart', update: 'OnUpdate', destroy: 'OnDestroy', refresh: 'request_snapshot' }, 'view_root');
    const roomUi = roomClientSource(convert('./m3_room_ui.lua'), room.shopCatalog, true);
    const versus = wrap('room_view', roomUi, { start: 'OnStart', update: 'OnUpdate', destroy: 'OnDestroy', refresh: 'refresh' });
    return [practice, duel, versus, convert('./game_ui.lua')].join('\n\n');
  }, clientLayout);
  parse(source, { luaVersion: '5.3' });
  return {
    layout: clientLayout, source, roomSettings: room.settings,
    shopRules: shop.rules, shopLevelThresholds: shop.levelThresholds, stockBaseLength: shop.start[0].length,
    graphs: [
      { graphId: ids.lobby, code: lobbySource }, { graphId: ids.duel, code: duelSource },
      { graphId: ids.duelFight, code: duelFight }, { graphId: ids.room, code: roomSource },
      { graphId: ids.roomFight, code: room.fightSource },
    ],
  };
}
