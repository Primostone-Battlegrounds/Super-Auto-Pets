import assert from 'node:assert/strict';
import { group, image, portraitLayers } from './m1-ui.mjs';

const samples = {
  turtle: ['reed_turtle', '乌龟'],
  rabbit: ['cottontail_rabbit', '兔子'],
  cat: ['sunset_cat', '猫咪'],
};

const commonNames = {
  pet_by_id: {
    ember_swift: '雨燕', slate_muskdeer: '麝', tidal_narwhal: '独角鲸',
    alder_marmot: '旱獭', maple_fox: '狐狸', river_otter: '水獭', cloud_sheep: '绵羊', dawn_tapir: '貘',
    cinder_caracal: '狞猫', fern_quail: '鹌鹑', moon_yak: '牦牛', storm_kestrel: '红隼', mist_crane: '白鹤',
    frost_muskox: '麝牛', night_pangolin: '穿山甲',
  },
  food_by_id: {
    dew_berry: '浆果', sun_seed: '葵花籽', stone_jelly: '果冻', glow_bun: '蜂蜜点心', wind_rice: '米饭',
    golden_reed: '谷物汤', clear_plum: '青梅', fennel_twist: '茴香卷', honeyed_taro: '芋块',
    pearl_broth: '甜汤', winter_roselle: '洛神花', night_orchard: '水果拼盘',
  },
  token_by_id: { lambkin: '小羊', fern_chick: '小鹌鹑', tidal_calf: '小独角鲸' },
};

export const fittedTemplateName = 'FittedPortraitLayers';

export function fittedTemplate(layersPerSlot) {
  const children = Array.from({ length: layersPerSlot - portraitLayers }, (_, index) =>
    image('Layer' + (portraitLayers + index + 1), [0, 0], [1, 1], '#ffffff', { visible: false, active: false }));
  return group(fittedTemplateName, [0, 0], [84, 84], children);
}

export function artPreview(rows) {
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
  const layersPerSlot = Math.max(portraitLayers, ...Object.values(animals).map(animal => animal.layers.length));
  return { animals, layersPerSlot, commonNames };
}
