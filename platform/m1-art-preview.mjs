import assert from 'node:assert/strict';
import { bundleRun } from './m1-bundle.mjs';
import { nativeRun } from './m1-ui.mjs';

const samples = {
  turtle: ['reed_turtle', '乌龟'],
  rabbit: ['cottontail_rabbit', '兔子'],
  cat: ['sunset_cat', '猫咪'],
  penguin: ['ember_swift', '企鹅'],
  giraffe: ['slate_muskdeer', '长颈鹿'],
  whale: ['tidal_narwhal', '鲸鱼'],
};

const commonNames = {
  pet_by_id: {
    alder_marmot: '旱獭', maple_fox: '狐狸', river_otter: '水獭', cloud_sheep: '绵羊', dawn_tapir: '貘',
    cinder_caracal: '狞猫', fern_quail: '鹌鹑', moon_yak: '牦牛', storm_kestrel: '红隼', mist_crane: '白鹤',
    frost_muskox: '麝牛', night_pangolin: '穿山甲',
  },
  food_by_id: {
    dew_berry: '浆果', sun_seed: '葵花籽', stone_jelly: '果冻', glow_bun: '蜂蜜点心', wind_rice: '米饭',
    golden_reed: '谷物汤', clear_plum: '青梅', fennel_twist: '茴香卷', honeyed_taro: '芋块',
    pearl_broth: '甜汤', winter_roselle: '洛神花', night_orchard: '水果拼盘',
  },
  token_by_id: { lambkin: '小羊', fern_chick: '小鹌鹑', tidal_calf: '小鲸鱼' },
};

export const artPreviewInterface = 'AutoPetsArtPractice';
export const artPreviewScript = 'auto_pets_art_practice';

export function artPractice(parse, rows) {
  assert.deepEqual(Object.keys(rows).sort(), Object.keys(samples).sort());
  const animals = Object.fromEntries(Object.entries(samples).map(([key, [id, name]]) => {
    const layers = rows[key];
    assert.ok(Array.isArray(layers) && layers.length > 0 && layers.length <= 40, key);
    for (const layer of layers) {
      assert.ok(Array.isArray(layer) && layer.every(Number.isFinite), key);
      assert.ok([100001, 106025, 100003].includes(layer[0]));
      assert.equal(layer.length, layer[0] === 100003 ? 11 : 8);
      assert.ok(layer[3] > 0 && layer[4] > 0, key);
      assert.ok(layer.slice(5, 8).every(value => Number.isInteger(value) && value >= 0 && value <= 255), key);
    }
    return [id, { name, layers }];
  }));
  const layersPerSlot = Math.max(16, ...Object.values(animals).map(animal => animal.layers.length));
  const resize = control => {
    if (control.name === 'Portrait') {
      return { ...control, children: Array.from({ length: layersPerSlot }, (_, index) =>
        ({ ...control.children[0], name: 'Layer' + (index + 1) })) };
    }
    if (!control.children) return control;
    const children = /^Enemy[1-5]$/u.test(control.name)
      ? control.children.filter(child => child.name !== 'Portrait')
      : control.children;
    if (control.name === 'Menu') {
      return { ...control, children: children.map(child => child.name === 'Heading'
        ? { ...child, text: { ...child.text, content: '单人练习 · 美术样板' } }
        : child) };
    }
    return { ...control, children: children.map(resize) };
  };
  const layout = { ...nativeRun, name: artPreviewInterface, script: artPreviewScript, controls: nativeRun.controls.map(resize) };
  const source = bundleRun(parse, true, './m1_ui.lua', layout, { animals, commonNames, layersPerSlot });
  assert.ok(Buffer.byteLength(source) <= 400_000, 'Practice source exceeds GIL authoring limit');
  parse(source, { luaVersion: '5.3' });
  return { layout, source, animals, layersPerSlot };
}
