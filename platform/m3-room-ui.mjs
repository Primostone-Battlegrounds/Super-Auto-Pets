import assert from 'node:assert/strict';
import fs from 'node:fs';
import { group, image, label, pigment, preparationBadge, preparationColours as prep, terrain } from './m1-ui.mjs';
import { bundleBattleReplay } from './m1-bundle.mjs';
import { clearingColours as clearing, labelFront, onlineBadgeSource, standingsLayout } from './multiplayer-standings.mjs';

const slots = [1, 2, 3, 4, 5];
const slotX = slot => (slot - 3) * 162;
const marketX = [-327, -180, -33, 146, 293];
const shopActionsY = -272;
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
    if (unified && art) {
      const team = art === 'team';
      const badgeSize = team ? [122, 48] : [76, 34];
      const badgePosition = team ? [x, y + 74] : [x - 36, y + 64];
      return [
        button(name, x, y, width, height, '', false, 17, fill, art),
        group(inspect, badgePosition, badgeSize, [
          image('Surface', [0, 0], badgeSize, prep.badgePaper),
          preparationBadge('Text', [0, 0], badgeSize),
          { name: 'Hit', kind: 'cursorArea', size: badgeSize },
        ]),
      ];
    }
    const inspectWidth = 48;
    const main = button(name, x, y, width, height, '', false, 17, fill, art);
    const caption = main.children.find(c => c.name === 'Text');
    caption.position[0] = -inspectWidth / 2;
    caption.size[0] = width - inspectWidth - 10;
    main.children.find(c => c.name === 'Hit').position = [-inspectWidth / 2, 0];
    main.children.find(c => c.name === 'Hit').size = [width - inspectWidth, height];
    return [main, button(inspect, x + (width - inspectWidth) / 2, y, inspectWidth, height,
      '技能', false, unified ? 16 : 17, '#b8d9c8')];
  }

  const buildStock = slot => {
    const offerX = unified ? marketX[slot - 1] : slotX(slot);
    const offerY = unified ? -101 : -7;
    const offerWidth = unified ? 145 : 154;
    const offerHeight = unified ? 94 : 80;
    const freeze = button(`Freeze${slot}`, offerX, unified ? -189 : -74,
      unified ? 123 : 154, unified ? 82 : 48, '冻结', false, 19);
    return [
      ...(slot <= 3
        ? inspectable(`Offer${slot}`, `InspectOffer${slot}`, offerX, offerY, offerWidth, offerHeight, clearing.nearTrack, 'offer')
        : [button(`Offer${slot}`, offerX, offerY, offerWidth, offerHeight, '', false, 17, clearing.farTrack, 'offer')]),
      ...(unified && slot > 3 ? [preparationBadge(`OfferTier${slot}`, [offerX - 36, offerY + 64], [76, 34])] : []),
      unified ? { ...freeze, visible: false, active: false } : freeze,
      ...inspectable(`Team${slot}`, `InspectTeam${slot}`, -slotX(slot), unified ? 122 : 94, 154,
        unified ? 92 : 76, pigment.rail, 'team'),
    ];
  };

  return {
    name: 'AP_Room',
    script: 'm3_room_ui',
    showCursor: true,
    blockCursor: true,
    blockKeys: true,
    controls: [
      group('Match', [-139, 0], [866, 642], [
        image('Border', [0, 0], [866, 642], pigment.edge),
        image('Paper', [0, 0], [860, 636], unified ? prep.header : pigment.canvas),
        {
          ...label('Heading', unified ? [-259, 278] : [-207, 276], [unified ? 286 : 412, 54],
            '八席淘汰赛', unified ? 26 : 33, pigment.ink, 'left'),
          active: !unified,
          visible: !unified,
        },
        group('Shop', [0, unified ? 0 : 10], [832, unified ? 640 : 470], [
          ...(unified ? [
            image('Sky', [0, 125], [832, 250], prep.grass),
            image('ShopCloud', [228, 215], [114, 26], '#f8f4d4', { image: 105102 }),
            image('GroveLeft', [-311, 179], [154, 64], prep.grassDark, { image: 105135 }),
            image('GroveRight', [318, 75], [169, 51], prep.grassLight, { image: 105136 }),
            image('Turf', [0, -156], [832, 312], prep.shelf),
            labelFront('TeamFront', [339, 228], '前排 ›'),
          ] : []),
          label('Money', unified ? [-254, 282] : [0, 160], unified ? [302, 48] : [810, 36], '', 22,
            pigment.ink, 'left'),
          ...slots.flatMap(buildStock),
          ...browse.flatMap(([name, text], index) => {
            if (unified && name === 'Reroll') return [button(name, -310, shopActionsY, 206, 82, '刷新', true, 24)];
            const [x, y] = unified
              ? [[0, 0], [0, 31], [-205, 31], [288, 8], [114, 8]][index]
              : [slotX(index + 1), -135];
            if (name === 'Reward') return inspectable(name, 'InspectReward', x, y, 154, 52);
            const action = button(name, x, y, 154, unified ? 82 : 52, text, false, unified ? 19 : 17);
            return [unified ? { ...action, visible: false, active: false } : action];
          }),
          label('AbilityTitle', unified ? [-209, 40] : [0, -182], unified ? [394, 34] : [810, 28], '查看动物技能', unified ? 21 : 18,
            unified ? '#65441d' : pigment.ink, 'left'),
          label('AbilityBody', unified ? [-209, 9] : [0, -215], unified ? [394, 48] : [810, 38], '', unified ? 18 : 17,
            pigment.ink, 'left'),
        ], false),
        label('Status', unified ? [-125, 244] : [0, 225], unified ? [530, 32] : [820, 42],
          '连接房间中', unified ? 19 : 23, pigment.ink, 'left'),
        group('Replay', [0, 10], [832, unified ? 518 : 370], [
          ...(unified ? [
            image('Meadow', [0, 22], [820, 228], clearing.grass),
            image('FarCloud', [292, 112], [183, 42], '#fffaf0', { image: 105102 }),
            image('Pine', [-385, 96], [42, 78], '#8ca98d', { image: 105098 }),
            image('Canopy', [-296, 90], [218, 91], '#f6fbec', { image: 105135 }),
          ] : []),
          label('RoundText', [0, unified ? -193 : 144], [800, 66], '', 23, pigment.ink, 'left'),
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
          label('Event', [0, unified ? -142 : -72], [800, unified ? 32 : 50], '', unified ? 19 : 18, unified ? '#65441d' : pigment.ink),
          ...[['Previous', '上一帧'], ['Forward', '下一帧'], ['Auto', '暂停'], ['Follow', '追到最新']]
            .map(([name, text], index) => {
              if (!unified) return button(name, (index - 1.5) * 202, -133, 188, 52, text);
              const x = name === 'Auto' ? -151 : name === 'Follow' ? 151 : 0;
              return name === 'Previous'
                ? { ...button(name, -290, -170, 142, 82, text), visible: false, active: false }
                : button(name, x, 175, 142, 82, text, false, 23);
            }),
        ], false),
        unified ? button('Refresh', 159, 276, 152, 48, '同步 · E') : button('Refresh', -327, -254, 164, 48, '同步 · E'),
        unified ? button('Ready', 310, shopActionsY, 206, 82, '准备开战', true, 24)
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
