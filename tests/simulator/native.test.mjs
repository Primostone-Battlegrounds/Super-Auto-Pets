import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {nativeSimulatorSave,sha256} from '../../scripts/simulator-native.mjs';
const [mcp,gil,ui='AutoPetsGame']=process.argv.slice(2);
assert.ok(mcp&&gil,'Usage: node tests/simulator/native.test.mjs <MCP> <GIL> [interface]');
const {save,receipt,readback,templateReadbacks}=await nativeSimulatorSave(mcp,gil,ui);
const {readSimulatorSave}=await import(pathToFileURL(path.join(mcp,'src/simulator-import.mjs')));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sap-native-simulator-'));
try {
  const file=path.join(temporary,'native.save.json');fs.writeFileSync(file,JSON.stringify(save));
  const inverse=readSimulatorSave(file);
  const flatten=(nodes,prefix='')=>nodes.flatMap(n=>{const trail=prefix?prefix+'/'+n.name:n.name;return [{trail,name:n.name,kind:n.kind,position:n.position,size:n.size,active:n.active!==false,visible:n.visible!==false,text:n.text?.content??'',fontSize:n.text?.fontSize??null},...flatten(n.children??[],trail)];});
  assert.deepEqual(flatten(inverse.ui.controls).sort((a,b)=>a.trail.localeCompare(b.trail)),flatten(readback.interface.controls).sort((a,b)=>a.trail.localeCompare(b.trail)),'Native geometry, text and visibility round trip');
  assert.deepEqual(save.assets.server.root.children[0].children.map(n=>n.name),readback.interface.controls.map(n=>n.name).reverse(),'Simulator editor child list is inverse native drawing order');
  for(const s of save.assets.scripts){assert.ok(s.guid>0);assert.equal(sha256(s.source),receipt.scripts.find(r=>r.name===path.basename(s.path,'.lua')).sha256);}
  assert.equal(receipt.serverGraphsExecuted,false);
  const layoutIds=flatten(readback.interface.controls).map(n=>readback.ids[n.trail]);
  assert.equal(new Set(layoutIds).size,receipt.controls-1);
  const templateControls=node=>flatten([node]).sort((a,b)=>a.trail.localeCompare(b.trail));
  assert.deepEqual(inverse.templates.map(entry=>({ index:entry.guid, controls:templateControls(entry.spec) })),
    templateReadbacks.map(({templateIndex,template})=>({ index:templateIndex, controls:templateControls(template) })),
    'Native template index, geometry and visibility round trip');
  const templateIds=templateReadbacks.flatMap(entry=>flatten([entry.template]).map(node=>entry.ids[node.trail]));
  assert.equal(templateIds.length,receipt.templateControls);
  assert.equal(new Set([...layoutIds,readback.rootId,...templateIds]).size,receipt.controls+receipt.templateControls);
  console.log(JSON.stringify({status:'pass',controls:receipt.controls,templates:receipt.templates,luaSourceExact:true,roundTrip:'native -> actual upstream simulator save reader -> native interface'}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
