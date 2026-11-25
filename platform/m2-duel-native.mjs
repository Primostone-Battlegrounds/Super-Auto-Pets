import assert from 'node:assert/strict';
import fs from 'node:fs';
import { image, pigment } from './m1-ui.mjs';
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
function card(action, label, position, size, content, colour, fontSize = 18) {
  return [
    { name: `${action}Face`, kind: 'image', position, size, image: 100001, colour },
    text(label, position, size, content, fontSize),
    { name: action, kind: 'cursorArea', position, size },
  ];
}
function inspectable(action, label, position, size, content, colour, inspect, fontSize = 18) {
  const controls = card(action, label, position, size, content, colour, fontSize);
  controls[1].position = [position[0] - 22, position[1]];
  controls[1].size = [size[0] - 44, size[1]];
  controls[2].position = [position[0] - 22, position[1]];
  controls[2].size = [size[0] - 44, size[1]];
  return [...controls, ...card(inspect, `${inspect}Label`, [position[0] + size[0] / 2 - 22, position[1]],
    [44, size[1]], '技能', '#416c59', 16)];
}
export function duelLayout(rule, includeProbeButtons = false) {
  const script = 'm2_probe';
  const stock = Array.from({ length: rule.PET_SLOTS + rule.FOOD_SLOTS }, (_, index) => {
    const x = (index - 2) * 190;
    const pet = index < rule.PET_SLOTS;
    const slot = index + 1 - (pet ? 0 : rule.PET_SLOTS);
    const name = pet ? 'Pet' : 'Food';
    return [
      ...(pet ? inspectable : card)(`${pet ? 'Buy' : 'Food'}${slot}`, `${pet ? 'Offer' : 'Food'}Label${slot}`, [x, 42], [174, 66], '',
        pet ? '#335b44' : '#605432', ...(pet ? [`InspectPet${slot}`] : [])),
      ...card(`Freeze${name}${slot}`, `Freeze${name}Label${slot}`, [x, -13], [174, 44], '冻结', '#286452', 19),
    ];
  }).flat();
  const teamCards = Array.from({ length: rule.TEAM_SIZE }, (_, index) => inspectable(`Team${index + 1}`, `TeamLabel${index + 1}`,
    [(2 - index) * 190, 120], [174, 56], '', '#335b44', `InspectTeam${index + 1}`, 20));
  const shopActions = [['Reroll', '刷新货架'], ['Sell', '出售选中'], ['Merge', '合并模式'], ['Ready', '准备'], ['Advance', '下一轮']];
  const shopButtons = shopActions.flatMap(([name, content], index) => {
    if (!includeProbeButtons && (name === 'Reroll' || name === 'Ready')) {
      return card(name, `${name}Label`, [name === 'Reroll' ? -315 : 315, -201], [206, 82], content, pigment.primary, 23);
    }
    return card(name, `${name}Label`, [(index - 2) * 190, -65], [174, 52], content, '#286452');
  });
  return {
    name: 'AP_DuelProbe',
    script,
    showCursor: true,
    blockCursor: false,
    controls: [
      { name: 'Background', kind: 'image', position: [0, 0], size: [1000, includeProbeButtons ? 710 : 640], image: 100001, colour: '#193931' },
      text('Status', [0, 257], [900, 66], '等待服务端响应', 27),
      text('MarketGold', [0, 204], [900, 42], '', 25, '#ffd887'),
      ...(includeProbeButtons ? stock : [
        { name: 'MarketOffers', kind: 'container', size: [1200, 690], children: stock },
      ]),
      text('Team', [0, 165], [900, 32], '', 21),
      ...teamCards.flatMap(cards => cards.slice(0, 3)),
      { name: 'TeamInspection', kind: 'container', position: [0, 0], size: [1200, 690], children: teamCards.flatMap(cards => cards.slice(3)) },
      ...shopButtons,
      ...[['Reward', '升级奖励'], ['RewardNext', '下个奖励'], ['Refresh', '刷新状态'], ['Leave', '认输']]
        .flatMap(([name, content], index) => card(name, `${name}Label`, [(index - 1.5) * 224, -118], [208, 52], content, '#286452')),
      ...card('InspectReward', 'InspectRewardLabel', includeProbeButtons ? [-414, -326] : [0, -218],
        includeProbeButtons ? [136, 44] : [176, 44], '查看奖励技能', '#416c59', 17),
      text('AbilityTitle', includeProbeButtons ? [75, -309] : [0, -258],
        [includeProbeButtons ? 800 : 940, 30], '点动物旁的「技能」查看，购买操作保持不变', 19),
      text('AbilityBody', includeProbeButtons ? [75, -339] : [0, -292], [includeProbeButtons ? 800 : 940, 40], '', 18),
      { name: 'ReplayBoard', kind: 'container', position: [0, 90], size: [900, 210], visible: false, children: [
        image('Ally', [-225, 0], [440, 200], includeProbeButtons ? '#335b44' : pigment.rail),
        image('Enemy', [225, 0], [440, 200], includeProbeButtons ? '#605432' : pigment.opposingRail),
        ...Array.from({ length: rule.TEAM_SIZE }, (_, index) => [
          text(`Own${index + 1}`, [-45 - index * 87, 0], [82, 178], '', 16, includeProbeButtons ? '#fff3d7' : pigment.ink),
          text(`Enemy${index + 1}`, [45 + index * 87, 0], [82, 178], '', 16, includeProbeButtons ? '#fff3d7' : pigment.ink),
        ]).flat(),
      ] },
      text('ReplayStatus', [-75, -170], [774, 50], '', 18),
      ...card('Replay', 'ReplayLabel', [405, -170], [116, 44], '回放', '#335b44'),
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
