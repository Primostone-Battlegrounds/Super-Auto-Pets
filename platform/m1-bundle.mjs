import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nativeRun, portraitLayers, sharedPortraitHomes } from './m1-ui.mjs';

// The GIL authoring service accepts the sprite ID on a control. Set its
// nine-slice mode through the native widget API after the tree is mounted.
function plateInitializer(controls) {
  const sliceImages = new Set([106046, 107011, 107012, 107013, 107015, 107102]);
  const paths = [];
  function visit(nodes, prefix) {
    for (const node of nodes) {
      const path = prefix + node.name;
      const onlineCapsule = node.image === 107034 && (path.startsWith('Duel/') || path.startsWith('Room/'));
      if (sliceImages.has(node.image) || onlineCapsule) paths.push(JSON.stringify(path));
      if (node.children) visit(node.children, `${path}/`);
    }
  }
  visit(controls, '');
  return `local function set_visual_plates(root)\n    for _, path in ipairs({${paths.join(',')}}) do\n        root:FindChild(path).imageType = Enum.ImageType.Stretch\n    end\nend`;
}

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

export function bundleRun(parse, release = false, entry = './m1_ui.lua', layout = nativeRun) {
  const names = ['data', 'rng', 'battle_receipt', 'shop', 'bot', 'battle', 'run', 'art', 'native_portrait',
    'shop_wire', 'animal_ability', 'replay_view'];
  return bundleModules(parse, names, entry, release, [
    `local portrait_layers = ${portraitLayers}`,
    `local shared_portrait_homes = {${sharedPortraitHomes.map(name => JSON.stringify(name)).join(',')}}`,
    plateInitializer(layout.controls),
  ]);
}

export function bundleBattleReplay(parse, entry, release = false) {
  return bundleModules(parse, ['data', 'rng', 'battle_receipt', 'battle', 'shop_wire', 'animal_ability', 'replay_view'], entry, release);
}
