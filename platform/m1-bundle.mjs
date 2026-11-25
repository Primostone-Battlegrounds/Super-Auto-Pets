import assert from 'node:assert/strict';
import fs from 'node:fs';
import { portraitLayers } from './m1-ui.mjs';

function bundleModules(parse, names, entry, release, prefix = []) {
  const modules = release ? [...names, 'release_data'] : names;
  const validModules = new Set(modules.map(name => `autopets.${name}`));
  const catalog = release ? 'autopets.release_data' : 'autopets.data';
  function convert(relativePath) {
    let source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const references = [];
    parse(source, {
      luaVersion: '5.3', ranges: true, scope: true, comments: false,
      onCreateNode(node) {
        if (node.base?.name !== 'require' || node.base.isLocal) return;
        if (!['CallExpression', 'StringCallExpression', 'TableCallExpression'].includes(node.type)) return;
        const literal = node.type === 'CallExpression' ? node.arguments[0] : node.argument;
        const moduleName = literal?.raw?.slice(1, -1);
        assert.ok(validModules.has(moduleName), `Unknown module ${moduleName} in ${relativePath}`);
        references.push(node.base.range);
      },
    });
    for (const [start, end] of references.sort(([left], [right]) => right - left)) {
      source = source.slice(0, start) + 'loadAutoPetsModule' + source.slice(end);
    }
    return source;
  }

  const factories = modules.map(name => {
    const file = name === 'native_portrait' ? './native_portrait.lua' : `../src/autopets/${name}.lua`;
    return `factories['autopets.${name}'] = function()\n${convert(file)}\nend`;
  });
  return [
    ...prefix,
    'local factories, loaded, loading = {}, {}, {}',
    'local function loadAutoPetsModule(name)',
    '    if loaded[name] == nil then',
    '        assert(not loading[name], "cyclic AutoPets dependency: " .. name)',
    '        loading[name] = true',
    '        loaded[name] = assert(factories[name], name)()',
    '        loading[name] = nil',
    '    end',
    '    return loaded[name]',
    'end',
    ...factories,
    `local native_catalog = loadAutoPetsModule('${catalog}')`,
    typeof entry === 'function' ? entry(convert) : convert(entry),
  ].join('\n\n');
}

export function bundleRun(parse, release = false, entry = './m1_ui.lua') {
  const names = ['data', 'rng', 'battle_receipt', 'shop', 'bot', 'battle', 'run', 'art', 'native_portrait',
    'shop_wire', 'animal_ability', 'replay_view'];
  return bundleModules(parse, names, entry, release, [`local portrait_layers = ${portraitLayers}`]);
}

export function bundleBattleReplay(parse, entry, release = false) {
  return bundleModules(parse, ['data', 'rng', 'battle_receipt', 'battle', 'shop_wire', 'animal_ability', 'replay_view'], entry, release);
}
