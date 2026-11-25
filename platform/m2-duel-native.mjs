import assert from 'node:assert/strict';
import fs from 'node:fs';
import { image, pigment, terrain } from './m1-ui.mjs';
import { bindFaintColumns, faintArguments } from './m3-battle-opening.mjs';

export const duelSignals = {
  AP_DuelRequest: ['action', 'round', 'sequence', 'token', 'from', 'to', 'flag'].map(name => [name, 'integer']),
  AP_DuelSnapshot: [
    ['players', 'integer'], ['seat', 'integer'], ['round', 'integer'], ['phase', 'integer'],
    ['ready', 'boolean'], ['continued', 'boolean'], ['settlements', 'integer'], ['version', 'integer'],
    ['sequence', 'integer'], ['winner', 'integer'], ['reason', 'integer'], ['remaining', 'integer'], ['ack', 'integer'],
    ['lives', 'integer'], ['opponentLives', 'integer'], ['outcome', 'integer'],
  ],
  AP_DuelMarket: [['round', 'integer'], ['version', 'integer'], ['state', 'integerList']],
  AP_DuelFightStart: [['round', 'integer'], ['attempt', 'integer'], ['seed', 'integer'],
    ['first', 'integerList'], ['second', 'integerList']],
  AP_DuelFightCancel: [['attempt', 'integer']],
  AP_DuelReplay: [['round', 'integer'], ['seed', 'integer'], ['outcome', 'integer'],
    ['first', 'integerList'], ['second', 'integerList']],
};
export const duelVariables = ['AP_readyRound', 'AP_continueRound', 'AP_shopSeat', 'AP_shopRound', 'AP_sequence'];
export const duelProbeButtons = [
  { name: 'AP_NativeRefresh', label: '1 刷新状态' },
  { name: 'AP_NativeReady', label: '2 准备' },
  { name: 'AP_NativeNext', label: '3 下一轮' },
  ...Array.from({ length: 3 }, (_, index) => {
    const slot = index + 1;
    return {
      name: `AP_NativeBuy${slot}`, label: `${index + 4} · 货位${slot}`,
    };
  }),
  { name: 'AP_NativeReroll', label: '7 · 刷新货架' },
].map((button, index) => ({ ...button, position: [(index - 3) * 145, -228],
  placeholder: String(1073741901 + index), key: index + 1 }));
function text(name, position, size, content, fontSize = 23, colour = '#fff3d7') {
  return { name, kind: 'text', position, size, text: { content, fontSize, colour, align: 'centre', valign: 'middle', autoSize: true, minFontSize: 16 } };
}
function card(action, label, position, size, content, { fill, ink, sprite, portrait, inset = 0, compact = false }, fontSize = 18) {
  const caption = text(label, position, size, content, fontSize, ink);
  if (sprite || portrait || compact) caption.text.outline = false;
  let face = image(`${action}Face`, position, size, fill, sprite && { image: sprite });
  if (portrait) {
    caption.position = [position[0], position[1] - 23];
    caption.size = [size[0], 50];
    caption.text.fontSize = 18;
    face = terrain(`${action}Face`, [position[0] - inset, position[1] - 10], [size[0] - 2 * inset - 12, 47], fill);
  } else if (compact) {
    face = sprite
      ? image(`${action}Face`, position, [size[0] - 14, 33], fill, { image: sprite })
      : terrain(`${action}Face`, position, [size[0], 34], fill);
    caption.size = [size[0], 34];
  }
  return [
    face,
    caption,
    { name: action, kind: 'cursorArea', position, size },
  ];
}
function inspectable(action, label, position, size, style, inspect, inspectStyle, fontSize = 18) {
  const controls = card(action, label, position, size, '', style, fontSize);
  controls[1].position = [position[0] - 22, controls[1].position[1]];
  controls[1].size = [size[0] - 44, controls[1].size[1]];
  controls[2].position = [position[0] - 22, position[1]];
  controls[2].size = [size[0] - 44, size[1]];
  return [...controls, ...card(inspect, `${inspect}Label`, [position[0] + size[0] / 2 - 22, position[1]],
    [44, size[1]], '技能', inspectStyle, 16)];
}

