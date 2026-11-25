const plane = 100001;
const disc = 106025;
export const portraitLayers = 16;
export const pigment = {
  edge: '#9fb2aa', canvas: '#f6f3e8', ink: '#173d3d', muted: '#6b817b', cream: '#fff9e9',
  field: '#dce8d4', rail: '#c8ddd4', opposingRail: '#ecded4', rule: '#b9cec5',
  shelf: '#f3e8cf', shelfRule: '#d9c7a6', chip: '#edf2e8', primary: '#206258',
  player: '#8aaf9c', enemy: '#b79389', market: '#e9d3a0', gold: '#9b6021', ice: '#406f82',
};

export function image(name, position, size, colour, options = {}) {
  return { name, kind: 'image', position, size, image: plane, colour, ...options };
}

function ellipse(name, position, size, colour, options = {}) {
  return image(name, position, size, colour, { image: disc, ...options });
}

export function label(name, position, size, content = '', fontSize = 20, colour = pigment.ink, align = 'centre') {
  return {
    name, kind: 'text', position, size,
    text: { content, fontSize, colour, align, valign: 'middle', outline: false, autoSize: true, minFontSize: Math.min(fontSize, 16) },
  };
}

export function group(name, position, size, children, visible = true) {
  return { name, kind: 'container', position, size, children, visible };
}

function portrait() {
  const layers = Array.from({ length: portraitLayers }, (_, index) =>
    image(`Layer${index + 1}`, [0, 0], [1, 1], pigment.cream, { visible: false }));
  return group('Portrait', [0, 27], [78, 78], layers);
}

function card(name, position, width, type, interactive = true, visible = true) {
  const size = [width, 154];
  const market = type === 'market';
  const children = [
    ellipse('Rim', [0, 7], [94, 32], pigment.edge),
    ellipse('Face', [0, 10], [88, 24], pigment[type]),
    portrait(),
    label('Name', [0, -20], [width - 4, 28], '', market ? 19 : 17),
    image('StatsPaper', [0, -49], [width - 8, 28], market ? '#f6ecd0' : '#edf0d9'),
    label('Detail', [0, -49], [width - 8, 28], '', 18),
    label('Tag', [0, 63], [width - 4, 25], '', 14, market ? pigment.ice : pigment.gold),
  ];
  if (market) {
    children.push(image('Frozen', [0, 49], [86, 3], pigment.ice, { visible: false }));
  } else {
    children.push(
      image('HealthTrack', [0, -61], [88, 4], '#d5dfc4', { visible: false }),
      image('Health', [0, -61], [88, 4], '#448269', { visible: false }),
    );
  }
  if (type === 'player') {
    children.push(
      image('XPPaper', [0, 63], [width - 8, 25], '#dbe9cf'),
      label('XP', [0, 63], [width - 8, 25], '', 14),
      image('DropTarget', [0, -74], [86, 4], pigment.primary, { visible: false }),
      label('DropLabel', [0, 63], [width - 4, 25], '', 14, pigment.primary),
    );
  }
  if (interactive) {
    children.push(
      image('Selected', [0, -74], [86, 3], pigment.gold, { visible: false }),
      { name: 'Hit', kind: 'cursorArea', size },
    );
  }
  return group(name, position, size, children, visible);
}

