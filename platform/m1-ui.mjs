const plane = 100001;
const disc = 106025;
export const portraitLayers = 16;
export const pigment = {
  edge: '#315d57', canvas: '#fff2d4', ink: '#243c3b', muted: '#3e5c56', cream: '#fff7de',
  field: '#8cc8bc', rail: '#dcecd7', opposingRail: '#ebc8ad', rule: '#57856c',
  shelf: '#ecc48a', shelfRule: '#92663c', chip: '#e8f2e4', primary: '#edb659',
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
    label('Name', [0, -19], [width - 4, 29], '', market ? 21 : 19),
    roundedPlate('StatsPaper', [0, -50], [width - 8, 30], 107102, market ? '#fff4d8' : '#edf6e8'),
    label('Detail', [0, -50], [width - 8, 30], '', 21),
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

export function button(name, position, size, title, primary = false, fontSize = primary ? 28 : 20) {
  const blue = name === 'Freeze' || name === 'Auto' || name === 'Fast';
  const fill = primary ? 107015 : blue ? 107013 : 107102;
  return group(name, position, size, [
    roundedPlate('Rim', [0, 0], size, 107011, primary ? '#685130' : '#325650'),
    roundedPlate('Face', [0, 2], [size[0] - 6, size[1] - 8], fill, blue ? '#6d91af' : '#ffffff'),
    label('Title', [0, 2], [size[0] - 20, size[1] - 10], title, fontSize, blue ? '#fffdf2' : '#2b311d'),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

function stat(name, x, title, paper, number) {
  return group(name, [x, 281], [152, 65], [
    roundedPlate('Surface', [0, 0], [152, 65], 107102, paper),
    label('Label', [0, 19], [144, 24], title, 17, pigment.muted),
    label('Value', [0, -12], [144, 36], '', name === 'Round' ? 23 : 29, number),
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
    roundedPlate('Border', [0, 0], [1202, 684], 107011, '#24443c'),
    roundedPlate('Panel', [0, 0], [1192, 674], 107102, '#fff1ce'),
    roundedPlate('Header', [0, 280], [1172, 98], 107102, '#e8f6e7'),
    label('Heading', [-373, 303], [374, 46], '小动物自走棋', 39, pigment.ink, 'left'),
    button('OpenMenu', [-486, 255], [142, 48], '菜单'),
    button('Reset', [-328, 255], [142, 48], '重开本局'),
    stat('Round', -105, '回合', '#d5efe9', pigment.ink),
    stat('Money', 69, '金币', '#ffedba', '#7c4618'),
    stat('Wins', 243, '胜场', '#dcedc3', '#2b5c40'),
    stat('Lives', 417, '生命', '#f9dfcb', '#893e2e'),
    group('Field', [0, 119], [1172, 218], [
      image('Surface', [0, 0], [1172, 218], '#b9e4e7'),
      ellipse('Divider', [-188, 26], [794, 124], '#82bca5'),
      ellipse('FarHill', [259, 18], [650, 138], '#75a982'),
      image('Ground', [0, -68], [1172, 82], '#8fb66e'),
      roundedPlate('PrepRail', [0, -20], [874, 142], 107102, '#f9e6ad'),
      { ...roundedPlate('AllyRail', [-305, -20], [548, 142], 107102, '#e6efc5'), visible: false },
      { ...roundedPlate('RivalRail', [305, -20], [548, 142], 107102, '#f2cbab'), visible: false },
      ellipse('Clash', [0, 4], [23, 23], '#faf5e6', { visible: false }),
    ]),
    label('TeamCaption', [-309, 208], [521, 32], '', 19, pigment.ink, 'left'),
    label('OpponentCaption', [309, 208], [521, 32], '', 19, pigment.ink, 'right'),
    ...slots.map(slot => card(`Team${slot}`, [(3 - slot) * 176, 104], 106, 'player')),
    ...slots.map(slot => card(`Enemy${slot}`, [91 + (slot - 1) * 112, 115 - (slot - 1) * 9], 106, 'enemy', false, false)),
    image('FooterLine', [0, -262], [1152, 2], pigment.edge),
    group('Shop', [0, -124], [1164, 428], [
      roundedPlate('Paper', [0, 0], [1164, 268], 107102, '#ffeaca'),
      roundedPlate('Rail', [0, 0], [1128, 164], 107102, '#ebc389'),
      image('Rule', [0, 83], [1128, 2], pigment.shelfRule),
      image('FoodDivider', [0, 0], [2, 146], pigment.shelfRule),
      image('RewardDivider', [372, 0], [2, 146], pigment.shelfRule),
      label('Caption', [-465, 106], [198, 28], '', 24, pigment.ink, 'left'),
      ...offers.map((name, index) => card(name, [-465 + index * 186, 0], 174, 'market')),
      ...actions.map(([name, title], index) => button(name, [(index - 2) * 232, -104], [172, 52], title)),
      button('Reroll', [-455, -172], [206, playButtonHeight], '刷新', true),
    ]),
    group('Tooltip', [0, -10], [360, 72], [
      roundedPlate('Border', [0, 0], [360, 72], 107011, '#325650'),
      roundedPlate('Paper', [0, 0], [354, 68], 107102),
      ellipse('Pointer', [0, -33], [12, 6], pigment.edge),
      label('Heading', [0, 22], [326, 28], '', 20, pigment.ink, 'left'),
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
    group('Battle', [0, -137], [1152, 220], [
      roundedPlate('Border', [0, 0], [1152, 220], 107011, pigment.edge),
      roundedPlate('Surface', [0, 1], [1144, 212], 107102, '#eff2d7'),
      roundedPlate('Rule', [-537, 63], [9, 48], 107015),
      label('Outcome', [0, 72], [1038, 38], '', 32, pigment.ink, 'left'),
      label('Event', [0, 34], [1038, 32], '', 22, pigment.ink, 'left'),
      button('Replay', [-430, -45], [202, playButtonHeight], '下一条战斗事件'),
      button('Auto', [-216, -45], [202, playButtonHeight], '暂停回放'),
      button('Fast', [-2, -45], [202, playButtonHeight], '速度：1 倍'),
      button('Rewatch', [212, -45], [202, playButtonHeight], '重新回放'),
      button('NewSeed', [426, -45], [202, playButtonHeight], '新一局'),
    ], false),
    button('Primary', [411, -296], [329, playButtonHeight], '开战', true),
    label('Hint', [-153, -292], [824, 53], '', 19, pigment.ink, 'left'),
    { ...group('Menu', [0, 0], [1202, 684], [
      roundedPlate('Backdrop', [0, 0], [1202, 684], 107102, '#9fcfc0'),
      roundedPlate('Rim', [0, 0], [556, 416], 107011, pigment.edge),
      roundedPlate('Paper', [0, 2], [548, 406], 107102, pigment.cream),
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
      roundedPlate('Rim', [0, 5], [620, 234], 107011, pigment.edge),
      roundedPlate('Paper', [0, 7], [610, 224], 107102, pigment.cream),
      label('Heading', [0, 68], [560, 44], '重开本局？', 31),
      label('Body', [0, 15], [560, 39], '清空本局阵容与战绩，用同一种子开始。', 20),
      button('Cancel', [-135, -56], [230, 50], '继续本局'),
      button('Confirm', [135, -56], [230, 50], '确认重开', true),
    ], false), blockCursor: true },
  ],
};
