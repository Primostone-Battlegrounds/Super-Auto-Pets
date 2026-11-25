// Measures current native layout with actual upstream text renderer and observed
// multiplayer strings. It does not claim to execute server node graphs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {duelLayout} from '../../platform/m2-duel-native.mjs';
import {m3RoomLayout} from '../../platform/m3-room-ui.mjs';
const [simulator, baseline, output] = process.argv.slice(2);
assert(output, 'Usage: node tests/native/multiplayer-text.mjs <simulator> <baseline receipt.json> <output.json>');
const {textLayout} = await import(pathToFileURL(path.join(simulator, 'studio/play/text-layout.js')));
const controls = new Map();
const visit = (nodes, prefix, bounds) => {
  for (const node of nodes) {
    const key = prefix + node.name;
    controls.set(key, node);
    for (const axis of [0,1]) assert(Math.abs(node.position?.[axis] ?? 0) + node.size[axis]/2 <= bounds[axis]/2,
      key + ' outside native parent');
    if (node.children) visit(node.children, key+'/', node.size);
  }
};
visit(duelLayout({PET_SLOTS:3, FOOD_SLOTS:2, TEAM_SIZE:5}).controls, 'Duel/', [1280,720]);
visit(m3RoomLayout.controls, 'Room/', [1280,720]);
const receipt = JSON.parse(fs.readFileSync(baseline));
const results = [];
const measure = (key, text) => {
  const node = controls.get(key);
  assert(node?.text, 'missing text node '+key);
  const measured = textLayout({kind:'textbox', text, fontSize:node.text.fontSize,
    minimumFontSize:node.text.minFontSize, adaptiveFontSize:node.text.autoSize}, ...node.size);
  assert(measured.fits && measured.visibleLineCount > 0, key+' '+JSON.stringify(measured));
  results.push({path:key,text,size:node.size,fontSize:measured.fontSize,requiredHeight:measured.requiredHeight,lines:measured.visibleLineCount});
};
for (const scenario of receipt.results.filter(row=>row.playerCount>1)) for (const frame of scenario.frames) {
  for (const row of frame.visibleTexts) if (controls.has(row.path) && row.text.trim()) measure(row.path,row.text);
}
for (const [key,text] of [
  ['Duel/Status', '席位 2 · 第 99 轮 · 生命 5 / 对手 5\n双方已准备 · 余 30 秒'],
  ['Duel/ReplayStatus', '本轮获胜 · 对手席位 2\n回放 123 / 456'],
  ['Duel/ReadyLabel', '已准备\n等待对手'],
  ['Room/Match/Ready/Text', '已准备\n等待其他席位'],
  ['Room/Match/Replay/RoundText', '本轮获胜 · 对手席位 8\n回放 123 / 456'],
]) measure(key,text);
const standings = controls.get('Room/Standings');
for(let seat=1;seat<=8;seat++) {
  const title=controls.get('Room/Standings/Seat'+seat), detail=controls.get('Room/Standings/Seat'+seat+'Detail');
  assert(title.position[1]-title.size[1]/2 >= detail.position[1]+detail.size[1]/2, 'seat rows overlap');
}
fs.writeFileSync(output,JSON.stringify({scope:'Actual upstream textLayout measurements, observed native baseline text and targeted two-line cases',officialClient:'pending',measuredLabels:results.length,standingsSize:standings.size,status:'passed',results},null,2));
console.log(`Multiplayer native text: ${results.length} observed/synthetic labels fit; native bounds and standings row separation pass`);