const plain = fill => ({ fill });
const parchment = fill => ({ fill, ink: '#243c3b', sprite: 107102 });
const gold = { fill: '#ffffff', ink: '#372917', sprite: 107015 };
const navy = { fill: '#ffffff', ink: '#fff7de', sprite: 107034 };
const dock = (fill, inset) => ({ fill, ink: '#243c3b', portrait: true, inset });

export function duelLayout(rule, includeProbeButtons = false) {
  const script = 'm2_probe';
  const teamStyle = includeProbeButtons ? plain('#335b44') : dock('#89ad78', 22);
  const petStyle = includeProbeButtons ? plain('#335b44') : dock('#cba76e', 22);
  const foodStyle = includeProbeButtons ? plain('#605432') : dock('#dcb67a', 0);
  const secondaryStyle = includeProbeButtons ? plain('#286452') : parchment('#e8f2e4');
  const inspectStyle = includeProbeButtons ? plain('#416c59') : { fill: '#39695b', ink: '#fff7de', compact: true };
  const freezeStyle = includeProbeButtons ? secondaryStyle : { ...navy, compact: true };
  const statusInk = includeProbeButtons ? '#fff3d7' : '#fff7de';
  const accentInk = includeProbeButtons ? '#ffd887' : '#5b3f21';
  const replayInk = includeProbeButtons ? statusInk : pigment.ink;
  const shelfX = index => includeProbeButtons ? (index - 2) * 190 : (index - 2) * 168 - 83;
  const rosterY = includeProbeButtons ? 120 : 135;
  const stockY = includeProbeButtons ? 42 : 29;
  const slotWidth = includeProbeButtons ? 174 : 156;
  const stock = Array.from({ length: rule.PET_SLOTS + rule.FOOD_SLOTS }, (_, index) => {
    const x = shelfX(index);
    const pet = index < rule.PET_SLOTS;
    const slot = index + 1 - (pet ? 0 : rule.PET_SLOTS);
    const name = pet ? 'Pet' : 'Food';
    const position = [x, stockY];
    const size = [slotWidth, includeProbeButtons ? 66 : 94];
    return [
      ...(pet ? inspectable(`Buy${slot}`, `OfferLabel${slot}`, position, size, petStyle, `InspectPet${slot}`, inspectStyle)
        : card(`Food${slot}`, `FoodLabel${slot}`, position, size, '', foodStyle)),
      ...card(`Freeze${name}${slot}`, `Freeze${name}Label${slot}`, [x, includeProbeButtons ? -13 : -53],
        [slotWidth, 44], '冻结', freezeStyle, 19),
    ];
  }).flat();
  const teamCards = Array.from({ length: rule.TEAM_SIZE }, (_, index) => inspectable(`Team${index + 1}`, `TeamLabel${index + 1}`,
    [shelfX(4 - index), rosterY], [slotWidth, includeProbeButtons ? 56 : 86], teamStyle,
    `InspectTeam${index + 1}`, inspectStyle, 20));
  const shopActions = [['Reroll', '刷新货架'], ['Sell', '出售选中'], ['Merge', '合并模式'], ['Ready', '准备'], ['Advance', '下一轮']];
  const shopButtons = shopActions.flatMap(([name, content], index) => {
    if (!includeProbeButtons && (name === 'Reroll' || name === 'Ready')) {
      return card(name, `${name}Label`, [name === 'Reroll' ? -393 : 393, -232], [224, 82], content, gold, 25);
    }
    if (!includeProbeButtons) {
      const position = name === 'Advance' ? [418, -234] : [name === 'Sell' ? -416 : -231, -122];
      return card(name, `${name}Label`, position, name === 'Advance' ? [206, 82] : [161, 45],
        content, name === 'Advance' ? gold : secondaryStyle);
    }
    return card(name, `${name}Label`, [(index - 2) * 190, -65], [174, 52], content, secondaryStyle);
  });
  return {
    name: 'AP_DuelProbe',
    script,
    showCursor: true,
    blockCursor: false,
    controls: [
      image('Background', [0, 0], includeProbeButtons ? [1000, 710] : [1120, 674], includeProbeButtons ? '#193931' : '#214943'),
      ...(!includeProbeButtons ? [
        image('ShopSky', [0, 130], [1064, 228], '#c4dcc0', { visible: false }),
        image('ShopGround', [0, -45], [1064, 144], '#edca89', { visible: false }),
      ] : []),
      text('Status', includeProbeButtons ? [0, 257] : [-201, 285], includeProbeButtons ? [900, 66] : [660, 68],
        '等待服务端响应', 27, statusInk),
      text('MarketGold', includeProbeButtons ? [0, 204] : [-83, 224], includeProbeButtons ? [900, 42] : [820, 38], '',
        includeProbeButtons ? 25 : 27, accentInk),
      ...(includeProbeButtons ? stock : [
        { name: 'MarketOffers', kind: 'container', size: [1200, 690], children: stock },
      ]),
      text('Team', includeProbeButtons ? [0, 165] : [-83, 189], includeProbeButtons ? [900, 32] : [820, 28], '', 21,
        includeProbeButtons ? statusInk : pigment.ink),
      ...teamCards.flatMap(cards => cards.slice(0, 3)),
      { name: 'TeamInspection', kind: 'container', position: [0, 0], size: [1200, 690], children: teamCards.flatMap(cards => cards.slice(3)) },
      ...shopButtons,
      ...[['Reward', '升级奖励'], ['RewardNext', '下个奖励'], ['Refresh', '刷新状态'], ['Leave', '认输']]
        .flatMap(([name, content], index) => {
          if (includeProbeButtons) return card(name, `${name}Label`, [(index - 1.5) * 224, -118], [208, 52], content, secondaryStyle);
          const positions = [[-35, -122], [150, -122], [364, 278], [493, 278]];
          return card(name, `${name}Label`, positions[index], index < 2 ? [161, 45] : [116, 44], content, secondaryStyle);
        }),
      ...card('InspectReward', 'InspectRewardLabel', includeProbeButtons ? [-414, -326] : [431, 23],
        includeProbeButtons ? [136, 44] : [186, 46], '查看奖励技能', includeProbeButtons ? inspectStyle : navy,
        includeProbeButtons ? 17 : 18),
      text('AbilityTitle', includeProbeButtons ? [75, -309] : [431, 184],
        includeProbeButtons ? [800, 30] : [188, 62], '点动物旁的「技能」查看，购买操作保持不变',
        includeProbeButtons ? 19 : 21, includeProbeButtons ? statusInk : accentInk),
      text('AbilityBody', includeProbeButtons ? [75, -339] : [431, 102],
        includeProbeButtons ? [800, 40] : [188, 98], '', includeProbeButtons ? 18 : 20,
        includeProbeButtons ? statusInk : pigment.ink),
      { name: 'ReplayBoard', kind: 'container', position: [0, includeProbeButtons ? 90 : 83],
        size: includeProbeButtons ? [900, 210] : [1064, 300], visible: false, children: [
        ...(!includeProbeButtons ? [image('Meadow', [0, 0], [1064, 300], '#c3d6aa')] : []),
        ...(includeProbeButtons ? [
          image('Ally', [-225, 0], [440, 200], '#335b44'),
          image('Enemy', [225, 0], [440, 200], '#605432'),
        ] : [
          terrain('Ally', [-260, -31], [520, 221], '#9ebd71'),
          terrain('Enemy', [260, -31], [520, 221], '#d7ab7f'),
        ]),
        ...Array.from({ length: rule.TEAM_SIZE }, (_, index) => [
          text(`Own${index + 1}`, [-(includeProbeButtons ? 45 + index * 87 : 58 + index * 96), includeProbeButtons ? 0 : -13],
            includeProbeButtons ? [82, 178] : [94, 178], '', includeProbeButtons ? 16 : 20, replayInk),
          text(`Enemy${index + 1}`, [includeProbeButtons ? 45 + index * 87 : 58 + index * 96, includeProbeButtons ? 0 : -13],
            includeProbeButtons ? [82, 178] : [94, 178], '', includeProbeButtons ? 16 : 20, replayInk),
        ]).flat(),
      ] },
      text('ReplayStatus', includeProbeButtons ? [-75, -170] : [-133, -134],
        includeProbeButtons ? [774, 50] : [740, 80], '', includeProbeButtons ? 18 : 22, statusInk),
      ...card('Replay', 'ReplayLabel', includeProbeButtons ? [405, -170] : [418, -134],
        includeProbeButtons ? [116, 44] : [206, 82], '回放', includeProbeButtons ? secondaryStyle : navy,
        includeProbeButtons ? 18 : 24),
      ...(includeProbeButtons ? duelProbeButtons : []).map(({ label, position }, index) => text(`NativeLegend${index + 1}`,
        [position[0], position[1] - 50], [140, 30], label, 18)),
    ],
  };
}

