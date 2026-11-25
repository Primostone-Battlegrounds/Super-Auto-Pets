import assert from 'node:assert/strict';
import fs from 'node:fs';
import { group, image, label, pigment, terrain } from './m1-ui.mjs';
import { bundleBattleReplay } from './m1-bundle.mjs';
import { clearingColours as clearing, labelFront, onlineBadgeSource, standingsLayout } from './multiplayer-standings.mjs';

const slots = [1, 2, 3, 4, 5];
const slotX = slot => (slot - 3) * 162;
const shopActionsY = -276;
const browse = [
  ['Reroll', '刷新货架'], ['Sell', '出售队员'], ['Merge', '合并队员'], ['Reward', '买升级奖励'],
  ['RewardNext', '下个奖励'],
];

function roomLayout(unified) {
  function button(name, x, y, width, height, text, primary = false, fontSize = 17, fill = pigment.chip, art) {
    const size = [width, height];
    const captionSize = [width - 10, height];
    const captionPosition = [0, 0];
    const visualSize = [...size];
    const inspect = unified && name.startsWith('Inspect');
    let surface = unified
      ? (inspect ? terrain('Surface', [0, -13], [width, 34], clearing.teal)
        : image('Surface', [0, 0], size, primary ? '#ffffff' : '#c9eadf', { image: primary ? 107015 : 107034 }))
      : image('Surface', [0, 0], size, primary ? '#206258' : pigment.chip);
    if (inspect) captionPosition[1] = -13;
    if (unified && art) {
      const team = art === 'team';
      surface = terrain('Surface', [0, 3], [width - 20, 32], team ? clearing.recess : fill);
      captionSize[1] = team ? 60 : 52;
      captionPosition[1] = team ? -11 : -16;
      visualSize[1] = team ? 128 : 110;
      fontSize = 21;
    }
    const ink = unified && !primary && !art ? '#fff7de'
      : primary ? (unified ? '#372917' : pigment.cream) : pigment.ink;
    return group(name, [x, y], visualSize, [
      surface,
      label('Text', captionPosition, captionSize, text, fontSize, ink),
      { name: 'Hit', kind: 'cursorArea', size },
    ]);
  }

  function inspectable(name, inspect, x, y, width, height, fill = pigment.chip, art) {
    const inspectWidth = 48;
    const main = button(name, x, y, width, height, '', false, 17, fill, art);
    const caption = main.children.find(c => c.name === 'Text');
    caption.position[0] = -inspectWidth / 2;
    caption.size[0] = width - inspectWidth - 10;
    main.children.find(c => c.name === 'Hit').position = [-inspectWidth / 2, 0];
    main.children.find(c => c.name === 'Hit').size = [width - inspectWidth, height];
    if (unified && art) {
      const surface = main.children.find(control => control.name === 'Surface');
      surface.position[0] = -inspectWidth / 2;
      surface.size[0] = width - inspectWidth - 12;
    }
    return [main, button(inspect, x + (width - inspectWidth) / 2, y, inspectWidth, height,
      '技能', false, unified ? 16 : 17, '#b8d9c8')];
  }

  return {
    name: 'AP_Room',
    script: 'm3_room_ui',
    showCursor: true,
    blockCursor: true,
    blockKeys: true,
    controls: [
      group('Match', [-139, 0], [866, 642], [
        image('Border', [0, 0], [866, 642], pigment.edge),
        image('Paper', [0, 0], [860, 636], pigment.canvas),
        label('Heading', unified ? [-277, 276] : [-207, 276], [unified ? 270 : 412, 54],
          '八席淘汰赛', unified ? 35 : 33, pigment.ink, 'left'),
        label('Status', [0, 225], [820, 42], '连接房间中', 23, pigment.ink, 'left'),
        group('Shop', [0, unified ? 0 : 10], [832, unified ? 640 : 470], [
          ...(unified ? [
            image('Sky', [0, 31], [828, 326], clearing.sky),
            terrain('GroveLeft', [-152, 112], [522, 141], clearing.grove),
            terrain('GroveRight', [178, 112], [466, 126], clearing.groveLight),
            image('Turf', [0, -53], [828, 158], clearing.ground),
            labelFront('TeamFront', [334, 171], '前排 ›'),
          ] : []),
          label('Money', [0, unified ? 174 : 160], [810, 36], '', unified ? 25 : 22, pigment.ink, 'left'),
          ...slots.flatMap(slot => [
            ...(slot <= 3 ? inspectable(`Offer${slot}`, `InspectOffer${slot}`, slotX(slot), -7, 154, unified ? 96 : 80, clearing.nearTrack, 'offer')
              : [button(`Offer${slot}`, slotX(slot), -7, 154, unified ? 96 : 80, '', false, 17, clearing.farTrack, 'offer')]),
            button(`Freeze${slot}`, slotX(slot), unified ? -80 : -74, 154, 48, '冻结', false, 19),
            ...inspectable(`Team${slot}`, `InspectTeam${slot}`, -slotX(slot), unified ? 103 : 94, 154, unified ? 96 : 76, pigment.rail, 'team'),
          ]),
          ...browse.flatMap(([name, text], index) => {
            if (unified && name === 'Reroll') return [button(name, -310, shopActionsY, 206, 82, text, true, 24)];
            const x = unified ? (index - 2.5) * 192 : slotX(index + 1);
            const y = unified ? -204 : -135;
            return name === 'Reward' ? inspectable(name, 'InspectReward', x, y, 154, 52)
              : [button(name, x, y, 154, 52, text, false, unified ? 19 : 17)];
          }),
          label('AbilityTitle', [0, unified ? -124 : -182], [810, unified ? 32 : 28], '点动物旁的「技能」查看', unified ? 22 : 18,
            unified ? '#65441d' : pigment.ink, 'left'),
          label('AbilityBody', [0, unified ? -155 : -215], [810, 38], '', unified ? 20 : 17, pigment.ink, 'left'),
        ], false),
        group('Replay', [0, 10], [832, unified ? 426 : 370], [
          label('RoundText', [0, unified ? 164 : 144], [800, 66], '', unified ? 25 : 23, pigment.ink, 'left'),
          ...(unified ? [
            image('Meadow', [0, 44], [820, 216], clearing.sky),
            terrain('Canopy', [178, 83], [452, 132], clearing.groveLight),
          ] : []),
          ...(unified ? [
            terrain('Ally', [-33, 50], [740, 173], clearing.grove),
            image('Enemy', [0, -4], [820, 122], clearing.grass),
            labelFront('OwnFront', [-65, 123], '己方前排 ›'),
            labelFront('EnemyFront', [65, 123], '‹ 对方前排'),
          ] : [
            image('Ally', [-207, 24], [403, 143], pigment.rail),
            image('Enemy', [207, 24], [403, 143], pigment.opposingRail),
          ]),
          ...slots.flatMap(slot => [
            label(`Own${slot}`, [-48 - (slot - 1) * 80, unified ? 31 : 24], [unified ? 80 : 78, 112], '', unified ? 19 : 14, pigment.ink),
            label(`Enemy${slot}`, [48 + (slot - 1) * 80, unified ? 31 : 24], [unified ? 80 : 78, 112], '', unified ? 19 : 14, pigment.ink),
          ]),
          label('Event', [0, unified ? -85 : -72], [800, unified ? 42 : 50], '', unified ? 22 : 18, unified ? '#65441d' : pigment.ink),
          ...[['Previous', '上一帧'], ['Forward', '下一帧'], ['Auto', '暂停'], ['Follow', '追到最新']]
            .map(([name, text], index) => button(name, (index - 1.5) * 202, unified ? -155 : -133,
              188, unified ? 82 : 52, text, false, unified ? 23 : 17)),
        ], false),
        unified ? button('Refresh', 159, 276, 152, 48, '同步 · E') : button('Refresh', -327, -254, 164, 48, '同步 · E'),
        unified ? button('Ready', 310, shopActionsY, 206, 82, '准备 · F', true, 24)
          : button('Ready', -131, -254, 182, 48, '准备 · F', true),
        unified ? button('Forfeit', 327, 276, 164, 48, '认输') : button('Forfeit', 327, -254, 164, 48, '认输'),
        label('Hint', [0, unified ? shopActionsY : -302], unified ? [388, 72] : [810, 32], '正在读取房间状态',
          unified ? 20 : 17, pigment.muted, unified ? 'centre' : 'left'),
      ]),
      standingsLayout('room', { position: [452, 0], themed: unified }),
    ],
  };
}

