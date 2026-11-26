// Native GIL readback -> upstream simulator authoring model. No Lua is patched.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function nativeSimulatorSave(mcpRoot, mapPath, uiName = 'AutoPetsGame') {
  const native = await import(pathToFileURL(path.join(mcpRoot, 'src/scene-save.mjs')));
  const readback = native.getClientUi({mapPath, ui:uiName});
  const scripts = native.listClientScripts({mapPath, includeSource:true}).scripts;
  const kinds={container:'container',image:'image',text:'textbox',cursorArea:'cursor',presetButton:'button'};
  const align={left:'Left',centre:'Middle',right:'Right',top:'Top',middle:'Middle',bottom:'Bottom'};
  const platforms=['KEYBOARD','TOUCHSCREEN','CONTROLLER_CONSOLE','CONTROLLER_MOBILE'];
  const devices=['', 'mobile', 'console', 'mobileGamepad'];
  const vector=(v,d)=>({x:v?.[0]??d[0],y:v?.[1]??d[1]});
  const argb=(colour='#FFFFFF',opacity=1)=>((Math.round(opacity*255)<<24)|(parseInt(colour.replace('#',''),16)&0xffffff))>>>0;
  const transform=s=>({scale:{...vector(s.scale,[1,1]),z:1},rotation:{x:Array.isArray(s.rotation)?s.rotation[0]:0,y:Array.isArray(s.rotation)?s.rotation[1]:0,z:Array.isArray(s.rotation)?s.rotation[2]:s.rotation??0},anchorMin:vector(s.anchor?.min,[.5,.5]),anchorMax:vector(s.anchor?.max,[.5,.5]),offset:vector(s.position,[0,0]),size:vector(s.size,[0,0]),pivot:vector(s.pivot,[.5,.5])});
  const countControls = node => 1 + node.children.reduce((count, child) => count + countControls(child), 0);
  function convert(s,trail,ids,isTemplate=false) {
    if(!kinds[s.kind]) throw Error('Unsupported native kind '+s.kind);
    if(isTemplate && s.scripts?.length) throw Error('Unsupported script on native template control '+trail);
    const guid=ids[trail];
    if(!Number.isSafeInteger(guid) || guid<=0) throw Error('Missing native ID '+trail);
    const n={id:'n'+guid,guid,name:s.name,kind:kinds[s.kind],active:s.active!==false,visible:s.visible!==false,canControllerFocus:s.focusable===true,transformByPlatform:Object.fromEntries(platforms.map((p,i)=>[p,transform({...s,...s.devices?.[devices[i]]})])),children:(s.children??[]).map(c=>convert(c,trail==='/'?c.name:trail+'/'+c.name,ids,isTemplate)).reverse(),scriptMappingIds:[]};
    if(n.kind==='container')Object.assign(n,{showCursor:!!s.showCursor,disableKeyEventPassthrough:!!s.blockKeys,disableCursorEventPassthrough:!!s.blockCursor,isolateNavigation:!!s.isolateNavigation});
    if(n.kind==='image')Object.assign(n,{imageSource:'StaticReference',imageType:s.imageType==='stretch'?'Stretch':'Basic',imageId:s.image,imageColor:argb(s.colour,s.opacity),enableMask:!!s.mask});
    if(n.kind==='textbox'){const t=s.text??{};Object.assign(n,{text:t.content??'',fontSize:t.fontSize??20,fontColor:argb(t.colour,t.opacity),bgColor:argb(t.background??'#000000',t.backgroundOpacity??0),adaptiveFontSize:!!t.autoSize,minimumFontSize:t.minFontSize??20,horizontalAlignment:align[t.align]??'Left',verticalAlignment:align[t.valign]??'Top',enableOutline:t.outline!==false,outlineColor:argb(t.outlineColour??'#333333',t.outlineOpacity??.2)});}
    if(n.kind==='button'||n.kind==='cursor')Object.assign(n,{raycastTarget:true,interactable:s.enabled!==false});
    if(n.kind==='button'&&s.states){for(const [key,field] of Object.entries({normal:'defaultChildId',hover:'hoverChildId',pressed:'pressedChildId',disabled:'unavailableChildId'})){const child=n.children.find(c=>c.name===s.states[key]);if(child)n[field]=child.id;}}
    return n;
  }
  const root=convert({...readback.interface,kind:'container',name:uiName,children:readback.interface.controls,size:[0,0],anchor:{min:[0,0],max:[1,1]}},'/',readback.ids);
  const templateReadbacks=native.listInterface({mapPath}).clientTemplates.map(({name,templateIndex})=>{
    const entry=native.getClientUi({mapPath,template:name});
    if(entry.templateIndex!==templateIndex || entry.ids[name]!==templateIndex) throw Error('Native template index changed '+name);
    return entry;
  });
  const templates=templateReadbacks.map(({template,ids})=>convert(template,template.name,ids,true));
  const mounted=scripts.map((s,i)=>({id:'script'+i,guid:s.scriptId,path:s.file??s.name+'.lua',source:s.source,controlAsset:'server',controlId:root.id}));
  root.scriptMappingIds=mounted.map(s=>s.guid);
  const scriptParameters=Object.fromEntries((readback.interface.scripts??[]).map(s=>[s.name,s.values??{}]));
  const save={format:'qxqy-simulator-save',version:4,assets:{
    server:{layoutSchemaVersion:2,canvasId:'mobile-16-9',root:{...root,id:'holder'+readback.containerId,guid:readback.containerId,kind:'server-container',scriptMappingIds:[],children:[root]}},
    client:{layoutSchemaVersion:2,canvasId:'mobile-16-9',meta:{assetType:'client-control-template'},
      root:{...root,id:'templates',guid:0,name:'Templates',kind:'server-container',children:templates,scriptMappingIds:[]}},
    scripts:mounted,
  }};
  const templateInventory=templates.map(node=>({name:node.name,templateIndex:node.guid,controls:countControls(node)}));
  const receipt={
    mapSha256:sha256(fs.readFileSync(mapPath)),controls:countControls(root),templates:templateInventory,
    templateControls:templateInventory.reduce((count, entry)=>count+entry.controls,0),
    scripts:scripts.map(s=>({name:s.name,sha256:sha256(s.source)})),luaSourceExact:true,scriptParameters,
    serverGraphsExecuted:false,limitations:['Native node graphs are not executed by the simulator. Server responses must be explicitly identified as test fixtures.','Software raster screenshots do not verify official-client fonts, GPU performance, text permissions, multiplayer or audio.'],
  };
  return {save,receipt,readback,templateReadbacks};
}