export function duelClientSource(template, resource) {
  const rule = resource.rules;
  const catalogLua = entries => entries.map(({ name, attack, health }) =>
    `{name = ${JSON.stringify(name)}, attack = ${attack}, health = ${health}},`).join('\n    ');
  const clientRules = ['PET_SLOTS', 'FOOD_SLOTS', 'TEAM_SIZE', 'PET_COST', 'FOOD_COST', 'MAX_LEVEL']
    .map(key => `${key.toLowerCase()} = ${rule[key]},`).join('\n    ');
  const source = template
    .replace('-- AP_DUEL_PETS', catalogLua(resource.catalog.pet))
    .replace('-- AP_DUEL_FOODS', catalogLua(resource.catalog.food))
    .replace('-- AP_DUEL_RULES', clientRules);
  assert.doesNotMatch(source, /-- AP_DUEL_/);
  return source;
}

export function duelGraphs(resource, battleGraph, graphId, fightGraphId, startingLives, release) {
  const literals = list => `[${list.map(value => `${value}n`).join(', ')}]`;
  const stageSource = fs.readFileSync(new URL('./m2_probe.ts', import.meta.url), 'utf8')
    .replace('id: 1073741825,', `id: ${graphId},`)
    .replace('0n; // AP_DUEL_STRIKE_LIMIT', `${battleGraph.strikeLimit}n;`)
    .replace('0n; // AP_DUEL_LIVES', `${startingLives}n;`)
    .replace('[0n], // AP_DUEL_START_ONE', `${literals(resource.start[0])},`)
    .replace('[0n], // AP_DUEL_START_TWO', `${literals(resource.start[1])},`);
  assert.doesNotMatch(stageSource, /\/\/ AP_DUEL_/);
  const graphSource = `${resource.source}\n${stageSource}`;
  const fightSource = fs.readFileSync(new URL('./m2_duel_battle.ts', import.meta.url), 'utf8')
    .replace('id: 1073741827,', `id: ${fightGraphId},`)
    .replace("[0n], 'int'); // AP_DUEL_BOARD", `${literals(Array(66).fill(0))}, 'int');`)
    .replace('// AP_DUEL_COLLISION', release ? `const opening = f.get('openingState');
      outcome = ${battleGraph.collisionFunction}(f, board, ${faintArguments}, metadata, opening, false);
      f.set('openingState', opening);` : `outcome = gstsServerCollisionStep(f, board, ${faintArguments}, false);`)
    .replace('[0n], // AP_DUEL_OPENING', `${literals(battleGraph.openingMetadata)},`);
  assert.doesNotMatch(fightSource, /\/\/ AP_DUEL_/);
  const combatSource = `${resource.source}\n${battleGraph.source}\n${bindFaintColumns(fightSource, battleGraph.faintMetadata)}`;
  return [graphSource, combatSource];
}
