import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
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
const parse=createRequire(path.join(mcp,'package.json'))('luaparse').parse;
const roundsSource=fs.readFileSync(new URL('../tests/native/release-practice-rounds.lua',import.meta.url),'utf8');
const literal=n=>{if(n.type==='TableConstructorExpression')return n.fields.map(f=>literal(f.value));if(n.type==='NumericLiteral')return n.value;if(n.type==='StringLiteral')return n.raw.slice(1,-1);throw Error('Nonliteral action fixture');};
const practiceRounds=literal(parse(roundsSource,{luaVersion:'5.3'}).body[0].arguments[0]);
receipt.practiceInputFixtureSha256=sha256(roundsSource);
const results=[];
const canvases=['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3'];
const configurations=canvases.map(canvasId=>({canvasId,playerCount:1}));
if((process.env.SIMULATOR_UI??'AutoPetsGame')==='AutoPetsGame')configurations.push({canvasId:'mobile-16-9',playerCount:2},{canvasId:'mobile-16-9',playerCount:8});
for(const {canvasId,playerCount} of configurations) {
  const prefix=canvasId+(playerCount>1?'-'+playerCount+'clients':'');
  const session=api.startPlay(save.assets.server,{scripts:save.assets.scripts,canvasId,playerCount,language:'zh-CN'});
  const inputs=[];
  const click=trail=>{let c=session.runtime.roots[0];for(const name of trail.split('/')) c=c?.children.find(n=>n.name===name);assert.ok(c,'Missing input '+trail);const box=api.runtimeLayout(session).get(c.Id);const hit=api.hitPlayControl(session,box.centerX,box.centerY);assert.equal(hit?.Id,c.Id,'Input is occluded '+trail);api.injectPlayPointer(session,'down',box.centerX,box.centerY);api.injectPlayPointer(session,'up',box.centerX,box.centerY);api.stepPlay(session,1/60);inputs.push({trail,x:box.centerX,y:box.centerY});};
  const frames=[],runtimeExceptions=[];
  const capture=async name=>{const paths=new Map();const visit=(node,trail)=>{paths.set(node.Id,trail);for(const child of node.children)visit(child,trail?trail+'/'+child.name:child.name);};visit(session.runtime.roots[0],'');const s=api.playSnapshot(session,{inspect:true,paint:true});fs.writeFileSync(path.join(output,prefix+'-'+name+'.json'),JSON.stringify(s));const prepared=await imageAssets.prepare(s.paint);const png=renderPaintPng(s.paint,s.canvasWidth,s.canvasHeight,prepared).data;fs.writeFileSync(path.join(output,prefix+'-'+name+'.png'),png);frames.push({name,assetWarnings:prepared.warnings,sha256:sha256(png),mountError:s.mountError,logs:s.logs.filter(l=>/error/.test(l.level)),visibleTexts:s.paint.filter(p=>p.kind==='textbox').map(p=>({path:paths.get(p.id),name:p.name,text:p.text,textLayout:p.textLayout,left:p.left,bottom:p.bottom,width:p.width,height:p.height}))});return s;};
  try {
  await capture('startup');
  // Deliberate server fixture: upstream simulator does not execute the GIL graphs.
  if((process.env.SIMULATOR_UI??'AutoPetsGame')==='AutoPetsGame'&&playerCount===1) {
    api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,0,0]);await capture('lobby-fixture');
    click('Lobby/Choices/Duel/Hit');api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,2,1]);await capture('duel-wait-fixture');
    click('Lobby/Choices/Room/Hit');api.sendPlaySignal(session,'AP_GameLobby',[0,1,1,8,3]);await capture('room-wait-fixture');
    api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,0,0]);
    click('Lobby/Choices/Practice/Hit');await capture('practice-menu');
    click('Practice/Menu/Continue/Hit');await capture('practice-shop');
    const press=name=>click('Practice/'+name+'/Hit');
    for(const [roundIndex,round] of practiceRounds.entries()) {
      for(const [action,from,to] of round.slice(1)) {
        if(action==='buy'||action==='combine'){press('Shop/Pet'+from);press(to?'Team'+to:'Shop/Buy');}
        else if(action==='feed'){press('Shop/Food'+from);press('Team'+to);}
        else if(action==='move'||action==='sell'){press('Team'+from);press(to?'Team'+to:'Shop/Sell');}
        else if(action==='reward'){press('Shop/Reward');press('Shop/Buy');}
        else if(action==='reroll')press('Shop/Reroll');else throw Error('Unknown input fixture '+action);
      }
      if(roundIndex===10)await capture('practice-tier-six');
      press('Primary');
      if(roundIndex===0){await capture('practice-battle');for(let frame=0;frame<120;frame++)api.stepPlay(session,1/60);await capture('practice-replay');}
      press('Primary');press('Primary');if(roundIndex<practiceRounds.length-1)press('Primary');
    }
    const final=await capture('practice-complete');
    assert.ok(final.logs.some(l=>/phase=ended/.test(l.text)),'Practice did not reach terminal state');
    press('Primary');await capture('practice-restart');
  }
  if(playerCount>1) {
    // Client-only fixture from the native wire schema. No graph output claimed.
    const mode=playerCount===2?2:8;
    const market=Array(41).fill(0);market.splice(0,23,1,1,10,0,0,2,1,2,3,1,-2,1,21,3,2,1,1,2,22,3,2,1,1);
    api.sendPlaySignal(session,'AP_GameLobby',[0,playerCount,0,0,0],'AllPlayers');
    click('Lobby/Choices/'+(mode===2?'Duel':'Room')+'/Hit');
    api.sendPlaySignal(session,'AP_GameLobby',[mode,playerCount,0,mode,0],'AllPlayers');
    for(let player=1;player<=playerCount;player++) {
      const target='Player'+player;const personalMarket=[...market];personalMarket[2]=11-player;
      if(mode===2){api.sendPlaySignal(session,'AP_DuelSnapshot',[2,player,1,0,false,false,0,1,1,0,0,30,0,5,5,0],target);api.sendPlaySignal(session,'AP_DuelMarket',[1,1,personalMarket],target);}
      else api.sendPlaySignal(session,'AP_RoomView',[1,2,1,player,1,playerCount,0,false,Array(8).fill(5),Array(8).fill(0),[2,1,4,3,6,5,8,7],Array(8).fill(0),personalMarket,0,42],target);
      api.setPlayView(session,player);await capture('client-'+player+'-preparation-fixture');
    }
    api.setPlayView(session,1);
    click(mode===2?'Duel/MarketOffers/Buy1':'Room/Match/Shop/Offer1/Hit');
    await capture('client-1-buy-request');
    assert.ok(api.playSnapshot(session).server.inbound.some(row=>row.name===(mode===2?'AP_DuelRequest':'AP_RoomRequest')&&row.values[0]===11),'Client buy did not send native request');
  }
  for(const [index,trail] of JSON.parse(process.env.SIMULATOR_CLICKS??'[]').entries()){click(trail);await capture('click-'+index);}
  } catch(error){runtimeExceptions.push({message:error.message,stack:error.stack});await capture('runtime-exception');}
  results.push({canvasId,playerCount,runtimeExceptions,inputs,frames,history:api.playSnapshot(session).history});api.stopPlay(session);
}
const buildPath=path.join(path.dirname(gil),'BUILD.json');
const build=fs.existsSync(buildPath)?JSON.parse(fs.readFileSync(buildPath)):{};
if(build.sha256)assert.equal(build.sha256,receipt.mapSha256,'BUILD.json GIL digest mismatch');
const textDefects=results.flatMap(r=>r.frames.flatMap(f=>f.visibleTexts.filter(t=>t.text.trim()&&(!t.textLayout||t.textLayout.visibleLineCount===0)).map(t=>({canvasId:r.canvasId,frame:f.name,path:t.path,name:t.name,text:t.text,height:t.height,requiredHeight:t.textLayout?.requiredHeight}))));
const report={schemaVersion:1,sourceRevision:build.sourceRevision??null,designVersion:build.designVersion??null,textDefects,scope:'Actual upstream Lua VM and software renderer, native GIL UI/scripts; server fixture explicitly identified',status:results.some(r=>r.runtimeExceptions.length||r.frames.some(f=>f.mountError||f.logs.length))?'runtime-failed':textDefects.length?'observed-text-defects':'executed',mcpCommit:revision(mcp),simulatorCommit:revision(sim),officialClient:'not-executed',...receipt,results};
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,output,controls:receipt.controls,results:results.map(r=>({canvasId:r.canvasId,playerCount:r.playerCount,runtimeExceptions:r.runtimeExceptions,frames:r.frames.map(f=>({name:f.name,mountError:f.mountError,errors:f.logs}))}))},null,2));

if(report.status==='runtime-failed'||(process.env.SIMULATOR_REQUIRE_TEXT==='1'&&textDefects.length))process.exitCode=1;
