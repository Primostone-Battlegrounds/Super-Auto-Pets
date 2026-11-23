const plane = 100001;
const colour = {
  panel: '#111d2b', team: '#243e48', opponent: '#382c40', shop: '#253442',
  text: '#f3efdf', muted: '#aec1c6', gold: '#efba66', action: '#35545b', primary: '#366e57',
};

function image(name, position, size, tint, visible = true) {
  return { name, kind: 'image', position, size, image: plane, colour: tint, visible };
}

function label(name, position, size, content = '', fontSize = 20, tint = colour.text, align = 'centre') {
  return {
    name, kind: 'text', position, size,
    text: { content, fontSize, colour: tint, align, valign: 'middle', outline: false },
  };
}

function group(name, position, size, children) {
  return { name, kind: 'container', position, size, children };
}

function card(name, position, width, tint, interactive = true) {
  const size = [width, 72];
  const children = [
    image('Face', [0, 0], size, tint),
    label('Name', [0, 13], [width - 12, 29]),
    label('Detail', [0, -14], [width - 8, 26], '', 16, colour.muted),
  ];
  if (interactive) {
    children.push(
      image('Selected', [0, -33], [width - 12, 4], colour.gold, false),
      { name: 'Hit', kind: 'cursorArea', size },
    );
  }
  return group(name, position, size, children);
}

function button(name, position, size, title, tint = colour.action) {
  return group(name, position, size, [
    image('Face', [0, 0], size, tint),
    label('Title', [0, 0], size, title, 20),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

const line = [-384, -192, 0, 192, 384];
const sections = ['Pet1', 'Pet2', 'Pet3', 'Food1', 'Food2', 'Reward'];
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
    image('Panel', [0, 0], [1008, 596], colour.panel),
    label('Heading', [-238, 265], [470, 40], '小动物自走棋', 34, colour.text, 'left'),
    label('Meter', [227, 265], [495, 40], '', 21, colour.gold, 'right'),
    label('OpponentCaption', [-237, 220], [470, 26], '', 18, colour.muted, 'left'),
    ...line.map((x, index) => card(`Enemy${index + 1}`, [x, 165], 174, colour.opponent, false)),
    label('TeamCaption', [-237, 116], [470, 26], '我的阵容 · 左侧为前排', 18, colour.muted, 'left'),
    ...line.map((x, index) => card(`Team${index + 1}`, [x, 65], 174, colour.team)),
    group('Shop', [0, -63], [968, 220], [
      label('Caption', [-237, 48], [470, 26], '', 18, colour.muted, 'left'),
      ...sections.map((name, index) => card(name, [-400 + index * 160, 0], 146, colour.shop)),
      ...actions.map(([name, title], index) => button(name, [-400 + index * 160, -83], [146, 50], title)),
    ]),
    { ...group('Battle', [0, -80], [968, 160], [
      label('Outcome', [0, 63], [900, 30], '', 24, colour.gold),
      label('Event', [0, 13], [914, 43], '', 23),
      button('Replay', [0, -52], [178, 50], '下一条战斗事件'),
    ]), visible: false },
    button('Primary', [0, -221], [232, 59], '开战', colour.primary),
    label('Hint', [0, -273], [963, 34], '', 19, colour.muted),
  ],
};
