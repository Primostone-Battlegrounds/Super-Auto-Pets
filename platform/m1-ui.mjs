const plane = 100001;
const disc = 106025;
const portraitLayers = 16;
const pigment = {
  edge: '#90aa91', canvas: '#e3ead3', ink: '#203c34', muted: '#476354', cream: '#f8efd7',
  land: '#b8c9a6', water: '#a4c8b7', river: '#8bb9ae', whiteWater: '#d9ebd7',
  sand: '#eee1bc', sandLine: '#d2ba86', chip: '#f4f0db', primary: '#286452',
  player: '#8da982', enemy: '#b2a584', market: '#e7d4a5', gold: '#a66c27', ice: '#406f82',
};

function image(name, position, size, colour, options = {}) {
  return { name, kind: 'image', position, size, image: plane, colour, ...options };
}

function ellipse(name, position, size, colour, options = {}) {
  return image(name, position, size, colour, { image: disc, ...options });
}

function label(name, position, size, content = '', fontSize = 20, colour = pigment.ink, align = 'centre') {
  return {
    name, kind: 'text', position, size,
    text: { content, fontSize, colour, align, valign: 'middle', outline: false },
  };
}

function group(name, position, size, children, visible = true) {
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
    ellipse('Rim', [0, -6], [94, 32], pigment.edge),
    ellipse('Face', [0, -3], [88, 24], pigment[type]),
    portrait(),
    label('Name', [0, -24], [width - 4, 24], '', market ? 19 : 17),
    image('StatsPaper', [0, -47], [width - 8, 23], market ? '#f6ecd0' : '#edf0d9'),
    label('Detail', [0, -47], [width - 8, 23], '', 18),
    label('Tag', [0, market ? -64 : 68], [width - 4, market ? 15 : 18], '', 14, market ? pigment.ice : pigment.gold),
  ];
  if (market) {
    children.push(image('Frozen', [0, 71], [86, 3], pigment.ice, { visible: false }));
  } else {
    children.push(
      image('HealthTrack', [0, -61], [88, 4], '#d5dfc4', { visible: false }),
      image('Health', [0, -61], [88, 4], '#448269', { visible: false }),
    );
  }
  if (type === 'player') {
    children.push(
      image('XPPaper', [0, -64], [width - 8, 16], '#dbe9cf'),
      label('XP', [0, -64], [width - 8, 16], '', 16),
      image('DropTarget', [0, -74], [86, 4], pigment.primary, { visible: false }),
      label('DropLabel', [0, 68], [width - 4, 18], '', 14, pigment.primary),
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

function button(name, position, size, title, primary = false) {
  return group(name, position, size, [
    ellipse('Rim', [0, 0], size, primary ? '#1e4f43' : pigment.edge),
    ellipse('Face', [0, 0], [size[0] - 5, size[1] - 5], primary ? pigment.primary : pigment.chip),
    label('Title', [0, 0], [size[0] - 20, size[1] - 12], title, primary ? 23 : 17, primary ? pigment.cream : pigment.ink),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

function stat(name, x, title) {
  return group(name, [x, 281], [152, 65], [
    image('Surface', [0, 0], [152, 65], pigment.chip),
    label('Label', [0, 14], [148, 22], title, 15, pigment.muted),
    label('Value', [0, -11], [148, 28], '', 21),
  ]);
}

const slots = [1, 2, 3, 4, 5];
const offers = ['Pet1', 'Pet2', 'Pet3', 'Food1', 'Food2', 'Reward'];
const actions = [
  ['Buy', '购买'], ['Freeze', '冻结 / 解冻'], ['Sell', '出售'], ['Merge', '合并队员'],
  ['Reroll', '刷新'], ['RewardNext', '下个奖励'],
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
    label('Heading', [-373, 291], [374, 46], '小动物自走棋', 35, pigment.ink, 'left'),
    label('Seed', [-373, 257], [374, 24], '', 16, pigment.muted, 'left'),
    button('Reset', [-266, 250], [142, 42], '重开本局'),
    stat('Round', -105, '回合'),
    stat('Money', 69, '金币'),
    stat('Wins', 243, '胜场'),
    stat('Lives', 417, '生命'),
    group('Field', [0, 119], [1172, 218], [
      image('Meadow', [0, 0], [1172, 218], pigment.land),
      ellipse('Bank', [0, -11], [1072, 172], '#cdd8b4'),
      ellipse('Water', [11, -54], [1114, 93], pigment.water),
      ellipse('Current', [74, -72], [902, 54], pigment.river),
      ellipse('Ripple1', [-384, -80], [157, 5], pigment.whiteWater),
      ellipse('Ripple2', [401, -78], [127, 6], pigment.whiteWater),
      ellipse('Ripple3', [91, -92], [198, 4], pigment.whiteWater),
      ellipse('PrepRail', [0, -49], [878, 45], '#e5e5bf'),
      ellipse('Clash', [0, 4], [48, 12], pigment.whiteWater, { visible: false }),
      ...[-1, 1].flatMap(sign => [
        ellipse(`Reed${sign}A`, [sign * 548, -27], [7, 30], '#637e62'),
        ellipse(`Reed${sign}B`, [sign * 533, -38], [9, 44], '#829c6c'),
        ellipse(`Reed${sign}C`, [sign * 564, -41], [8, 42], '#718e65'),
      ]),
    ]),
    label('TeamCaption', [-309, 208], [521, 25], '', 19, pigment.ink, 'left'),
    label('OpponentCaption', [309, 208], [521, 25], '', 19, pigment.ink, 'right'),
    ...slots.map(slot => card(`Team${slot}`, [(3 - slot) * 176, 104], 106, 'player')),
    ...slots.map(slot => card(`Enemy${slot}`, [91 + (slot - 1) * 112, 115 - (slot - 1) * 9], 106, 'enemy', false, false)),
    group('Shop', [0, -124], [1164, 268], [
      image('Paper', [0, 0], [1164, 268], pigment.cream),
      image('Rail', [0, 0], [1128, 164], pigment.sand),
      image('Rule', [0, 83], [1128, 2], pigment.sandLine),
      label('Caption', [-465, 106], [198, 28], '', 24, pigment.ink, 'left'),
      ...offers.map((name, index) => card(name, [-465 + index * 186, 0], 174, 'market')),
      ...actions.map(([name, title], index) => button(name, [-465 + index * 186, -104], [172, 52], title)),
    ]),
    group('Tooltip', [0, -17], [360, 58], [
      image('Border', [0, 0], [360, 50], '#78a090'),
      image('Paper', [0, 0], [354, 44], '#fff5df'),
      ellipse('Pointer', [0, -26], [12, 6], pigment.primary),
      label('Heading', [0, 11], [326, 20], '', 18, pigment.ink, 'left'),
      label('Body', [0, -10], [326, 19], '', 15, pigment.ink, 'left'),
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
    group('Battle', [0, -165], [1152, 143], [
      image('Border', [0, 0], [1152, 143], pigment.edge),
      image('Surface', [0, 0], [1148, 139], '#eaf0d7'),
      image('Rule', [-540, 37], [4, 35], pigment.gold),
      label('Outcome', [0, 43], [1038, 30], '', 25, pigment.ink, 'left'),
      label('Event', [0, 12], [1038, 25], '', 18, pigment.ink, 'left'),
      button('Replay', [-401, -37], [233, 45], '下一条战斗事件'),
      button('Auto', [-143, -37], [233, 45], '暂停回放'),
      button('NewSeed', [115, -37], [233, 45], '新一局'),
    ], false),
    image('FooterLine', [0, -262], [1152, 2], pigment.edge),
    button('Primary', [411, -293], [329, 58], '开战', true),
    label('Hint', [-153, -292], [824, 53], '', 19, pigment.ink, 'left'),
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
