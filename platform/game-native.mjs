import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bundleRoom, bundleRun } from './m1-bundle.mjs';
import { button, group, image, label, nativeRun, pigment, portrait } from './m1-ui.mjs';
import { duelClientSource, duelGraphs, duelLayout, duelSignals, duelVariables } from './m2-duel-native.mjs';
import { nativeBattle } from './m3-battle-opening.mjs';
import { nativeRoom, roomSignals } from './m3-room-native.mjs';
import { formalRoomLayout, roomClientSource, unifiedRoomLayout } from './m3-room-ui.mjs';
import { onlineBadgePool } from './multiplayer-standings.mjs';
import { nativeShop } from './versus-shop.mjs';
import { formalBuildLabel, validateRelease } from '../scripts/product-release.mjs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

export const stageVariables = ['AP_GameMode', 'AP_RoomTicket'];
const lobbyVariables = ['AP_LobbyRequest'];
export const playerVariables = [...duelVariables, ...lobbyVariables];
const roomAndLobbySignals = {
  AP_GameChooseMode: [{ name: 'mode', type: 'integer' }, { name: 'fill', type: 'boolean' },
    { name: 'requestId', type: 'integer' }],
  AP_GameLobby: ['mode', 'present', 'waiting', 'requested', 'reason', 'requestId', 'entry', 'duelReason', 'roomReason',
    'lastChoice'].map(name => ({ name, type: 'integer' })),
  ...roomSignals,
};

export const signals = {
  ...roomAndLobbySignals,
  ...Object.fromEntries(Object.entries(duelSignals).map(([name, fields]) =>
    [name, fields.map(([parameter, type]) => ({ name: parameter, type }))])),
};

export const gameScript = 'auto_pets_game';
export const gameInterface = 'AutoPetsGame';
export const practiceSeed = 8;
export const roomGraphNames = { lobby: 'AP_GameLobby', room: 'AP_EightRoom', roomFight: 'AP_EightFight' };
export const graphNames = { ...roomGraphNames, duel: 'AP_Duel', duelFight: 'AP_DuelBattle' };

function selectSource(source, internal) {
  return internal ? source : source.replace(
    /^[ \t]*(?:--|\/\/) @internal begin\n[\s\S]*?^[ \t]*(?:--|\/\/) @internal end\n/gm,
    '',
  );
}

const back = (x, y) => button('Back', [x, y], [156, 48], '返回主菜单');
const view = (name, controls) => ({ ...group(name, [0, 0], [1280, 720], controls, false), active: false });

function lobbyButton(name, position, size, title, { primary = false, small = false, visible = true } = {}) {
  const caption = label('Title', [0, 0], size, title, small ? 22 : 27, small ? pigment.cream : pigment.ink);
  Object.assign(caption.text, { background: small ? '#3b604e' : primary ? '#ffe1a0' : '#fff3d9', backgroundOpacity: 1 });
  return { ...group(name, position, size,
    [caption, { name: 'Hit', kind: 'cursorArea', size }], visible), active: visible };
}

