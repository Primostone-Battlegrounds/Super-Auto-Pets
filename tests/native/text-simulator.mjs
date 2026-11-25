// Runs the actual upstream simulator VM + renderer; not the mocked native harness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [mcp, simulator, adapter, gil, output] = process.argv.slice(2);
assert(output, 'Usage: node tests/native/text-simulator.mjs <MCP> <simulator> <native adapter.mjs> <diagnostic GIL> <new output>');
assert(!fs.existsSync(output));
fs.mkdirSync(output, {recursive: true});
const {nativeSimulatorSave} = await import(pathToFileURL(adapter));
const {save, receipt} = await nativeSimulatorSave(mcp, gil, 'AutoPetsTextDiagnostic');
const api = await import(pathToFileURL(path.join(simulator, 'studio/play/session.js')));
const {renderPaintPng} = await import(pathToFileURL(path.join(simulator, 'studio/host-png.js')));
const results = [];
for (const canvasId of ['pc-16-9', 'mobile-16-9']) {
  const session = api.startPlay(save.assets.server, {scripts: save.assets.scripts, canvasId, language: 'zh-CN'});
  const capture = name => {
    const snapshot = api.playSnapshot(session, {inspect: true, paint: true});
    assert(!snapshot.mountError, snapshot.mountError);
    assert(!snapshot.logs.some(log => /error/.test(log.level)), JSON.stringify(snapshot.logs));
    fs.writeFileSync(path.join(output, `${canvasId}-${name}.json`), JSON.stringify(snapshot));
    fs.writeFileSync(path.join(output, `${canvasId}-${name}.png`), renderPaintPng(snapshot.paint, snapshot.canvasWidth, snapshot.canvasHeight).data);
    const texts = snapshot.paint.filter(p => p.kind === 'textbox');
    for (const expected of ['Shop 123 / Gold 10', '单人练习 · 金币 10']) {
      const matches = texts.filter(text => text.text === expected);
      assert(matches.length >= (name === 'startup' ? 2 : 1), `${name}: missing static/dynamic ${expected}`);
      for (const text of matches) assert(text.textLayout?.visibleLineCount > 0, JSON.stringify(text));
    }
    const original = texts.find(text => text.name === 'OriginalGeometry');
    const fitted = texts.find(text => text.name === 'FittedGeometry');
    assert(original && fitted);
    assert.equal(original.textLayout.visibleLineCount, 0, 'expected measured clipping reproduction');
    assert(fitted.textLayout.visibleLineCount > 0, 'auto-size did not repair title box');
    if (name === 'updated') for (const expected of ['Shop 123 / Gold 11', '单人练习 · 金币 11']) {
      const text = texts.find(text => text.text === expected);
      assert(text && text.textLayout?.visibleLineCount > 0, `missing rendered update ${expected}`);
    }
    return texts.map(({name, text, textLayout}) => ({name, text, textLayout}));
  };
  const startup = capture('startup');
  let target = session.runtime.roots[0];
  for (const name of ['Cycle', 'Hit']) target = target.children.find(child => child.name === name);
  assert(target);
  const box = api.runtimeLayout(session).get(target.Id);
  assert.equal(api.hitPlayControl(session, box.centerX, box.centerY)?.Id, target.Id);
  api.injectPlayPointer(session, 'down', box.centerX, box.centerY);
  api.injectPlayPointer(session, 'up', box.centerX, box.centerY);
  api.stepPlay(session, 1/60);
  const updated = capture('updated');
  results.push({canvasId, input: {x: box.centerX, y: box.centerY}, startup, updated});
  api.stopPlay(session);
}
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify({scope: 'Actual upstream simulator; isolated native text matrix', receipt, results, officialClient: 'pending', fontPermissions: 'unchanged'}, null, 2));
console.log('Native text matrix: static/dynamic Latin/CJK painted and coordinate click updated both on PC/mobile simulator');
