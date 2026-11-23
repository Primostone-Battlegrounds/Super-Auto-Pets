const plane = 100001;
const disc = 106025;
const portraitLayers = 16;
const palette = {
  frame: '#46605c', ink: '#15292d', inset: '#1b3337', line: '#3b5553',
  night: '#203a3e', opponent: '#344143', parchment: '#eedcaa', paperEdge: '#b99153',
  light: '#f8e9c9', muted: '#c4d2bd', paperInk: '#392e24', paperMuted: '#5d4b37',
  gold: '#efbd73', mint: '#aad3aa', action: '#345455', primary: '#507754',
};

function image(name, position, size, colour, options = {}) {
  return { name, kind: 'image', position, size, image: plane, colour, ...options };
}

function label(name, position, size, content = '', fontSize = 20, colour = palette.light, align = 'centre') {
  return {
    name, kind: 'text', position, size,
    text: { content, fontSize, colour, align, valign: 'middle', outline: false },
  };
}

function group(name, position, size, children) {
  return { name, kind: 'container', position, size, children };
}

function portrait(x, paper) {
  return group('Portrait', [x, 5], [56, 56], [
    image('Medallion', [0, 0], [53, 53], paper ? '#d5b77c' : '#355254', { image: disc }),
    ...Array.from({ length: portraitLayers }, (_, index) =>
      image(`Layer${index + 1}`, [0, 0], [1, 1], palette.light, { visible: false })),
  ]);
}

function card(name, position, width, type, interactive = true) {
  const size = [width, 86];
  const paper = type === 'parchment';
  const portraitX = -width / 2 + 34;
  const children = [
    image('Rim', [0, 0], size, paper ? palette.paperEdge : palette.line),
    image('Face', [0, 0], [width - 4, 82], palette[type]),
    portrait(portraitX, paper),
    label('Name', [27, 15], [width - 66, 27], '', paper ? 17 : 20, paper ? palette.paperInk : palette.light),
    label('Detail', [27, -11], [width - 66, 23], '', 15, paper ? palette.paperMuted : palette.muted),
    label('Tag', [portraitX, -30], [58, 17], '', 12, paper ? palette.paperInk : palette.gold),
  ];
  if (paper) {
    children.push(image('Frozen', [27, -32], [width - 76, 4], '#458c99', { visible: false }));
  } else {
    children.push(
      image('HealthTrack', [27, -32], [width - 76, 4], '#101e22', { visible: false }),
      image('Health', [27, -32], [width - 76, 4], palette.mint, { visible: false }),
    );
  }
  if (interactive) {
    children.push(
      image('Selected', [0, -41], [width - 4, 4], paper ? '#bc7936' : palette.gold, { visible: false }),
      { name: 'Hit', kind: 'cursorArea', size },
    );
  }
  return group(name, position, size, children);
}

function button(name, position, size, title, tint = palette.action) {
  return group(name, position, size, [
    image('Rim', [0, 0], size, palette.frame),
    image('Face', [0, 0], [size[0] - 4, size[1] - 4], tint),
    label('Title', [0, 0], size, title, tint === palette.primary ? 24 : 17),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

function stat(name, x, title, tint) {
  return group(name, [x, 274], [144, 64], [
    image('Surface', [0, 0], [144, 64], palette.inset),
    label('Label', [0, 15], [140, 22], title, 15, palette.muted),
    label('Value', [0, -11], [140, 30], '', 22, tint),
  ]);
}

const positions = [-440, -220, 0, 220, 440];
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
  controls: [
    image('Border', [0, 0], [1146, 668], palette.frame),
    image('Panel', [0, 0], [1138, 660], palette.ink),
    image('Header', [0, 268], [1116, 106], '#213a3b'),
    image('Moon', [-503, 274], [57, 57], palette.gold, { image: disc }),
    image('MoonShade', [-489, 283], [46, 46], '#213a3b', { image: disc }),
    image('MoonSpark', [-476, 252], [7, 7], palette.gold, { image: disc }),
    label('Heading', [-246, 283], [426, 57], '小动物自走棋', 38, palette.light, 'left'),
    label('Seed', [-246, 245], [426, 25], '', 17, palette.muted, 'left'),
    stat('Round', 133, '行程', palette.light),
    stat('Wins', 289, '胜场', palette.gold),
    stat('Lives', 445, '生命', palette.mint),
    image('Divider', [0, 217], [1078, 2], palette.line),
    label('OpponentCaption', [-260, 198], [552, 25], '', 19, palette.muted, 'left'),
    ...positions.map((x, index) => card(`Enemy${index + 1}`, [x, 140], 206, 'opponent', false)),
    label('TeamCaption', [-260, 78], [552, 25], '营地小队 · 左侧为前排', 19, palette.muted, 'left'),
    ...positions.map((x, index) => card(`Team${index + 1}`, [x, 20], 206, 'night')),
    group('Shop', [0, -112], [1090, 220], [
      label('Caption', [-260, 61], [552, 28], '', 22, palette.gold, 'left'),
      ...offers.map((name, index) => card(name, [-450 + index * 180, 0], 166, 'parchment')),
      ...actions.map(([name, title], index) => button(name, [-450 + index * 180, -85], [166, 48], title)),
    ]),
    { ...group('Battle', [0, -131], [1090, 196], [
      image('Border', [0, 0], [1090, 196], palette.frame),
      image('Surface', [0, 0], [1082, 188], palette.inset),
      image('Rule', [-448, 51], [4, 51], palette.gold),
      label('Outcome', [33, 50], [930, 51], '', 32, palette.gold, 'left'),
      label('Event', [33, -4], [930, 42], '', 21, palette.light, 'left'),
      button('Replay', [-308, -62], [224, 47], '下一条战斗事件'),
      button('Auto', [-64, -62], [224, 47], '暂停回放'),
      button('NewSeed', [180, -62], [224, 47], '新一局'),
    ]), visible: false },
    image('FooterLine', [0, -237], [1078, 2], palette.line),
    button('Primary', [379, -281], [320, 60], '开战', palette.primary),
    label('Hint', [-191, -281], [670, 53], '', 19, palette.muted, 'left'),
  ],
};
