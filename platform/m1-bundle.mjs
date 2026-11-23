import assert from 'node:assert/strict';
import fs from 'node:fs';

const names = ['data', 'rng', 'shop', 'bot', 'battle', 'run'];
const validModules = new Set(names.map(name => `autopets.${name}`));

export function bundleRun(parse) {
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

  const factories = names.map(name =>
    `factories['autopets.${name}'] = function()\n${convert(`../src/autopets/${name}.lua`)}\nend`,
  );
  return [
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
    convert('./m1_ui.lua'),
  ].join('\n\n');
}
