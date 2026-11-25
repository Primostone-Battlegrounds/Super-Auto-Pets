import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { textDiagnostic, textSamples } from '../../platform/text-diagnostic.mjs';
const [checkout, output, lua] = process.argv.slice(2);
assert(checkout && output && lua, 'Usage: node tests/native/verify-text.mjs <MCP checkout> <new output> <Lua 5.3>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
assert(!fs.existsSync(output), 'Use new output directory');
fs.mkdirSync(output, { recursive: true });
const workspace = fs.realpathSync(output);
const require = createRequire(path.join(checkout, 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const source = fs.readFileSync(new URL('../../platform/text-diagnostic.lua', import.meta.url), 'utf8');
const client = new Client({ name: 'sap-text-diagnostic', version: '2.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(checkout, 'src/server.mjs')], cwd: checkout,
  env: { MILIASTRA_ALLOW_LIVE_WRITE: '0', MILIASTRA_SAVE_ROOTS: '[]', MILIASTRA_WORKSPACE: workspace, LOCALAPPDATA: path.join(workspace, 'host') }, stderr: 'inherit' }));
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert(!result.isError, JSON.stringify(result));
  return result.structuredContent ?? JSON.parse(result.content[0].text);
}
let report;
try {
  const input = path.join(workspace, 'input.gil');
  fs.copyFileSync(path.join(checkout, 'tests/fixtures/editor-2026-10-26-shapes.gil'), input);
  const scripted = await call('scene_set_client_script', { mapPath: input, name: textDiagnostic.script, source, outputName: 'text-script' });
  const built = await call('scene_add_client_ui', { mapPath: scripted.mapPath, ...textDiagnostic, script: { name: textDiagnostic.script }, outputName: 'text-diagnostic' });
  const ui = await call('scene_get_client_ui', { mapPath: built.mapPath, ui: textDiagnostic.name });
  const scripts = await call('scene_list_client_scripts', { mapPath: built.mapPath });
  const readback = scripts.scripts.find(item => item.name === textDiagnostic.script);
  assert(readback, 'diagnostic script missing');
  fs.writeFileSync(path.join(workspace, 'ui-readback.json'), JSON.stringify(ui, null, 2));
  fs.writeFileSync(path.join(workspace, 'script-readback.json'), JSON.stringify(readback, null, 2));
  const decoded = JSON.stringify(ui);
  for (const sample of Object.values(textSamples)) assert(decoded.includes(sample), 'static text lost in native readback');
  // Exercise lifecycle and the actual production binding contract independently of rendering.
  const testPath = path.join(workspace, 'binding.lua');
  fs.writeFileSync(testPath, `local nodes = {}\nlocal callback\nfor _, path in ipairs({'Dynamic0','Dynamic1','Cycle/Hit'}) do\n nodes[path] = {alive=true, SetActive=function()end, SetVisible=function()end, AddCursorEventListener=function(_,_,fn)callback=fn end, RemoveCursorEventListener=function(_,_,fn)assert(callback==fn);callback=nil end}\nend\nscript={object={FindChild=function(_,path)return nodes[path] end}}\nEnum={CursorEventType={CursorClick=1}}\nassert(loadfile(arg[1]))()\nOnStart()\nassert(nodes.Dynamic0.text=='Shop 123 / Gold 10')\nassert(nodes.Dynamic1.text=='单人练习 · 金币 10')\ncallback()\nassert(nodes.Dynamic0.text=='Shop 123 / Gold 11')\nassert(nodes.Dynamic1.text=='单人练习 · 金币 11')\nOnEnable()\nOnDestroy()\nassert(callback==nil)\nprint('TEXT_BINDING_LIFECYCLE passed')\n`);
  const sourcePath = path.join(workspace, 'text-diagnostic.lua');
  fs.writeFileSync(sourcePath, source);
  const bindingLog = execFileSync(lua, ['-E', testPath, sourcePath], { encoding: 'utf8' });
  fs.writeFileSync(path.join(workspace, 'binding.log'), bindingLog);
  report = { mapPath: built.mapPath, interface: textDiagnostic.name, binding: 'passed Lua property readback, update, enable, destroy',
    staticReadback: 'passed Latin and CJK', renderer: 'pending actual simulator run', officialPc: 'pending', officialMobile: 'pending', permission: 'unchanged; official account permission not inferred' };
} finally { await client.close(); }
fs.writeFileSync(path.join(workspace, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
