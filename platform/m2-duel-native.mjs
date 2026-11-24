import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  return { name, kind: 'text', position, size, text: { content, fontSize, colour, align: 'centre', valign: 'middle' } };
}
function card(action, label, position, size, content, colour, fontSize = 22) {
  return [
    { name: `${action}Face`, kind: 'image', position, size, image: 100001, colour },
    text(label, position, size, content, fontSize),
    { name: action, kind: 'cursorArea', position, size },
  ];
}
export function duelLayout(rule, includeProbeButtons = false) {
  const script = 'm2_probe';
  const stock = Array.from({ length: rule.PET_SLOTS + rule.FOOD_SLOTS }, (_, index) => {
    const x = (index - 2) * 190;
    const pet = index < rule.PET_SLOTS;
    const slot = index + 1 - (pet ? 0 : rule.PET_SLOTS);
    const name = pet ? 'Pet' : 'Food';
    return [
      ...card(`${pet ? 'Buy' : 'Food'}${slot}`, `${pet ? 'Offer' : 'Food'}Label${slot}`, [x, 149], [174, 66], '',
        pet ? '#335b44' : '#605432'),
      ...card(`Freeze${name}${slot}`, `Freeze${name}Label${slot}`, [x, 92], [174, 44], '冻结', '#286452', 19),
    ];
  }).flat();
  return {
    name: 'AP_DuelProbe',
    script,
    showCursor: true,
    blockCursor: false,
    controls: [
      { name: 'Background', kind: 'image', position: [0, 58], size: [1000, 478], image: 100001, colour: '#193931' },
      text('Status', [0, 257], [900, 66], '等待服务端响应', 27),
      text('MarketGold', [0, 204], [900, 35], '', 25, '#ffd887'),
      ...(includeProbeButtons ? stock : [
        { name: 'MarketOffers', kind: 'container', size: [1200, 690], children: stock },
      ]),
      text('Team', [0, 50], [900, 28], '', 21),
      ...Array.from({ length: rule.TEAM_SIZE }, (_, index) => card(`Team${index + 1}`, `TeamLabel${index + 1}`,
        [(index - 2) * 190, 6], [174, 54], '', '#335b44', 20)).flat(),
      ...[['Reroll', '刷新货架'], ['Sell', '出售选中'], ['Merge', '合并模式'], ['Ready', '准备'], ['Advance', '下一轮']]
        .flatMap(([name, content], index) => card(name, `${name}Label`, [(index - 2) * 190, -55], [174, 52], content, '#286452')),
      ...[['Reward', '升级奖励'], ['RewardNext', '下个奖励'], ['Refresh', '刷新状态'], ['Leave', '认输']]
        .flatMap(([name, content], index) => card(name, `${name}Label`, [(index - 1.5) * 224, -115], [208, 52], content, '#286452')),
      text('ReplayStatus', [-75, -170], [774, 44], '', 18),
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
    .replace('outcome = gstsServerCollisionStep(f, board, fainting, false); // AP_DUEL_COLLISION', release ? `const opening = f.get('openingState');
      outcome = ${battleGraph.collisionFunction}(f, board, fainting, metadata, opening, false);
      f.set('openingState', opening);` : 'outcome = gstsServerCollisionStep(f, board, fainting, false);')
    .replace('[0n], // AP_DUEL_FAINT', `${literals(battleGraph.faintMetadata)},`)
    .replace('[0n], // AP_DUEL_OPENING', `${literals(battleGraph.openingMetadata)},`);
  assert.doesNotMatch(fightSource, /\/\/ AP_DUEL_/);
  const combatSource = `${resource.source}\n${battleGraph.source}\n${fightSource}`;
  return [graphSource, combatSource];
}
