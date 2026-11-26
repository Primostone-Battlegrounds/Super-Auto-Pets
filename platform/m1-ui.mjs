const plane = 100001;
const disc = 106025;
const fadedTeal = 107012;
const ticket = 106053;
const attackIcon = 102035;
const lifeIcon = 102018;
const priceIcon = 102040;
const levelIcon = 101033;
export const portraitLayers = 16;
export const pigment = {
  edge: '#3a5541', canvas: '#fff0ce', ink: '#28352a', muted: '#40573d', cream: '#fff8e5',
  field: '#8cc8bc', rail: '#dcecd7', opposingRail: '#ebc8ad', rule: '#57856c',
  shelf: '#edc985', shelfRule: '#92663c', chip: '#edf3dd', primary: '#f5a13c',
  player: '#91be8a', enemy: '#cc966e', market: '#e5b565', gold: '#805015', ice: '#245f72',
};
export const preparationColours = {
  header: '#fff0cd',
  grass: '#a9cb76',
  grassLight: '#c6df9c',
  grassDark: '#7da256',
  shelf: '#ebc68b',
  shelfInset: '#f5dda9',
  priceInk: '#573319',
  pricePaper: '#ffe39b',
  badgeInk: '#254333',
  badgePaper: '#e1edc0',
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
  const size = [front ? width + 22 : width, 154];
  const market = type === 'market';
  const badgeWidth = market ? 54 : 49;
  const badgeX = market ? 34 : 26;
  const children = [
    ...(type === 'player' ? [image('DropTarget', [0, 6], [104, 54], '#438d7e', { image: fadedTeal, visible: false })] : []),
    ...(interactive && !market ? [image('Selected', [0, 6], [102, 47], '#d19a3f', { image: 107015, visible: false })] : []),
    roundedPlate('Rim', [0, 5], [90, 34], ticket, pigment.edge),
    roundedPlate('Face', [0, 9], [90, 34], ticket, pigment[type]),
    ...(front ? [image('Front', [type === 'enemy' ? -52 : 52, 7], [22, 22], '#6d4219',
      { image: type === 'enemy' ? 100104 : 100103 })] : []),
    portrait(),
    label('Name', [0, -18], [width - 4, 32], '', market ? 24 : 22),
    image('StatsPaper', [-badgeX - 12, -49], [20, 20], '#253e58', { image: attackIcon }),
    image('LifePaper', [badgeX - 12, -49], [20, 20], '#813830', { image: lifeIcon }),
    label('Detail', [-badgeX + 10, -49], [badgeWidth - 14, 35], '', 25, '#253e58'),
    label('LifeValue', [badgeX + 9, -49], [badgeWidth - 14, 35], '', 25, '#813830'),
    market ? preparationBadge('Tag', [-42, 58], [70, 34])
      : label('Tag', [0, 61], [Math.min(width - 4, 90), 29], '', 18, '#58431f'),
  ];
  if (market) {
    const price = label('Price', [52, 49], [49, 40], '', 20, preparationColours.priceInk);
    Object.assign(price.text, { background: preparationColours.pricePaper, backgroundOpacity: 1 });
    children.push(
      price,
      image('PriceIcon', [19, 49], [19, 19], preparationColours.priceInk, { image: priceIcon, visible: false }),
      image('Frozen', [-48, 23], [20, 20], pigment.ice, { image: 102004, visible: false }),
    );
  } else {
    children.push(
      image('HealthTrack', [0, -71], [88, 4], '#c9d8b2', { visible: false }),
      image('Health', [0, -71], [88, 4], '#448269', { visible: false }),
    );
  }
  if (type === 'player') {
    children.push(
      image('XPPaper', [-45, 63], [16, 16], '#986320', { image: levelIcon }),
      label('XP', [8, 63], [width - 16, 28], '', 17),
      label('DropLabel', [0, -18], [width - 4, 32], '', 22, '#194f44'),
    );
  }
  if (interactive) {
    children.push(market
      ? { name: 'Hit', kind: 'cursorArea', position: [0, 12], size: [width, 130] }
      : { name: 'Hit', kind: 'cursorArea', size: [width, size[1]] });
  }
  return group(name, position, size, children, visible);
}

export function preparationBadge(name, position, size, content = '') {
  const badge = label(name, position, size, content, 18, preparationColours.badgeInk);
  Object.assign(badge.text, { background: preparationColours.badgePaper, backgroundOpacity: 1 });
  return badge;
}