export function button(name, position, size, title, primary = false) {
  return group(name, position, size, [
    image('Rim', [0, 0], size, primary ? '#1e4f43' : pigment.edge),
    image('Face', [0, 0], [size[0] - 4, size[1] - 4], primary ? pigment.primary : pigment.chip),
    label('Title', [0, 0], [size[0] - 20, size[1] - 12], title, primary ? 23 : 17, primary ? pigment.cream : pigment.ink),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

function stat(name, x, title) {
  return group(name, [x, 281], [152, 65], [
    image('Surface', [0, 0], [152, 65], pigment.chip),
    label('Label', [0, 16], [148, 28], title, 15, pigment.muted),
    label('Value', [0, -13], [148, 28], '', 21),
  ]);
}

const slots = [1, 2, 3, 4, 5];
const offers = ['Pet1', 'Pet2', 'Pet3', 'Food1', 'Food2', 'Reward'];
const playButtonHeight = 82;
const actions = [
  ['Buy', '购买'], ['Freeze', '冻结 / 解冻'], ['Sell', '出售'], ['Merge', '合并队员'],
  ['RewardNext', '下个奖励'],
];

export const nativeRun = {
  name: 'AutoPetsRun',
  script: 'auto_pets_run',
  showCursor: true,
  blockCursor: true,
  blockKeys: true,
  controls: [
    image('Border', [0, 0], [1202, 684], pigment.edge),
    image('Panel', [0, 0], [1194, 676], pigment.canvas),
    image('Header', [0, 280], [1172, 98], pigment.cream),
    label('Heading', [-373, 303], [374, 46], '小动物自走棋', 35, pigment.ink, 'left'),
    button('OpenMenu', [-486, 255], [142, 48], '菜单'),
    button('Reset', [-328, 255], [142, 48], '重开本局'),
    stat('Round', -105, '回合'),
    stat('Money', 69, '金币'),
    stat('Wins', 243, '胜场'),
    stat('Lives', 417, '生命'),
    group('Field', [0, 119], [1172, 218], [
      image('Surface', [0, 0], [1172, 218], pigment.field),
      image('Divider', [0, 76], [1100, 2], pigment.rule),
      image('PrepRail', [0, -20], [874, 142], pigment.rail),
      image('AllyRail', [-311, -20], [548, 142], pigment.rail, { visible: false }),
      image('RivalRail', [311, -20], [548, 142], pigment.opposingRail, { visible: false }),
      ellipse('Clash', [0, 4], [23, 23], '#faf5e6', { visible: false }),
    ]),
    label('TeamCaption', [-309, 208], [521, 32], '', 19, pigment.ink, 'left'),
    label('OpponentCaption', [309, 208], [521, 32], '', 19, pigment.ink, 'right'),
    ...slots.map(slot => card(`Team${slot}`, [(3 - slot) * 176, 104], 106, 'player')),
    ...slots.map(slot => card(`Enemy${slot}`, [91 + (slot - 1) * 112, 115 - (slot - 1) * 9], 106, 'enemy', false, false)),
    group('Shop', [0, -124], [1164, 428], [
      image('Paper', [0, 0], [1164, 268], pigment.cream),
      image('Rail', [0, 0], [1128, 164], pigment.shelf),
      image('Rule', [0, 83], [1128, 2], pigment.shelfRule),
      image('FoodDivider', [0, 0], [2, 146], pigment.shelfRule),
      image('RewardDivider', [372, 0], [2, 146], pigment.shelfRule),
      label('Caption', [-465, 106], [198, 28], '', 24, pigment.ink, 'left'),
      ...offers.map((name, index) => card(name, [-465 + index * 186, 0], 174, 'market')),
      ...actions.map(([name, title], index) => button(name, [(index - 2) * 232, -104], [172, 52], title)),
      button('Reroll', [-455, -172], [206, playButtonHeight], '刷新', true),
    ]),
    group('Tooltip', [0, -10], [360, 72], [
      image('Border', [0, 0], [360, 72], '#78a090'),
      image('Paper', [0, 0], [354, 68], '#fff5df'),
      ellipse('Pointer', [0, -33], [12, 6], pigment.primary),
      label('Heading', [0, 22], [326, 28], '', 18, pigment.ink, 'left'),
      { ...label('Body', [0, -14], [326, 44], '', 16, pigment.ink, 'left'),
        text: { ...label('', [0, 0], [1, 1], '', 16, pigment.ink, 'left').text, minFontSize: 14 } },
    ], false),
    group('BattleFX', [0, 118], [1184, 208], [
      group('Strike', [0, 0], [66, 38], [
        ellipse('Wake', [0, 0], [64, 8], '#c68b43'),
        ellipse('Glint', [0, 0], [52, 4], '#ffe7a4'),
        ellipse('Upper', [-9, 11], [29, 5], '#f8e1a1'),
        ellipse('Lower', [10, -10], [30, 4], '#f8e1a1'),
      ], false),
      group('Impact', [0, 0], [66, 50], [
        ellipse('Burst', [0, 0], [64, 41], '#f3c58a'),
        ellipse('Flash', [0, 0], [52, 33], '#fff2d6'),
        ellipse('Spark', [30, 16], [5, 8], '#ad623c'),
        label('Value', [0, 0], [54, 30], '', 24, '#8f3c30'),
      ], false),
    ], false),
    group('Battle', [0, -165], [1152, 170], [
      image('Border', [0, 0], [1152, 170], pigment.edge),
      image('Surface', [0, 0], [1148, 166], '#eaf0d7'),
      image('Rule', [-540, 48], [4, 35], pigment.gold),
      label('Outcome', [0, 54], [1038, 30], '', 25, pigment.ink, 'left'),
      label('Event', [0, 22], [1038, 30], '', 18, pigment.ink, 'left'),
      button('Replay', [-430, -36], [202, playButtonHeight], '下一条战斗事件'),
      button('Auto', [-216, -36], [202, playButtonHeight], '暂停回放'),
      button('Fast', [-2, -36], [202, playButtonHeight], '速度：1 倍'),
      button('Rewatch', [212, -36], [202, playButtonHeight], '重新回放'),
      button('NewSeed', [426, -36], [202, playButtonHeight], '新一局'),
    ], false),
    image('FooterLine', [0, -262], [1152, 2], pigment.edge),
    button('Primary', [411, -296], [329, playButtonHeight], '开战', true),
    label('Hint', [-153, -292], [824, 53], '', 19, pigment.ink, 'left'),
    { ...group('Menu', [0, 0], [1202, 684], [
      image('Backdrop', [0, 0], [1202, 684], '#dce9e4'),
      image('Rim', [0, 0], [556, 416], '#8ca5a1'),
      image('Paper', [0, 0], [548, 408], pigment.cream),
      image('Rule', [0, 88], [336, 2], pigment.shelfRule),
      label('Heading', [0, 134], [500, 63], '小动物自走棋', 43),
      label('Progress', [0, 55], [496, 28], '', 21, pigment.muted),
      button('Continue', [0, 0], [334, 56], '单人练习', true),
      button('NewGame', [0, -68], [334, 52], '放弃并开新局'),
      button('Difficulty', [0, -68], [334, 52], '练习难度：标准'),
      button('Audio', [0, -139], [334, 48], '音效：开启'),
    ], false), blockCursor: true },
    { ...group('Restart', [0, 0], [1202, 684], [
      image('Shade', [0, 0], [1202, 684], pigment.ink, { opacity: 0.65 }),
      image('Rim', [0, 5], [620, 234], pigment.edge),
      image('Paper', [0, 5], [610, 224], pigment.cream),
      label('Heading', [0, 68], [560, 44], '重开本局？', 31),
      label('Body', [0, 15], [560, 39], '清空本局阵容与战绩，用同一种子开始。', 20),
      button('Cancel', [-135, -56], [230, 50], '继续本局'),
      button('Confirm', [135, -56], [230, 50], '确认重开', true),
    ], false), blockCursor: true },
  ],
};
