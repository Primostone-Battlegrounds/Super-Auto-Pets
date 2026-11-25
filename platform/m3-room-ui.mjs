import assert from 'node:assert/strict';
import fs from 'node:fs';
import { group, image, label, pigment } from './m1-ui.mjs';
import { bundleBattleReplay } from './m1-bundle.mjs';
import { standingsLayout } from './multiplayer-standings.mjs';

function button(name, x, y, width, height, text, primary = false) {
  return group(name, [x, y], [width, height], [
    image('Surface', [0, 0], [width, height], primary ? pigment.primary : pigment.chip),
    label('Text', [0, 0], [width - 10, height], text, 17, primary ? pigment.cream : pigment.ink),
    { name: 'Hit', kind: 'cursorArea', size: [width, height] },
  ]);
}

function inspectable(name, inspect, x, y, width, height) {
  const inspectWidth = 48;
  const main = button(name, x, y, width, height, '');
  main.children.find(c => c.name === 'Text').position = [-inspectWidth / 2, 0];
  main.children.find(c => c.name === 'Text').size = [width - inspectWidth - 10, height];
  main.children.find(c => c.name === 'Hit').position = [-inspectWidth / 2, 0];
  main.children.find(c => c.name === 'Hit').size = [width - inspectWidth, height];
  return [main, button(inspect, x + (width - inspectWidth) / 2, y, inspectWidth, height, '技能')];
}
const slots = [1, 2, 3, 4, 5];
const slotX = slot => (slot - 3) * 162;
const browse = [
  ['Reroll', '刷新货架'], ['Sell', '出售队员'], ['Merge', '合并队员'], ['Reward', '买升级奖励'],
  ['RewardNext', '下个奖励'],
];

export const m3RoomLayout = {
  name: 'AP_Room',
  script: 'm3_room_ui',
  showCursor: true,
  blockCursor: true,
  blockKeys: true,
  controls: [
    group('Match', [-139, 0], [866, 642], [
      image('Border', [0, 0], [866, 642], pigment.edge),
      image('Paper', [0, 0], [860, 636], pigment.canvas),
      label('Heading', [-207, 276], [412, 54], '八席淘汰赛', 33, pigment.ink, 'left'),
      label('Status', [0, 225], [820, 42], '连接房间中', 23, pigment.ink, 'left'),
      group('Shop', [0, 10], [832, 470], [
        label('Money', [0, 160], [810, 36], '', 22, pigment.ink, 'left'),
        ...slots.flatMap(slot => [
          ...(slot <= 3 ? inspectable(`Offer${slot}`, `InspectOffer${slot}`, slotX(slot), -7, 154, 80)
            : [button(`Offer${slot}`, slotX(slot), -7, 154, 80, '')]),
          button(`Freeze${slot}`, slotX(slot), -74, 154, 48, '冻结'),
          ...inspectable(`Team${slot}`, `InspectTeam${slot}`, -slotX(slot), 94, 154, 76),
        ]),
        ...browse.flatMap(([name, text], index) => name === 'Reward'
          ? inspectable(name, 'InspectReward', slotX(index + 1), -135, 154, 52)
          : [button(name, slotX(index + 1), -135, 154, 52, text)]),
        label('AbilityTitle', [0, -182], [810, 28], '点动物旁的「技能」查看', 18, pigment.ink, 'left'),
        label('AbilityBody', [0, -215], [810, 38], '', 17, pigment.ink, 'left'),
      ], false),
      group('Replay', [0, 10], [832, 370], [
        label('RoundText', [0, 144], [800, 66], '', 23, pigment.ink, 'left'),
        image('Ally', [-207, 24], [403, 143], pigment.rail),
        image('Enemy', [207, 24], [403, 143], pigment.opposingRail),
        ...slots.flatMap(slot => [
          label(`Own${slot}`, [-48 - (slot - 1) * 80, 24], [78, 112], '', 14, pigment.ink),
          label(`Enemy${slot}`, [48 + (slot - 1) * 80, 24], [78, 112], '', 14, pigment.ink),
        ]),
        label('Event', [0, -72], [800, 50], '', 18, pigment.ink),
        ...[['Previous', '上一帧'], ['Forward', '下一帧'], ['Auto', '暂停'], ['Follow', '追到最新']]
          .map(([name, text], index) => button(name, (index - 1.5) * 202, -133, 188, 52, text)),
      ], false),
      button('Refresh', -327, -254, 164, 48, '同步 · E'),
      button('Ready', -131, -254, 182, 48, '准备 · F', true),
      button('Forfeit', 327, -254, 164, 48, '认输'),
      label('Hint', [0, -302], [810, 32], '正在读取房间状态', 17, pigment.muted, 'left'),
    ]),
    standingsLayout('room', { position: [452, 0] }),
  ],
};

function catalogLua(items) {
  return Object.entries(items).map(([rawCode, value]) => {
    const code = Array.isArray(items) ? Number(rawCode) + 1 : Number(rawCode);
    assert.ok(Number.isInteger(code) && code > 0 && code < 10000);
    const name = typeof value === 'string' ? value : value.name;
    assert.ok(/^[\p{L}\p{N}_ ·（）-]+$/u.test(name));
    const attack = value.attack ?? 0;
    const health = value.health ?? 0;
    assert.ok(Number.isSafeInteger(attack) && Number.isSafeInteger(health));
    return `[${code}]={name="${name}",attack=${attack},health=${health}}`;
  }).join(',');
}

export function roomClientSource(template, { pet, food, battle = pet }) {
  const shared = fs.readFileSync(new URL('./multiplayer_standings.lua', import.meta.url), 'utf8');
  return [
    `local standings = (function()\n${shared}\nend)()`,
    `local pets = {${catalogLua(pet)}}`, `local foods = {${catalogLua(food)}}`,
    `local fighters = {${catalogLua(battle)}}`, template,
  ].join('\n\n');
}

export function m3RoomUiSource(catalog, parse, release = false) {
  return roomClientSource(bundleBattleReplay(parse, './m3_room_ui.lua', release), catalog);
}