export function button(name, position, size, title, primary = false, fontSize = primary ? 28 : 20) {
  const blue = ['Freeze', 'Auto', 'Fast'].includes(name);
  const refresh = name === 'Reroll';
  const buttonSurface = primary ? roundedPlate('Face', [0, 2], [size[0] - 6, size[1] - 8], 107015, '#fff5da')
    : blue ? roundedPlate('Face', [0, 2], [size[0] - 6, size[1] - 8], fadedTeal, '#81a997')
    : terrain('Face', [0, 2], [size[0] - 4, size[1] - 7], '#fff3ce');
  const rim = primary ? roundedPlate('Rim', [0, 0], size, 107015, '#a06339')
    : blue ? roundedPlate('Rim', [0, 0], size, fadedTeal, '#3c634d') : terrain('Rim', [0, 0], size, '#776d49');
  return group(name, position, size, [
    ...(refresh ? [buttonSurface, image('Rim', [-76, 0], [27, 27], '#8c5723', { image: 101049 })] : [rim, buttonSurface]),
    label('Title', [refresh ? 16 : 0, 2], [size[0] - (refresh ? 50 : 20), size[1] - 10], title,
      fontSize, blue ? '#fffdf2' : '#39291b'),
    { name: 'Hit', kind: 'cursorArea', size },
  ]);
}

function stat(name, x, title, glyph, colour) {
  const round = name === 'Round';
  return group(name, [x, 307], [round ? 180 : 116, 64], [
    image('Surface', [-41, 6], [23, 23], colour, { image: glyph }),
    label('Label', [8, -17], [83, 28], title, 15, pigment.muted),
    label('Value', [round ? 13 : 11, 11], [round ? 150 : 87, 40], '', 24, colour),
  ]);
}

function settings() {
  return group('OpenMenu', [522, 313], [112, 82], [
    roundedPlate('Face', [0, 0], [104, 48], 107015, '#fff8df'),
    image('Rim', [-29, 0], [22, 22], pigment.muted, { image: 101063 }),
    label('Title', [14, 0], [70, 36], '设置', 21),
    { name: 'Hit', kind: 'cursorArea', size: [112, 82] },
  ]);
}
const slots = [1, 2, 3, 4, 5];
const offers = ['Pet1', 'Pet2', 'Pet3', 'Food1', 'Food2', 'Reward'];
const offerX = [-464, -288, -112, 110, 282, 464];
export const sharedPortraitHomes = offers.slice(0, slots.length).map(name => `Shop/${name}`);
const actions = [
  ['Buy', '购买', [-250, -102]],
  ['Freeze', '冻结 / 解冻', [0, -101]],
  ['Sell', '出售', [0, 129]],
  ['Merge', '合并队员', [0, -102]],
  ['RewardNext', '下个奖励', [464, -102]],
];

function battlePanel(unified) {
  const positions = unified ? [[164, 239], [-164, 239], [0, 239]] : [[-222, -33], [0, -33], [222, -33]];
  const replayButton = unified ? [144, 82] : [202, 82];
  return group('Battle', [0, unified ? -15 : -174], unified ? [1200, 622] : [1152, 154], [
    image('Surface', [0, unified ? -192 : 0], unified ? [1200, 178] : [1148, 154], preparationColours.shelfInset),
    label('Outcome', [0, unified ? -121 : 60], [1074, unified ? 36 : 34], '', 27, pigment.ink),
    label('Event', [0, unified ? -158 : 29], [1074, unified ? 34 : 28], '', 20, pigment.ink),
    button('Replay', positions[0], replayButton, unified ? '跳过' : '下一条战斗事件'),
    button('Auto', positions[1], replayButton, '暂停'),
    button('Fast', positions[2], replayButton, '倍速 ×1'),
    button('Rewatch', [-111, unified ? -225 : -33], [202, 82], '重新回放'),
    button('NewSeed', [111, unified ? -225 : -33], [202, 82], '新一局'),
  ], false);
}

