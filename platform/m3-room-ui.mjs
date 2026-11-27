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
    const inspectY = name === 'InspectReward' ? 0 : -13;
    const lake = name.startsWith('Freeze') || ['Previous', 'Forward', 'Auto', 'Follow'].includes(name);
    let surface = unified
      ? (inspect ? terrain('Surface', [0, inspectY], [width, 34], clearing.teal)
        : primary || lake ? image('Surface', [0, 0], size, primary ? '#fff5da' : '#719486', { image: primary ? 107015 : 107012 })
          : terrain('Surface', [0, 0], size, '#486c53'))
      : image('Surface', [0, 0], size, primary ? '#206258' : pigment.chip);
    if (inspect) {
      captionPosition[1] = inspectY;
      captionSize[1] = 34;
    }
    if (unified && art) {
      const team = art === 'team';
      surface = terrain('Surface', [0, 3], [width - 20, 32], team ? clearing.recess : fill);
      captionSize[1] = team ? 33 : 52;
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
    caption.size[0] = width - inspectWidth - (unified && art === 'team' ? 0 : 10);
    main.children.find(c => c.name === 'Hit').position = [-inspectWidth / 2, 0];
    main.children.find(c => c.name === 'Hit').size = [width - inspectWidth, height];
    if (unified && art) {
      const surface = main.children.find(control => control.name === 'Surface');
      surface.position[0] = -inspectWidth / 2;
      surface.size[0] = width - inspectWidth - 12;
    }
    return [main, button(inspect, x + (width - inspectWidth) / 2, y, inspectWidth, height,
      art === 'food' ? '详情' : '技能', false, unified ? 16 : 17, '#b8d9c8')];
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
            image('ShopCloud', [234, 157], [114, 26], '#fffaf0', { image: 105102 }),
            image('GroveLeft', [-300, 100], [214, 91], '#f6fbec', { image: 105135 }),
            image('GroveRight', [322, 97], [171, 104], '#fff9e5', { image: 105136 }),
            image('Turf', [0, -53], [828, 158], clearing.ground),
            labelFront('TeamFront', [334, 171], '前排 ›'),
          ] : []),
          label('Money', [0, unified ? 174 : 160], [810, 36], '', unified ? 25 : 22, pigment.ink, 'left'),
          ...slots.flatMap(slot => [
            ...(slot <= 3 || unified ? inspectable(`Offer${slot}`, `InspectOffer${slot}`, slotX(slot), -7, 154,
              unified ? 96 : 80, slot <= 3 ? clearing.nearTrack : clearing.farTrack, slot <= 3 ? 'offer' : 'food')
              : [button(`Offer${slot}`, slotX(slot), -7, 154, 80, '', false, 17, clearing.farTrack, 'offer')]),
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
          label('AbilityTitle', [0, unified ? -124 : -182], [810, unified ? 32 : 28],
            unified ? '点「技能」或「详情」查看' : '点动物旁的「技能」查看', unified ? 22 : 18,
            unified ? '#65441d' : pigment.ink, 'left'),
          label('AbilityBody', [0, unified ? -155 : -215], [810, 38], '', unified ? 20 : 17, pigment.ink, 'left'),
        ], false),
        ...(unified ? [
          group('Settlement', [0, 10], [832, 426], [
            image('Paper', [0, 0], [820, 414], '#f7eed7'),
            label('Placement', [0, 88], [774, 84], '', 55, clearing.ink),
            label('Summary', [0, 6], [774, 56], '', 26, pigment.ink),
            label('ReplayGuide', [0, -86], [774, 42], '', 22, pigment.muted),
            label('RestartGuide', [0, -135], [774, 52], '在千星房间选择「重新挑战」可再开一局', 22, pigment.muted),
          ], false),
          { ...button('ResultReplay', 0, shopActionsY, 260, 82, '回看最后一战', true, 24), visible: false, active: false },
        ] : []),
        group('Replay', [0, 10], [832, unified ? 426 : 370], [
          ...(unified ? [
            image('Meadow', [0, 22], [820, 228], clearing.grass),
            image('FarCloud', [292, 112], [183, 42], '#fffaf0', { image: 105102 }),
            image('Pine', [-385, 96], [42, 78], '#8ca98d', { image: 105098 }),
            image('Canopy', [-296, 90], [218, 91], '#f6fbec', { image: 105135 }),
          ] : []),
          label('RoundText', [0, unified ? 173 : 144], [800, unified ? 58 : 66], '', 23, pigment.ink, 'left'),
          ...(unified ? [
            terrain('Enemy', [130, 27], [560, 114], clearing.enemyLane),
            terrain('Ally', [-130, 32], [560, 114], clearing.ownLane),
            labelFront('OwnFront', [-65, 120], '己方前排 ›'),
            labelFront('EnemyFront', [65, 120], '‹ 对方前排'),
          ] : [
            image('Ally', [-207, 24], [403, 143], pigment.rail),
            image('Enemy', [207, 24], [403, 143], pigment.opposingRail),
          ]),
          ...slots.flatMap(slot => [
            label(`Own${slot}`, [-48 - (slot - 1) * 80, unified ? 31 : 24], [unified ? 80 : 78, 112], '', unified ? 19 : 14, pigment.ink),
            label(`Enemy${slot}`, [48 + (slot - 1) * 80, unified ? 31 : 24], [unified ? 80 : 78, 112], '', unified ? 19 : 14, pigment.ink),
          ]),
          label('Event', [0, unified ? -107 : -72], [800, unified ? 32 : 50], '', unified ? 19 : 18, unified ? '#65441d' : pigment.ink),
          ...[['Previous', '上一帧'], ['Forward', '下一帧'], ['Auto', '暂停'], ['Follow', '追到最新']]
            .map(([name, text], index) => button(name, (index - 1.5) * 202, unified ? -170 : -133,
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
