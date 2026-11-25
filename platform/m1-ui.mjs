const plane = 100001;
const disc = 106025;
const fadedTeal = 107012;
const ticket = 106053;
export const portraitLayers = 16;
export const pigment = {
  edge: '#3a5541', canvas: '#fff0ce', ink: '#28352a', muted: '#40573d', cream: '#fff8e5',
  field: '#8cc8bc', rail: '#dcecd7', opposingRail: '#ebc8ad', rule: '#57856c',
  shelf: '#edc985', shelfRule: '#92663c', chip: '#edf3dd', primary: '#f5a13c',
  player: '#91be8a', enemy: '#cc966e', market: '#e5b565', gold: '#805015', ice: '#245f72',
};

export function image(name, position, size, colour, options = {}) {
  return { name, kind: 'image', position, size, image: plane, colour, ...options };
}

export function roundedPlate(name, position, size, imageId, colour = '#ffffff') {
  return image(name, position, size, colour, { image: imageId });
}

function ellipse(name, position, size, colour, options = {}) {
  return image(name, position, size, colour, { image: disc, ...options });
}

export function terrain(name, position, size, colour, options = {}) {
  return image(name, position, size, colour, { image: 100002, ...options });
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
  return group('Portrait', [0, 27], [84, 84], layers);
}

function card(name, position, width, type, interactive = true, visible = true, front = false) {
  const size = [width, 154];
  const market = type === 'market';
  const badgeWidth = market ? 60 : 49;
  const badgeX = market ? 35 : 26;
  const children = [
    ...(type === 'player' ? [image('DropTarget', [0, 6], [104, 54], '#438d7e', { image: fadedTeal, visible: false })] : []),
    ...(interactive ? [image('Selected', [0, 6], [102, 47], '#d19a3f', { image: 107015, visible: false })] : []),
    roundedPlate('Rim', [0, 5], [96, 41], fadedTeal, pigment.edge),
    roundedPlate('Face', [0, 8], [87, 32], fadedTeal, pigment[type]),
    ...(front ? [image('Front', [type === 'enemy' ? -40 : 40, 13], [21, 22], '#94531e',
      { image: type === 'enemy' ? 100104 : 100103 })] : []),
    portrait(),
    label('Name', [0, -18], [width - 4, 32], '', market ? 24 : 22),
    image('StatsPaper', [-badgeX, -49], [badgeWidth, 34], '#e2edf6'),
    terrain('LifePaper', [badgeX, -49], [badgeWidth, 36], '#f9d8ce'),
    label('Detail', [-badgeX, -49], [badgeWidth, 35], '', 25, '#253e58'),
    label('LifeValue', [badgeX, -49], [badgeWidth, 35], '', 25, '#813830'),
    label('Tag', [0, 61], [Math.min(width - 4, 90), 29], '', 18, market ? pigment.ice : '#58431f'),
  ];
  if (market) {
    children.push(
      roundedPlate('PriceTicket', [55, 46], [54, 34], ticket, '#ffdc80'),
      label('Price', [55, 46], [50, 32], '', 21, '#634016'),
      image('Frozen', [-39, 61], [19, 19], pigment.ice, { image: 102004, visible: false }),
    );
  } else {
    children.push(
      image('HealthTrack', [0, -71], [88, 4], '#c9d8b2', { visible: false }),
      image('Health', [0, -71], [88, 4], '#448269', { visible: false }),
    );
  }
  if (type === 'player') {
    children.push(
      roundedPlate('XPPaper', [0, 63], [width - 8, 28], ticket, '#e1edcf'),
      label('XP', [0, 63], [width - 8, 28], '', 17),
      label('DropLabel', [0, -18], [width - 4, 32], '', 22, '#194f44'),
    );
  }
  if (interactive) {
    children.push({ name: 'Hit', kind: 'cursorArea', size });
  }
  return group(name, position, size, children, visible);
}