export const unifiedRun = {
  name: 'AutoPetsRun',
  script: 'auto_pets_run',
  showCursor: true,
  blockCursor: true,
  blockKeys: true,
  controls: [
    image('Border', [0, 0], [1202, 684], '#42533a'),
    image('Panel', [0, 0], [1192, 674], '#e4e6ba'),
    image('Header', [0, 307], [1200, 82], preparationColours.header),
    { ...label('Heading', [65, 306], [226, 44], '小动物自走棋', 26), visible: false },
    settings(),
    { ...button('Reset', [392, 306], [132, 48], '重开本局'), visible: false },
    stat('Money', -528, '金币', disc, '#83501b'),
    stat('Lives', -402, '生命', lifeIcon, '#893e2e'),
    stat('Wins', -276, '胜场', 102024, '#335c36'),
    stat('Round', -122, '回合', 101049, '#314f43'),
    group('Field', [0, 129], [1200, 282], [
      image('Surface', [0, 0], [1200, 282], preparationColours.grass),
      image('Cloud', [266, 103], [178, 38], '#f8f4d4', { image: 105102 }),
      terrain('Ridge', [92, 66], [1010, 123], preparationColours.grassLight),
      terrain('Divider', [-192, 59], [782, 112], preparationColours.grassDark),
      image('Ground', [0, -61], [1200, 160], preparationColours.grass),
      image('TrackShadow', [0, 10], [1200, 93], '#96b96a'),
      image('PrepRail', [0, 17], [1200, 88], '#bad78d'),
      image('RivalTrack', [300, -15], [600, 88], '#d3ba7e', { visible: false }),
      image('LeftBrush', [-520, 42], [152, 60], '#83a65b', { image: 105135 }),
      image('RightBrush', [502, 37], [170, 56], '#8daa62', { image: 105136 }),
      image('Foreground', [-519, -110], [126, 45], '#7da052', { image: 105135 }),
      image('Pine', [-453, 86], [45, 83], '#7c9a61', { image: 105098 }),
    ]),
    label('TeamCaption', [-309, 208], [521, 32], '', 22, pigment.ink, 'left'),
    label('OpponentCaption', [309, 208], [521, 32], '', 19, pigment.ink, 'right'),
    ...slots.map(slot => card(`Team${slot}`, [(3 - slot) * 176, 145], 106, 'player', true, true, slot === 1)),
    ...slots.map(slot => card(`Enemy${slot}`, [82 + (slot - 1) * 112, 54], 106, 'enemy', false, false, slot === 1)),
    group('Shop', [0, -106], [1200, 462], [
      image('Paper', [0, -64], [1200, 334], preparationColours.shelf),
      image('Rail', [0, 0], [1200, 166], preparationColours.shelfInset),
      label('Caption', [-465, 104], [199, 32], '', 20, pigment.ink, 'left'),
      ...offers.map((name, index) => card(name, [offerX[index], 0], 158, 'market')),
      ...actions.map(([name, title, position]) => ({
        ...button(name, position, [136, 82], title, false, 18),
        visible: false, active: false,
      })),
      button('Reroll', [-481, -185], [204, 82], '刷新', true),
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
      group('Impact', [0, 0], [86, 60], [
        ellipse('Burst', [0, 0], [64, 41], '#f3c58a'),
        ellipse('Flash', [0, 0], [52, 33], '#fff2d6'),
        image('Spark', [32, 18], [21, 21], '#315a6d', { image: 102036 }),
        label('Value', [0, 0], [54, 30], '', 24, '#8f3c30'),
      ], false),
    ], false),
    battlePanel(true),
    button('Primary', [481, -291], [204, 82], '开战', true),
    label('Hint', [0, -291], [690, 53], '', 19, pigment.ink),
    { ...group('Menu', [0, 0], [1202, 684], [
      image('Backdrop', [0, 0], [1202, 684], '#a3be82'),
      image('Rim', [0, 0], [556, 584], pigment.edge),
      image('Paper', [0, 2], [548, 576], pigment.cream),
      label('Heading', [0, 212], [500, 68], '小动物自走棋', 39),
      label('Progress', [0, 134], [496, 38], '', 21, pigment.muted),
      button('Continue', [0, 52], [334, 82], '单人练习', true),
      button('NewGame', [0, -38], [334, 82], '放弃并开新局'),
      button('Difficulty', [0, -38], [334, 82], '练习难度：标准'),
      button('Audio', [0, -128], [334, 82], '音效：开启'),
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

// Standalone rule probes keep their permanently bound controls available.
// The unified game instead reveals the same actions beside their own targets.
const auxiliaryActions = new Set(actions.map(([name]) => name));
export const nativeRun = {
  ...unifiedRun,
  controls: unifiedRun.controls.map(control => {
    if (control.name === 'Battle') return battlePanel(false);
    if (control.name !== 'Shop') return control;
    const children = control.children.filter(child => !auxiliaryActions.has(child.name));
    return { ...control, children: [...children,
      ...actions.map(([name, title], index) => button(name, [(index - 2) * 232, -116], [172, 48], title))] };
  }),
};
