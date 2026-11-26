import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { nativeSimulatorSave, sha256 } from '../../scripts/simulator-native.mjs';

const [mcp, simulator] = process.argv.slice(2).map(directory => fs.realpathSync(directory));
assert.ok(mcp && simulator, 'Usage: node tests/simulator/native-templates.test.mjs <MCP> <Simulator>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
const load = (directory, file) => import(pathToFileURL(path.join(directory, file)));
const [{ Service }, { toolRegistry }, api] = await Promise.all([
  load(mcp, 'src/core.mjs'), load(mcp, 'src/tool-registry.mjs'), load(simulator, 'studio/play/session.js'),
]);
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-native-template-'));
try {
  const input = path.join(workspace, 'input.gil');
  fs.copyFileSync(path.join(mcp, 'tests/fixtures/editor-2026-10-26-shapes.gil'), input);
  const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
  assert.equal(sha256(fs.readFileSync(input)), fixtureHash);
  const service = new Service({ workspace, saveRoots: [], allowLive: false });
  assert.equal(service.capabilities().liveWriteEnabled, false);
  const tools = toolRegistry(service);
  let mapPath = input;
  async function stage(name, arguments_) {
    const tool = tools.find(entry => entry.name === name);
    const result = await tool.method(tool.schema.parse({ mapPath, ...arguments_ }));
    assert.equal(result.failed, undefined, JSON.stringify(result));
    mapPath = fs.realpathSync(result.mapPath);
    assert.ok(mapPath.startsWith(workspace + path.sep) && mapPath !== input);
    return result;
  }
  const group = (name, position, children=[]) => ({name, kind:'container', position, size:[88,88], children});
  const layer = (name, position, image, visible=true) =>
    ({name, kind:'image', position, size:[13,7], image, colour:'#C45736', visible});
  const name = 'FittedPortraitLayers';
  const { templateIndex } = await stage('scene_add_client_template', {
    template: group(name, [0,0], [layer('Layer17', [8,4], 100003), layer('Layer18', [-8,-4], 106025, false)]),
  });
  const script = 'asset_test';
  const source = `
local left, right
function OnStart()
    script.object:GetChild("Toggle"):AddCursorEventListener(Enum.CursorEventType.CursorClick, function()
        if left then
            game.DestroyClientUIControl(left)
            game.DestroyClientUIControl(right)
            left, right = nil, nil
        else
            left = assert(game.InstantiateClientUIControl(${templateIndex}, script.object:GetChild("Left")))
            right = assert(game.InstantiateClientUIControl(${templateIndex}, script.object:GetChild("Right")))
        end
    end)
end
`;
  await stage('scene_set_client_script', { name:script, source });
  await stage('scene_add_client_ui', {
    name:'NativeTemplateFixture', script, showCursor:true,
    controls:[group('Left', [-100,0]), group('Right', [100,0]),
      {name:'Toggle', kind:'cursorArea', position:[0,-125], size:[180,72]}],
  });
  const { save, receipt, templateReadbacks } = await nativeSimulatorSave(mcp, mapPath, 'NativeTemplateFixture');
  assert.equal(sha256(fs.readFileSync(input)), fixtureHash);
  assert.equal(receipt.mapSha256, sha256(fs.readFileSync(mapPath)));
  assert.equal(receipt.controls, 4);
  assert.equal(receipt.templateControls, 3);
  assert.deepEqual(receipt.templates, [{name, templateIndex, controls:3}]);
  assert.equal(save.assets.scripts[0].source, source);
  const { children } = save.assets.client.root;
  assert.deepEqual(children.map(node => node.guid), [templateIndex]);
  const { ids } = templateReadbacks[0];
  assert.deepEqual(children[0].children.map(node => node.guid), [ids[name+'/Layer18'], ids[name+'/Layer17']]);

  const session = api.startPlay(save.assets.server, {
    scripts:save.assets.scripts, templatesProject:save.assets.client, canvasId:'mobile-19.5-9', playerCount:2,
  });
  try {
    assert.equal(session.mountError, null);
    for (const seat of [1,2]) {
      api.setPlayView(session, seat);
      const [root] = session.runtime.roots;
      const left = root.children.find(node => node.name === 'Left');
      const right = root.children.find(node => node.name === 'Right');
      const toggle = root.children.find(node => node.name === 'Toggle');
      assert.equal(left.children.length + right.children.length, 0, 'Templates must start unmounted');
      const { centerX, centerY } = api.runtimeLayout(session).get(toggle.Id);
      const click = () => {
        assert.equal(api.hitPlayControl(session, centerX, centerY)?.Id, toggle.Id);
        api.injectPlayPointer(session, 'down', centerX, centerY);
        api.injectPlayPointer(session, 'up', centerX, centerY);
        api.stepPlay(session, 1/60);
      };
      click();
      const instances = [left.children[0], right.children[0]];
      assert.notEqual(instances[0]?.Id, instances[1]?.Id);
      const painted = api.playSnapshot(session, { paint:true });
      for (const instance of instances) {
        assert.equal(instance.prefabIndex, templateIndex);
        const triangle = instance.children.find(node => node.name === 'Layer17');
        const ellipse = instance.children.find(node => node.name === 'Layer18');
        assert.equal(triangle.imageId, 100003);
        assert.equal(triangle.anchoredPositionX, 8);
        assert.ok(painted.paint.some(item => item.id === triangle.Id));
        assert.ok(!painted.paint.some(item => item.id === ellipse.Id));
      }
      click();
      assert.equal(left.children.length + right.children.length, 0);
      assert.ok(instances.every(node => !node.alive));
      assert.deepEqual(api.playSnapshot(session).logs.filter(log => log.level === 'error'), []);
    }
  } finally {
    api.stopPlay(session);
  }
  console.log(JSON.stringify({ status:'pass', templateIndex, templateControls:receipt.templateControls, clientViews:2 }));
} finally {
  fs.rmSync(workspace, { recursive:true, force:true });
}