function layout(duelRules, internal, buildLabel) {
  const modeSize = [344, 112];
  const practice = internal && nativeRun.controls.map(control => {
    if (/^Enemy[1-5]$/u.test(control.name)) {
      return { ...control, children: control.children.filter(child => child.name !== 'Portrait') };
    }
    if (control.name !== 'Menu') return control;
    return { ...control, children: [...control.children.map(child => {
      if (child.name === 'Heading') return { ...child, text: { ...child.text, content: '单人 AI 练习' } };
      return child;
    }), back(425, -261)] };
  });
  const portraitSlot = name => group(name, [0, 0], [96, 154], [portrait()]);
  const slots = ['Pet1', 'Pet2', 'Pet3', 'Food1', 'Food2'];
  const portraitPool = view('PortraitPool', [
    ...slots.map((_, index) => portraitSlot(`Team${index + 1}`)),
    group('Shop', [0, 0], [1280, 720], slots.map(portraitSlot)),
  ]);
  return {
    name: gameInterface, script: gameScript, showCursor: true, blockCursor: true, blockKeys: true,
    controls: [
      { ...image('GameBackdrop', [0, 0], [1, 1], '#587454'), anchor: { min: [0, 0], max: [1, 1] } },
      group('Lobby', [0, 0], [1280, 720], [
        label('Title', [0, 218], [1112, 88], '小动物自走棋', 61, pigment.cream),
        label('Status', [0, 138], [1112, 52], '正在连接千星关卡', 27, pigment.cream),
        group('Choices', [0, 31], [1112, 120], [
          ...(internal ? [
            lobbyButton('Practice', [-376, 0], modeSize, '单人 AI 练习', { primary: true }),
            lobbyButton('Duel', [0, 0], modeSize, '好友 1v1'),
          ] : []),
          lobbyButton('Room', [internal ? 376 : 0, 0], modeSize, '八人吃鸡', { primary: !internal }),
        ]),
        lobbyButton('Continue', [0, 31], modeSize, '', { primary: true, visible: false }),
        label('Feedback', [0, -76], [1112, 64], '', 24, '#ffe1a0'),
        label('Help', [0, -157], [1034, 72],
          internal ? '好友 1v1 请先在千星好友房间邀请好友。' : '从千星好友房间邀请好友，空位由机器人补齐。', 22, pigment.cream),
        lobbyButton('Cancel', [-116, -263], [198, 82], '取消等待', { small: true, visible: false }),
        lobbyButton('Exit', [116, -263], [198, 82], '退出指引', { small: true }),
        ...(internal ? [] : [label('BuildVersion', [0, -325], [1012, 32], buildLabel, 18, pigment.cream)]),
      ]),
      ...(internal
        ? [view('Practice', practice), view('Duel', [...duelLayout(duelRules).controls, back(221, 278)])]
        : [portraitPool, onlineBadgePool()]),
      view('Room', [...(internal ? unifiedRoomLayout : formalRoomLayout).controls, back(-145, 276)]),
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

export function nativeGame(lua53, lua54, parse, ids, { profile = 'formal', release, sourceRevision } = {}) {
  const internal = profile === 'internal';
  assert.ok(internal || profile === 'formal', 'Unknown game build profile');
  assert.ok(internal ? release === undefined : release, 'A formal game build requires the approved release scope');
  if (!internal) validateRelease(release);
  const buildLabel = !internal && formalBuildLabel({ gameVersion: release.gameVersion, sourceRevision });
  const catalogProfile = release?.catalogProfile ?? 'release';
  const shop = nativeShop(lua53, lua54, catalogProfile);
  const room = nativeRoom(lua53, lua54, parse, ids.room, ids.roomFight, 1n, 1, undefined, catalogProfile);
  const roomSource = gated(room.roomSource, [
    ".on('whenTimerIsTriggered', (event, f) => {", '.onSignal(roomRequest, (event, f) => {',
  ], 8);
  const lobbySource = selectSource(read('./game_lobby.ts'), internal).replace('id: 1073741825,', `id: ${ids.lobby},`);
  const clientLayout = layout(shop.rules, internal, buildLabel);
  const render = convert => {
    const wrap = (name, code, callbacks, argument = '') => [
      `local function ${name}(${argument})`,
      `local ${Object.values(callbacks).join(', ')}`,
      code,
      `return {${Object.entries(callbacks).map(([key, value]) => `${key} = ${value}`).join(', ')}}`,
      'end',
    ].join('\n');
    const views = [];
    if (internal) {
      views.push(wrap('practice_view', convert('./m1_ui.lua'), {
        start: 'OnStart', enable: 'OnEnable', disable: 'OnDisable', update: 'OnUpdate', destroy: 'OnDestroy',
      }));
      const duelUi = duelClientSource(convert('./m2_probe.lua'), shop)
        .replace('local root, offers = script.object, script.object',
          'local root, offers = view_root, view_root:GetChild("MarketOffers")');
      views.push(wrap('duel_view', duelUi,
        { start: 'OnStart', update: 'OnUpdate', destroy: 'OnDestroy', refresh: 'request_snapshot' }, 'view_root'));
    }
    const roomUi = roomClientSource(convert('./m3_room_ui.lua'), room.shopCatalog, !internal);
    views.push(wrap('room_view', roomUi, { start: 'OnStart', update: 'OnUpdate', destroy: 'OnDestroy', refresh: 'refresh' }));
    const portraitHome = internal ? 'Practice' : 'PortraitPool';
    const badgeHome = internal ? 'Duel/ReplayBoard/BadgePool' : 'BadgePool';
    return [`local online_portrait_home = '${portraitHome}'`, `local online_badge_home = '${badgeHome}'`,
      ...views, convert('./game_ui.lua', source => selectSource(source, internal))].join('\n\n');
  };
  const source = internal ? bundleRun(parse, true, render, clientLayout) : bundleRoom(parse, render, clientLayout);
  parse(source, { luaVersion: '5.3' });
  const graphs = [
    { graphId: ids.lobby, code: lobbySource },
    { graphId: ids.room, code: roomSource },
    { graphId: ids.roomFight, code: room.fightSource },
  ];
  if (internal) {
    const battle = nativeBattle(lua53, lua54, parse, catalogProfile);
    const [duel, duelFight] = duelGraphs(shop, battle, ids.duel, ids.duelFight, room.settings.STARTING_LIVES, true);
    const duelSource = gated(duel, [
      ".on('whenTimerIsTriggered', (event, f) => {", '.onSignal(request, (event, f) => {',
    ], 2);
    graphs.push({ graphId: ids.duel, code: duelSource }, { graphId: ids.duelFight, code: duelFight });
  }
  return {
    layout: clientLayout, source, roomSettings: room.settings,
    signals: internal ? signals : roomAndLobbySignals,
    playerVariables: internal ? playerVariables : lobbyVariables,
    shopRules: shop.rules, shopLevelThresholds: shop.levelThresholds, stockBaseLength: shop.start[0].length,
    shopCatalog: room.shopCatalog, graphs,
  };
}