export const m3RoomLayout = roomLayout(false);
export const unifiedRoomLayout = roomLayout(true);

function catalogLua(items) {
  return Object.entries(items).map(([rawCode, value]) => {
    const code = Array.isArray(items) ? Number(rawCode) + 1 : Number(rawCode);
    assert.ok(Number.isInteger(code) && code > 0 && code < 10000);
    const name = typeof value === 'string' ? value : value.name;
    assert.ok(/^[\p{L}\p{N}_ ·（）-]+$/u.test(name));
    const attack = value.attack ?? 0;
    const health = value.health ?? 0;
    assert.ok(Number.isSafeInteger(attack) && Number.isSafeInteger(health));
    if (value.id) assert.match(value.id, /^[a-z][a-z0-9_]*$/);
    const id = value.id ? `,id="${value.id}"` : '';
    return `[${code}]={name="${name}",attack=${attack},health=${health}${id}}`;
  }).join(',');
}

export function roomClientSource(template, { pet, food, battle = pet }) {
  const shared = fs.readFileSync(new URL('./multiplayer_standings.lua', import.meta.url), 'utf8');
  return [
    onlineBadgeSource,
    `local standings = (function()\n${shared}\nend)()`,
    `local pets = {${catalogLua(pet)}}`, `local foods = {${catalogLua(food)}}`,
    `local fighters = {${catalogLua(battle)}}`, template,
  ].join('\n\n');
}

export function m3RoomUiSource(catalog, parse, release = false) {
  return roomClientSource(bundleBattleReplay(parse, './m3_room_ui.lua', release), catalog);
}
