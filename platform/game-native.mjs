import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bundleRun } from './m1-bundle.mjs';
import { button, group, image, label, nativeRun, pigment } from './m1-ui.mjs';
import { duelClientSource, duelGraphs, duelLayout, duelSignals, duelVariables } from './m2-duel-native.mjs';
import { nativeBattle } from './m3-battle-opening.mjs';
import { nativeRoom, roomSignals } from './m3-room-native.mjs';
import { roomClientSource, unifiedRoomLayout } from './m3-room-ui.mjs';
import { nativeShop } from './versus-shop.mjs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

export const stageVariables = ['AP_GameMode', 'AP_RoomTicket'];
export const playerVariables = duelVariables;
export const signals = {
  AP_GameChooseMode: [{ name: 'mode', type: 'integer' }, { name: 'fill', type: 'boolean' }],
  AP_GameLobby: ['mode', 'present', 'waiting', 'requested', 'reason'].map(name => ({ name, type: 'integer' })),
  ...roomSignals,
  ...Object.fromEntries(Object.entries(duelSignals).map(([name, fields]) =>
    [name, fields.map(([parameter, type]) => ({ name: parameter, type }))])),
};

export const gameScript = 'auto_pets_game';
export const gameInterface = 'AutoPetsGame';
export const practiceSeed = 8;

const back = (x, y) => button('Back', [x, y], [156, 48], '返回主菜单');
const modeButton = (name, y, title, primary = false) => button(name, [0, y], [386, 82], title, primary, 24);
const view = (name, controls) => ({ ...group(name, [0, 0], [1280, 720], controls, false), active: false });

function layout(duelRules) {
  const practice = nativeRun.controls.map(control => {
    if (/^Enemy[1-5]$/u.test(control.name)) {
      return { ...control, children: control.children.filter(child => child.name !== 'Portrait') };
    }
    if (control.name !== 'Menu') return control;
    return { ...control, children: [...control.children.map(child => {
      if (child.name === 'Heading') return { ...child, text: { ...child.text, content: '单人 AI 练习' } };
      return child;
    }), back(425, -261)] };
  });
  return {
    name: gameInterface, script: gameScript, showCursor: true, blockCursor: true, blockKeys: true,
    controls: [
      { ...image('GameBackdrop', [0, 0], [1, 1], '#587454'), anchor: { min: [0, 0], max: [1, 1] } },
      group('Lobby', [0, 0], [1280, 720], [
        image('Border', [0, 0], [652, 596], '#3c5140'),
        image('Paper', [0, 4], [640, 580], '#fff3d9'),
        label('Title', [0, 221], [560, 76], '小动物自走棋', 52),
        label('Status', [0, 158], [560, 43], '正在连接千星关卡', 24, pigment.muted),
        group('Choices', [0, -5], [396, 270], [
          modeButton('Room', 92, '八人吃鸡', true),
          modeButton('Duel', 0, '好友 1v1'),
          modeButton('Practice', -92, '单人 AI 练习'),
        ]),
        { ...modeButton('Continue', -5, '', true), visible: false, active: false },
        label('Help', [0, -228], [586, 66], '好友 1v1 请先在千星好友房间邀请好友。', 20, pigment.muted),
        label('Feedback', [0, -165], [586, 44], '', 19, pigment.gold),
      ]),
      view('Practice', practice),
      view('Duel', [...duelLayout(duelRules).controls, back(221, 278)]),
      view('Room', [...unifiedRoomLayout.controls, back(-145, 276)]),
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

export function nativeGame(lua53, lua54, parse, ids, artPreview) {
  const profile = 'release';
  const shop = nativeShop(lua53, lua54, profile);
  const battle = nativeBattle(lua53, lua54, parse, profile);
  if (artPreview) {
    const catalog = shop.catalog.pet.map((pet, index) => {
      const id = battle.ids[index];
      assert.ok(id);
      return { id, name: artPreview.animals[id]?.name ?? artPreview.commonNames.pet_by_id[id] ?? pet.name };
    });
    assert.equal(new Set(catalog.map(pet => pet.id)).size, catalog.length);
    artPreview = { ...artPreview, catalog };
  }
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
    const duelUi = duelClientSource(convert('./m2_probe.lua'), shop)
      .replace('local root, offers = script.object, script.object',
        'local root, offers = view_root, view_root:GetChild("MarketOffers")');
    const duel = wrap('duel_view', duelUi, {
      start: 'OnStart', update: 'OnUpdate', destroy: 'OnDestroy', refresh: 'request_snapshot', redraw: 'redraw',
    }, 'view_root');
    const roomUi = roomClientSource(convert('./m3_room_ui.lua'), room.shopCatalog);
    const versus = wrap('room_view', roomUi, {
      start: 'OnStart', update: 'OnUpdate', destroy: 'OnDestroy', refresh: 'refresh', redraw: 'redraw',
    });
    return [practice, duel, versus, convert('./game_ui.lua')].join('\n\n');
  }, clientLayout, artPreview);
  parse(source, { luaVersion: '5.3' });
  return {
    layout: clientLayout, source, roomSettings: room.settings, artPreview,
    shopRules: shop.rules, shopLevelThresholds: shop.levelThresholds, stockBaseLength: shop.start[0].length,
    petTierCounts: shop.petTierCounts,
    graphs: [
      { graphId: ids.lobby, code: lobbySource }, { graphId: ids.duel, code: duelSource },
      { graphId: ids.duelFight, code: duelFight }, { graphId: ids.room, code: roomSource },
      { graphId: ids.roomFight, code: room.fightSource },
    ],
  };
}
