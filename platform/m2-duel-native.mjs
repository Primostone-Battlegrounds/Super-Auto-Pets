import assert from 'node:assert/strict';
import fs from 'node:fs';
import { image, pigment, preparationBadge, preparationColours as prep, terrain } from './m1-ui.mjs';
import { bindFaintColumns, faintArguments } from './m3-battle-opening.mjs';
import { clearingColours as clearing, labelFront, onlineBadgePool, onlineBadgeSource } from './multiplayer-standings.mjs';

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
function card(action, label, position, size, content, { fill, ink, sprite, portrait, inset = 0, compact = false, curved = false }, fontSize = 18) {
  const caption = text(label, position, size, content, fontSize, ink);
  if (sprite || portrait || compact || curved) caption.text.outline = false;
  let face = curved ? terrain(`${action}Face`, position, size, fill)
    : image(`${action}Face`, position, size, fill, sprite && { image: sprite });
  if (portrait) {
    caption.position = [position[0], position[1] - 23];
    caption.size = [size[0], 50];
    caption.text.fontSize = 21;
    face = terrain(`${action}Face`, [position[0] - inset, position[1] + 4], [size[0] - 2 * inset - 12, 32], fill);
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
  const reader = card(inspect, `${inspect}Label`, [position[0] + size[0] / 2 - 22, position[1]],
    [44, size[1]], '技能', inspectStyle, 16);
  if (inspectStyle.compact) {
    reader[0].position = [reader[0].position[0], position[1] - 13];
    reader[1].position = [reader[1].position[0], position[1] - 13];
  }
  return [...controls, ...reader];
}

function dockWithBadge(action, label, [x, y], size, style, inspect) {
  const team = action.startsWith('Team');
  const position = team ? [x, y + 73] : [x - 51, y + 61];
  const sizeOfBadge = team ? [122, 48] : [76, 34];
  return [
    ...card(action, label, [x, y], size, '', style),
    image(`${inspect}Face`, position, sizeOfBadge, prep.badgePaper),
    preparationBadge(`${inspect}Label`, position, sizeOfBadge),
    { name: inspect, kind: 'cursorArea', position, size: sizeOfBadge },
  ];
}

const plain = fill => ({ fill });
const gold = { fill: '#fff5da', ink: '#372917', sprite: 107015 };
const lake = { fill: '#719486', ink: '#fffaf0', sprite: 107012 };
const moss = { fill: '#486c53', ink: '#fffaf0', curved: true };
const dock = (fill, inset) => ({ fill, ink: clearing.ink, portrait: true, inset });

export function duelLayout(rule, includeProbeButtons = false) {
  const script = 'm2_probe';
  const teamStyle = includeProbeButtons ? plain('#335b44') : dock(clearing.recess, 8);
  const petStyle = includeProbeButtons ? plain('#335b44') : dock(clearing.nearTrack, 0);
  const foodStyle = includeProbeButtons ? plain('#605432') : dock(clearing.farTrack, 0);
  const secondaryStyle = includeProbeButtons ? plain('#286452') : moss;
  const inspectStyle = plain('#416c59');
  const freezeStyle = includeProbeButtons ? secondaryStyle : { ...lake, compact: true };
  const statusInk = includeProbeButtons ? '#fff3d7' : pigment.ink;
  const accentInk = includeProbeButtons ? '#ffd887' : '#5b3f21';
  const replayInk = includeProbeButtons ? statusInk : pigment.ink;
  const marketX = [-451, -278, -105, 113, 286];
  const shelfX = index => includeProbeButtons ? (index - 2) * 190 : marketX[index];
  const teamX = index => includeProbeButtons ? shelfX(4 - index) : (2 - index) * 169;
  const rosterY = includeProbeButtons ? 120 : 126;
  const stockY = includeProbeButtons ? 42 : -114;
  const slotWidth = includeProbeButtons ? 174 : 154;
  const stock = Array.from({ length: rule.PET_SLOTS + rule.FOOD_SLOTS }, (_, index) => {
    const x = shelfX(index);
    const pet = index < rule.PET_SLOTS;
    const slot = index + 1 - (pet ? 0 : rule.PET_SLOTS);
    const name = pet ? 'Pet' : 'Food';
    const position = [x, stockY];
    const size = [slotWidth, includeProbeButtons ? 66 : 94];
    return [
      ...(pet ? includeProbeButtons
        ? inspectable(`Buy${slot}`, `OfferLabel${slot}`, position, size, petStyle, `InspectPet${slot}`, inspectStyle)
        : dockWithBadge(`Buy${slot}`, `OfferLabel${slot}`, position, size, petStyle, `InspectPet${slot}`)
        : card(`Food${slot}`, `FoodLabel${slot}`, position, size, '', foodStyle)),
      ...(!pet && !includeProbeButtons ? [preparationBadge(`FoodTier${slot}`, [x - 51, stockY + 61], [76, 34])] : []),
      ...card(`Freeze${name}${slot}`, `Freeze${name}Label${slot}`, [x, includeProbeButtons ? -13 : -206],
        includeProbeButtons ? [slotWidth, 44] : [116, 82], '冻结', freezeStyle, 19).map(control =>
        includeProbeButtons ? control : { ...control, visible: false, active: false }),
    ];
  }).flat();
  const teamCards = Array.from({ length: rule.TEAM_SIZE }, (_, index) => {
    const slot = index + 1;
    const position = [teamX(index), rosterY];
    return includeProbeButtons
      ? inspectable(`Team${slot}`, `TeamLabel${slot}`, position, [slotWidth, 56], teamStyle, `InspectTeam${slot}`, inspectStyle, 20)
      : dockWithBadge(`Team${slot}`, `TeamLabel${slot}`, position, [slotWidth, 86], teamStyle, `InspectTeam${slot}`);
  });
  const shopActions = [['Reroll', '刷新货架'], ['Sell', '出售选中'], ['Merge', '合并模式'], ['Ready', '准备'], ['Advance', '下一轮']];
  const shopButtons = shopActions.flatMap(([name, content], index) => {
    if (!includeProbeButtons && (name === 'Reroll' || name === 'Ready')) {
      return card(name, `${name}Label`, [name === 'Reroll' ? -481 : 481, -290], [206, 82],
        name === 'Ready' ? '准备开战' : '刷新', gold, 25);
    }
    if (!includeProbeButtons) {
      const position = name === 'Advance' ? [481, -290] : [name === 'Sell' ? 0 : -231, 37];
      return card(name, `${name}Label`, position, name === 'Advance' ? [206, 82] : [130, 82],
        content, name === 'Advance' ? gold : secondaryStyle).map(control => ({ ...control, visible: false, active: false }));
    }
    return card(name, `${name}Label`, [(index - 2) * 190, -65], [174, 52], content, secondaryStyle);
  });
  const marketGold = text('MarketGold', includeProbeButtons ? [0, 204] : [-350, 306],
    includeProbeButtons ? [900, 42] : [450, 42], '', includeProbeButtons ? 25 : 23, accentInk);
  const status = text('Status', includeProbeButtons ? [0, 257] : [0, -271], includeProbeButtons ? [900, 66] : [686, 103],
    '等待服务端响应', includeProbeButtons ? 27 : 23, statusInk);
  if (!includeProbeButtons) {
    marketGold.text.align = 'left';
    marketGold.text.outline = false;
    status.text.outline = false;
  }
  const supplementalActions = [['Reward', '升级奖励'], ['RewardNext', '下个奖励'], ['Refresh', '刷新状态'], ['Leave', '认输']]
    .flatMap(([name, content], index) => {
      if (includeProbeButtons) return card(name, `${name}Label`, [(index - 1.5) * 224, -118], [208, 52], content, secondaryStyle);
      const positions = [[476, -114], [476, -213], [364, 306], [496, 306]];
      return card(name, `${name}Label`, positions[index], index < 2 ? [142, 68] : [116, 44], content, secondaryStyle);
    });
  return {
    name: 'AP_DuelProbe',
    script,
    showCursor: true,
    blockCursor: false,
    controls: [
      image('Background', [0, 0], includeProbeButtons ? [1000, 710] : [1200, 674], includeProbeButtons ? '#193931' : prep.header),
      ...(includeProbeButtons ? [marketGold, ...stock] : [
        { name: 'MarketOffers', kind: 'container', size: [1200, 690], children: [
          image('ShopSky', [0, 129], [1200, 282], prep.grass),
          image('ShopCloud', [262, 212], [156, 33], '#f8f4d4', { image: 105102 }),
          image('GroveLeft', [-465, 158], [162, 72], prep.grassDark, { image: 105135 }),
          image('ShopGround', [0, -171], [1200, 334], prep.shelf),
          image('GroveRight', [470, 78], [161, 61], prep.grassLight, { image: 105136 }),
          labelFront('TeamFront', [469, 129], '前排 ›'),
          ...stock,
        ] },
        marketGold,
      ]),
      status,
      text('Team', includeProbeButtons ? [0, 165] : [0, 241], includeProbeButtons ? [900, 32] : [700, 34], '', 20,
        includeProbeButtons ? statusInk : pigment.ink),
      ...teamCards.flatMap(cards => cards.slice(0, 3)),
      { name: 'TeamInspection', kind: 'container', position: [0, 0], size: [1200, 690], children: teamCards.flatMap(cards => cards.slice(3)) },
      ...shopButtons,
      ...(includeProbeButtons ? supplementalActions : []),
      ...card('InspectReward', 'InspectRewardLabel', includeProbeButtons ? [-414, -326] : [476, -56],
        includeProbeButtons ? [136, 44] : [140, 37], '查看奖励技能', includeProbeButtons ? inspectStyle : moss,
        includeProbeButtons ? 17 : 18),
      text('AbilityTitle', includeProbeButtons ? [75, -309] : [-302, 18],
        includeProbeButtons ? [800, 30] : [520, 54], '查看动物技能',
        includeProbeButtons ? 19 : 20, includeProbeButtons ? statusInk : accentInk),
      text('AbilityBody', includeProbeButtons ? [75, -339] : [175, 15],
        includeProbeButtons ? [800, 40] : [434, 68], '', 18,
        includeProbeButtons ? statusInk : pigment.ink),
      { name: 'ReplayBoard', kind: 'container', position: [0, includeProbeButtons ? 90 : 83],
        size: includeProbeButtons ? [900, 210] : [1064, 300], visible: false, children: [
        ...(!includeProbeButtons ? [
          image('Meadow', [0, 0], [1064, 300], clearing.grass),
          image('FarCloud', [350, 115], [201, 46], '#fffaf0', { image: 105102 }),
          image('Pine', [-482, 101], [45, 85], '#8ca98d', { image: 105098 }),
          image('Canopy', [-377, 94], [236, 100], '#f6fbec', { image: 105135 }),
        ] : []),
        ...(includeProbeButtons ? [
          image('Ally', [-225, 0], [440, 200], '#335b44'),
          image('Enemy', [225, 0], [440, 200], '#605432'),
        ] : [
          terrain('Enemy', [197, 4], [660, 156], clearing.enemyLane),
          terrain('Ally', [-197, 10], [660, 156], clearing.ownLane),
          labelFront('OwnFront', [-68, 88], '席1前排 ›'),
          labelFront('EnemyFront', [68, 88], '‹ 席2前排'),
          onlineBadgePool(),
        ]),
        ...Array.from({ length: rule.TEAM_SIZE }, (_, index) => [
          text(`Own${index + 1}`, [-(includeProbeButtons ? 45 + index * 87 : 58 + index * 96), includeProbeButtons ? 0 : -13],
            includeProbeButtons ? [82, 178] : [94, 178], '', includeProbeButtons ? 16 : 20, replayInk),
          text(`Enemy${index + 1}`, [includeProbeButtons ? 45 + index * 87 : 58 + index * 96, includeProbeButtons ? 0 : -13],
            includeProbeButtons ? [82, 178] : [94, 178], '', includeProbeButtons ? 16 : 20, replayInk),
        ]).flat(),
      ] },
      // Reward actions also host the unified speed and skip controls during replay.
      ...(!includeProbeButtons ? supplementalActions : []),
      text('ReplayStatus', includeProbeButtons ? [-75, -170] : [-133, -134],
        includeProbeButtons ? [774, 50] : [740, 80], '', includeProbeButtons ? 18 : 22, statusInk),
      ...card('Replay', 'ReplayLabel', includeProbeButtons ? [405, -170] : [-164, 218],
        includeProbeButtons ? [116, 44] : [144, 82], '回放', includeProbeButtons ? secondaryStyle : lake,
        includeProbeButtons ? 18 : 24),
      ...(includeProbeButtons ? duelProbeButtons : []).map(({ label, position }, index) => text(`NativeLegend${index + 1}`,
        [position[0], position[1] - 50], [140, 30], label, 18)),
    ],
  };
}

export function duelClientSource(template, resource, unified = false) {
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
  return `${onlineBadgeSource(unified)}\n${source}`;
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