export function button(name, position, size, title, primary = false, fontSize = primary ? 28 : 20) {
  const blue = ['Freeze', 'Auto', 'Fast'].includes(name);
  const buttonSurface = primary ? roundedPlate('Face', [0, 2], [size[0] - 6, size[1] - 8], 107015, '#fff5da')
    : blue ? roundedPlate('Face', [0, 2], [size[0] - 6, size[1] - 8], fadedTeal, '#81a997')
    : terrain('Face', [0, 2], [size[0] - 4, size[1] - 7], '#fff3ce');
  return group(name, position, size, [
    primary ? roundedPlate('Rim', [0, 0], size, 107015, '#a06339')
      : blue ? roundedPlate('Rim', [0, 0], size, fadedTeal, '#3c634d') : terrain('Rim', [0, 0], size, '#776d49'),
    buttonSurface,
    label('Title', [0, 2], [size[0] - 20, size[1] - 10], title, fontSize, blue ? '#fffdf2' : '#39291b'),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

function stat(name, x, title, paper, number) {
  return group(name, [x, 281], [152, 65], [
    image('Surface', [0, 0], [152, 65], paper),
    label('Label', [0, 18], [144, 28], title, 17, pigment.muted),
    label('Value', [0, -15], [144, 35], '', name === 'Round' ? 23 : 28, number),
  ]);
}

const slots = [1, 2, 3, 4, 5];
const offers = ['Pet1', 'Pet2', 'Pet3', 'Food1', 'Food2', 'Reward'];
export const sharedPortraitHomes = offers.slice(0, slots.length).map(name => `Shop/${name}`);
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
    image('Border', [0, 0], [1202, 684], '#42533a'),
    image('Panel', [0, 0], [1192, 674], '#e4e6ba'),
    image('Header', [0, 280], [1172, 98], '#f9edce'),
    label('Heading', [-373, 303], [374, 46], '小动物自走棋', 39, pigment.ink, 'left'),
    button('OpenMenu', [-486, 255], [142, 48], '菜单'),
    button('Reset', [-328, 255], [142, 48], '重开本局'),
    stat('Round', -105, '回合', '#d5efe9', pigment.ink),
    stat('Money', 69, '金币', '#ffedba', '#7c4618'),
    stat('Wins', 243, '胜场', '#dcedc3', '#2b5c40'),
    stat('Lives', 417, '生命', '#f9dfcb', '#893e2e'),
    group('Field', [0, 61], [1172, 334], [
      image('Surface', [0, 0], [1172, 334], '#bbdfdd'),
      image('Cloud', [342, 122], [199, 47], '#ffffff', { image: 105102 }),
      terrain('Ridge', [72, 48], [1004, 157], '#6d9e8d'),
      terrain('Divider', [-192, 34], [766, 147], '#55805f'),
      image('Ground', [0, -56], [1172, 221], '#94b36a'),
      terrain('PrepRail', [0, -25], [1172, 154], '#e1bb72'),
      image('LeftBrush', [-470, -103], [214, 92], '#a4b27a', { image: 105135 }),
      image('RightBrush', [467, -111], [228, 82], '#a0b977', { image: 105136 }),
      image('Foreground', [-380, -137], [98, 54], '#89a468', { image: 105137 }),
    ]),
    label('TeamCaption', [-309, 208], [521, 32], '', 19, pigment.ink, 'left'),
    label('OpponentCaption', [309, 208], [521, 32], '', 19, pigment.ink, 'right'),
    ...slots.map(slot => card(`Team${slot}`, [(3 - slot) * 176, 104], 106, 'player', true, true, slot === 1)),
    ...slots.map(slot => card(`Enemy${slot}`, [82 + (slot - 1) * 112, 54], 106, 'enemy', false, false, slot === 1)),
    group('Shop', [0, -124], [1164, 428], [
      image('Paper', [0, 0], [1164, 268], '#e8c880'),
      image('Rail', [0, 0], [1128, 174], '#f9e5b2'),
      label('Caption', [-465, 106], [198, 28], '', 24, pigment.ink, 'left'),
      ...offers.map((name, index) => card(name, [-465 + index * 186, 0], 174, 'market')),
      ...actions.map(([name, title], index) => button(name, [(index - 2) * 232, -104], [172, 52], title)),
      button('Reroll', [-455, -172], [206, playButtonHeight], '刷新', true),
    ]),
    group('Tooltip', [0, -10], [420, 86], [
      image('Border', [0, 0], [420, 86], '#4d623c'),
      image('Paper', [0, 0], [414, 82], '#fff8e2'),
      ellipse('Pointer', [0, -40], [14, 6], pigment.edge),
      label('Heading', [0, 24], [384, 34], '', 23, pigment.ink, 'left'),
      label('Body', [0, -16], [384, 46], '', 19, pigment.ink, 'left'),
    ], false),
    group('BattleFX', [0, 118], [1184, 208], [
      group('Strike', [0, 0], [66, 38], [
        ellipse('Wake', [0, 0], [64, 8], '#c68b43'),
        ellipse('Glint', [0, 0], [52, 4], '#ffe7a4'),
        ellipse('Upper', [-9, 11], [29, 5], '#f8e1a1'),
      ], false),
      group('Impact', [0, 0], [66, 50], [
        ellipse('Burst', [0, 0], [64, 41], '#f3c58a'),
        ellipse('Flash', [0, 0], [52, 33], '#fff2d6'),
        ellipse('Spark', [30, 16], [5, 8], '#ad623c'),
        label('Value', [0, 0], [54, 30], '', 24, '#8f3c30'),
      ], false),
    ], false),
    group('Battle', [0, -174], [1152, 154], [
      image('Surface', [0, 0], [1148, 154], '#e6e9bb'),
      label('Outcome', [0, 60], [1038, 34], '', 28, pigment.ink),
      label('Event', [0, 29], [1038, 28], '', 20, pigment.ink),
      button('Replay', [-222, -33], [202, playButtonHeight], '下一条战斗事件'),
      button('Auto', [0, -33], [202, playButtonHeight], '暂停回放'),
      button('Fast', [222, -33], [202, playButtonHeight], '速度：1 倍'),
      button('Rewatch', [-111, -33], [202, playButtonHeight], '重新回放'),
      button('NewSeed', [111, -33], [202, playButtonHeight], '新一局'),
    ], false),
    button('Primary', [411, -296], [329, playButtonHeight], '开战', true),
    label('Hint', [-153, -292], [824, 53], '', 19, pigment.ink, 'left'),
    { ...group('Menu', [0, 0], [1202, 684], [
      image('Backdrop', [0, 0], [1202, 684], '#a3be82'),
      image('Rim', [0, 0], [556, 416], pigment.edge),
      image('Paper', [0, 2], [548, 406], pigment.cream),
      label('Heading', [0, 134], [500, 63], '小动物自走棋', 43),
      label('Progress', [0, 55], [496, 28], '', 21, pigment.muted),
      button('Continue', [0, 0], [334, 56], '单人练习', true),
      button('NewGame', [0, -68], [334, 52], '放弃并开新局'),
      button('Difficulty', [0, -68], [334, 52], '练习难度：标准'),
      button('Audio', [0, -139], [334, 48], '音效：开启'),
    ], false), blockCursor: true },
    { ...group('Restart', [0, 0], [1202, 684], [
      image('Shade', [0, 0], [1202, 684], pigment.ink, { opacity: 0.65 }),
      image('Paper', [0, 7], [610, 224], pigment.cream),
      label('Heading', [0, 68], [560, 44], '重开本局？', 31),
      label('Body', [0, 15], [560, 39], '清空本局阵容与战绩，用同一种子开始。', 20),
      button('Cancel', [-135, -56], [230, 50], '继续本局'),
      button('Confirm', [135, -56], [230, 50], '确认重开', true),
    ], false), blockCursor: true },
  ],
};
