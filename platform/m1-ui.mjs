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
    label('Detail', [0, -47], [width - 4, 20], '', 15, pigment.muted),
    label('Tag', [0, market ? -64 : 69], [width - 4, market ? 15 : 16], '', 12, market ? pigment.ice : pigment.gold),
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
      label('XP', [0, -63], [width - 4, 15], '', 13, pigment.muted),
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
      label('Caption', [-305, 106], [518, 28], '', 24, pigment.ink, 'left'),
      label('Info', [155, 106], [800, 25], '', 17, pigment.muted, 'right'),
      ...offers.map((name, index) => card(name, [-465 + index * 186, 0], 174, 'market')),
      ...actions.map(([name, title], index) => button(name, [-465 + index * 186, -104], [172, 52], title)),
    ]),
    group('Battle', [0, -143], [1164, 204], [
      image('Border', [0, 0], [1164, 204], pigment.edge),
      image('Surface', [0, 0], [1156, 196], pigment.cream),
      image('Rule', [-520, 51], [5, 47], pigment.gold),
      label('Outcome', [11, 52], [1004, 49], '', 32, pigment.ink, 'left'),
      label('Event', [11, -1], [1004, 39], '', 21, pigment.ink, 'left'),
      button('Replay', [-401, -60], [233, 44], '下一条战斗事件'),
      button('Auto', [-143, -60], [233, 44], '暂停回放'),
      button('NewSeed', [115, -60], [233, 44], '新一局'),
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
