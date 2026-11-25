// Isolated diagnostic only: uses the same label builder as the production practice UI.
import { image, label, button, pigment } from './m1-ui.mjs';
export const textSamples = Object.freeze({ latin: 'Shop 123 / Gold 10', cjk: '单人练习 · 金币 10' });
export const textDiagnostic = {
  name: 'AutoPetsTextDiagnostic', script: 'auto_pets_text_diagnostic',
  showCursor: true, blockCursor: true, blockKeys: true,
  controls: [
    image('Paper', [0, 0], [1080, 580], pigment.cream),
    label('Heading', [0, 234], [1000, 48], 'Text diagnostic · 文字诊断', 28),
    label('Columns', [0, 175], [1000, 36], 'Static / 静态                         Dynamic / 动态', 22),
    ...['latin', 'cjk'].flatMap((key, index) => [
      label(`Static${index}`, [-260, 90 - index * 100], [480, 62], textSamples[key], 26),
      label(`Dynamic${index}`, [260, 90 - index * 100], [480, 62], '', 26),
    ]),
    label('GeometryCaption', [0, -76], [1000, 28], 'Original title box / 原标题框             Auto-size / 自动适配', 20),
    { ...label('OriginalGeometry', [-260, -123], [374, 46], '小动物自走棋', 35),
      text: { ...label('x', [0, 0], [1, 1], '小动物自走棋', 35).text, autoSize: false } },
    label('FittedGeometry', [260, -123], [374, 46], '小动物自走棋', 35),
    button('Cycle', [0, -225], [360, 56], 'Update / 更新动态文字', true),
  ],
};
