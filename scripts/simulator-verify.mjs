import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {nativeSimulatorSave,sha256} from './simulator-native.mjs';
const [mcp,sim,gil,output]=process.argv.slice(2);
assert.ok(output,'Usage: node scripts/simulator-verify.mjs <MCP root> <simulator root> <GIL> <new evidence dir>');
assert.ok(!fs.existsSync(output),'New evidence directory required');fs.mkdirSync(output,{recursive:true});
const revision=directory=>execFileSync('git',['-C',directory,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const lock=JSON.parse(fs.readFileSync(new URL('../platform/toolchain-lock.json',import.meta.url)));
assert.equal(revision(mcp),lock.mcp.commit,'MCP revision differs from toolchain lock');
assert.equal(revision(sim),lock.simulator.commit,'Simulator revision differs from toolchain lock');
const {save,receipt}=await nativeSimulatorSave(mcp,gil,process.env.SIMULATOR_UI??'AutoPetsGame');
fs.writeFileSync(path.join(output,'native.save.json'),JSON.stringify(save));
const api=await import(pathToFileURL(path.join(sim,'studio/play/session.js')));
const {renderPaintPng}=await import(pathToFileURL(path.join(sim,'studio/host-png.js')));
const {ImageAssetStore}=await import(pathToFileURL(path.join(sim,'studio/host/image-assets.js')));
const imageAssets=new ImageAssetStore({cacheDir:path.join(output,'image-cache')});
const {LuaRuntime}=await import(pathToFileURL(path.join(sim,'client/lua-runtime/src/index.js')));
// The upstream authoring compiler omits native instance parameter tables. Pass
// actual GIL values at mount time, before unchanged Lua OnStart executes.
const originalMount=LuaRuntime.prototype.mountScript;
LuaRuntime.prototype.mountScript=function(options){const name=path.basename(options.path,'.lua');return originalMount.call(this,{...options,params:receipt.scriptParameters[name]??{}});};
receipt.parameterAdapter='native-GIL-params-before-mount-v1';
const results=[];
for(const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']) {
  const session=api.startPlay(save.assets.server,{scripts:save.assets.scripts,canvasId,language:'zh-CN'});
  const inputs=[];
  const click=trail=>{let c=session.runtime.roots[0];for(const name of trail.split('/')) c=c?.children.find(n=>n.name===name);assert.ok(c,'Missing input '+trail);const box=api.runtimeLayout(session).get(c.Id);const hit=api.hitPlayControl(session,box.centerX,box.centerY);assert.equal(hit?.Id,c.Id,'Input is occluded '+trail);api.injectPlayPointer(session,'down',box.centerX,box.centerY);api.injectPlayPointer(session,'up',box.centerX,box.centerY);api.stepPlay(session,1/60);inputs.push({trail,x:box.centerX,y:box.centerY});};
  const frames=[];
  const capture=async name=>{const s=api.playSnapshot(session,{inspect:true,paint:true});fs.writeFileSync(path.join(output,canvasId+'-'+name+'.json'),JSON.stringify(s));const prepared=await imageAssets.prepare(s.paint);const png=renderPaintPng(s.paint,s.canvasWidth,s.canvasHeight,prepared).data;fs.writeFileSync(path.join(output,canvasId+'-'+name+'.png'),png);frames.push({name,assetWarnings:prepared.warnings,sha256:sha256(png),mountError:s.mountError,logs:s.logs.filter(l=>/error/.test(l.level)),visibleTexts:s.paint.filter(p=>p.kind==='textbox').map(p=>({name:p.name,text:p.text,textLayout:p.textLayout,left:p.left,bottom:p.bottom,width:p.width,height:p.height}))});return s;};
  await capture('startup');
  // Deliberate server fixture: upstream simulator does not execute the GIL graphs.
  if((process.env.SIMULATOR_UI??'AutoPetsGame')==='AutoPetsGame') {
    api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,0,0]);await capture('lobby-fixture');
    click('Lobby/Choices/Practice/Hit');await capture('practice-menu');
    click('Practice/Menu/Continue/Hit');await capture('practice-shop');
    click('Practice/Shop/Pet1/Hit');click('Practice/Shop/Buy/Hit');
    click('Practice/Primary/Hit');await capture('practice-battle');
    for(let frame=0;frame<120;frame++)api.stepPlay(session,1/60);await capture('practice-replay');
  }
  for(const [index,trail] of JSON.parse(process.env.SIMULATOR_CLICKS??'[]').entries()){click(trail);await capture('click-'+index);}
  results.push({canvasId,inputs,frames,history:api.playSnapshot(session).history});api.stopPlay(session);
}
const buildPath=path.join(path.dirname(gil),'BUILD.json');
const build=fs.existsSync(buildPath)?JSON.parse(fs.readFileSync(buildPath)):{};
if(build.sha256)assert.equal(build.sha256,receipt.mapSha256,'BUILD.json GIL digest mismatch');
const textDefects=results.flatMap(r=>r.frames.flatMap(f=>f.visibleTexts.filter(t=>t.text.trim()&&(!t.textLayout||t.textLayout.visibleLineCount===0)).map(t=>({canvasId:r.canvasId,frame:f.name,name:t.name,text:t.text,height:t.height,requiredHeight:t.textLayout?.requiredHeight}))));
const report={schemaVersion:1,sourceRevision:build.sourceRevision??null,designVersion:build.designVersion??null,textDefects,scope:'Actual upstream Lua VM and software renderer, native GIL UI/scripts; server fixture explicitly identified',status:results.some(r=>r.frames.some(f=>f.mountError||f.logs.length))?'runtime-failed':textDefects.length?'observed-text-defects':'executed',mcpCommit:revision(mcp),simulatorCommit:revision(sim),officialClient:'not-executed',...receipt,results};
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,output,controls:receipt.controls,results:results.map(r=>({canvasId:r.canvasId,frames:r.frames.map(f=>({name:f.name,mountError:f.mountError,errors:f.logs}))}))},null,2));

if(report.status==='runtime-failed'||(process.env.SIMULATOR_REQUIRE_TEXT==='1'&&textDefects.length))process.exitCode=1;
