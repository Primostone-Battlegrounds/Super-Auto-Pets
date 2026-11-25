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
for(const directory of [mcp,sim]){const changed=execFileSync('git',['-C',directory,'diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.ok(changed.every(file=>file==='npm-shrinkwrap.json'),'Tracked tool source changed: '+changed.join(','));}
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
if ((process.env.SIMULATOR_UI ?? 'AutoPetsGame') === 'AutoPetsGame') {
  configurations.push(
    { canvasId: 'pc-16-9', playerCount: 2, mode: 2 },
    { canvasId: 'pc-16-9', playerCount: 2, mode: 8 },
    { canvasId: 'mobile-16-9', playerCount: 1, mode: 8 },
    { canvasId: 'mobile-16-9', playerCount: 2, mode: 2 },
    { canvasId: 'mobile-16-9', playerCount: 8, mode: 8 },
    { canvasId: 'mobile-19.5-9', playerCount: 2, mode: 2 },
    { canvasId: 'mobile-19.5-9', playerCount: 8, mode: 8 },
  );
}
for(const {canvasId,playerCount,mode} of configurations) {
  const prefix = mode ? `${canvasId}-mode${mode}-${playerCount}clients` : canvasId;
  const session=api.startPlay(save.assets.server,{scripts:save.assets.scripts,canvasId,playerCount,language:'zh-CN'});
  const inputs=[],playButtons=[];
  const control = trail => {
    let node = session.runtime.roots[0];
    for (const name of trail.split('/')) node = node?.children.find(child => child.name === name);
    assert.ok(node, 'Missing control ' + trail);
    return node;
  };
  const click=trail=>{const c=control(trail);const box=api.runtimeLayout(session).get(c.Id);const hit=api.hitPlayControl(session,box.centerX,box.centerY);assert.equal(hit?.Id,c.Id,'Input is occluded '+trail);api.injectPlayPointer(session,'down',box.centerX,box.centerY);api.injectPlayPointer(session,'up',box.centerX,box.centerY);api.stepPlay(session,1/60);inputs.push({trail,x:box.centerX,y:box.centerY});};
  function requirePlayButton(trail, neighbors = []) {
    const { Id } = control(trail);
    const boxes = api.runtimeLayout(session);
    const { centerX, centerY, width, height } = boxes.get(Id);
    const { canvasWidth, canvasHeight } = api.playSnapshot(session);
    const scale = Math.min(844 / canvasWidth, 390 / canvasHeight);
    if (canvasId === 'mobile-19.5-9') {
      assert.ok(Math.min(width, height) * scale >= 44, `Touch target too small at 844×390: ${trail}`);
    }
    assert.ok(centerX - width / 2 >= 0 && centerX + width / 2 <= canvasWidth &&
      centerY - height / 2 >= 0 && centerY + height / 2 <= canvasHeight, `Offscreen play button: ${trail}`);
    for (const neighbor of neighbors) {
      const box = boxes.get(control(neighbor).Id);
      const separated = Math.abs(centerX - box.centerX) >= (width + box.width) / 2 ||
        Math.abs(centerY - box.centerY) >= (height + box.height) / 2;
      assert.ok(separated, `${trail} overlaps ${neighbor}`);
    }
    for (const [dx, dy] of [[0, 0], [2 - width / 2, 0], [width / 2 - 2, 0], [0, 2 - height / 2], [0, height / 2 - 2]]) {
      assert.equal(api.hitPlayControl(session, centerX + dx, centerY + dy)?.Id, Id, `Button edge is occluded: ${trail}`);
    }
    playButtons.push({ trail, width, height, projectedWidth: width * scale, projectedHeight: height * scale });
  }
  const frames=[],runtimeExceptions=[];
  const capture=async name=>{const paths=new Map();const visit=(node,trail)=>{paths.set(node.Id,trail);for(const child of node.children)visit(child,trail?trail+'/'+child.name:child.name);};visit(session.runtime.roots[0],'');const s=api.playSnapshot(session,{inspect:true,paint:true});fs.writeFileSync(path.join(output,prefix+'-'+name+'.json'),JSON.stringify(s));const prepared=await imageAssets.prepare(s.paint);const png=renderPaintPng(s.paint,s.canvasWidth,s.canvasHeight,prepared).data;fs.writeFileSync(path.join(output,prefix+'-'+name+'.png'),png);frames.push({name,assetWarnings:prepared.warnings,sha256:sha256(png),mountError:s.mountError,logs:s.logs.filter(l=>/error/.test(l.level)),visibleTexts:s.paint.filter(p=>p.kind==='textbox').map(p=>({path:paths.get(p.id),name:p.name,text:p.text,textLayout:p.textLayout,left:p.left,bottom:p.bottom,width:p.width,height:p.height}))});return s;};
  const visibleText = trail => frames.at(-1).visibleTexts.find(entry => entry.path === trail);
  const requireText = (trail, expected) => {
    const item = visibleText(trail);
    assert.ok(item?.textLayout?.fits && item.textLayout.visibleLineCount > 0, `Missing or clipped text: ${trail}`);
    assert.match(item.text, expected, trail);
  };
  try {
  await capture('startup');
  // Deliberate server fixture: upstream simulator does not execute the GIL graphs.
  if((process.env.SIMULATOR_UI??'AutoPetsGame')==='AutoPetsGame'&&!mode) {
    requireText('Lobby/Title', /小动物自走棋/u);
    for (const name of ['Room', 'Duel', 'Practice']) {
      requirePlayButton(`Lobby/Choices/${name}/Hit`, ['Lobby/Status', 'Lobby/Feedback', 'Lobby/Help']);
    }
    click('Lobby/Choices/Room/Hit');
    await capture('first-request-before-sync');
    requireText('Lobby/Feedback', /正在发起八人吃鸡/u);
    for (let frame = 0; frame < 61; frame++) api.stepPlay(session, 0.1);
    await capture('lobby-request-timeout');
    requireText('Lobby/Feedback', /可以重试/u);
    api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,0,0]);await capture('lobby-fixture');
    requireText('Lobby/Status', /已进入 1 人/u);
    click('Lobby/Choices/Duel/Hit');api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,2,1]);await capture('duel-wait-fixture');
    requireText('Lobby/Feedback', /等待好友/u);
    click('Lobby/Choices/Room/Hit');api.sendPlaySignal(session,'AP_GameLobby',[0,1,1,8,3]);await capture('room-wait-fixture');
    requireText('Lobby/Feedback', /仍在加载/u);
    api.sendPlaySignal(session,'AP_GameLobby',[0,1,0,0,0]);
    click('Lobby/Choices/Practice/Hit');await capture('practice-menu');
    click('Practice/Menu/Continue/Hit');const shopFrame = await capture('practice-shop');
    const primarySkin = shopFrame.paint.find(item => item.id === control('Practice/Primary/Face').Id);
    assert.ok(primarySkin?.imageId === 107015 && primarySkin.imageType === 'Stretch',
      'Practice primary action must use its sliced native plate');
    requireText('Practice/Shop/Pet1/Price', /^3金$/u);
    requireText('Practice/Shop/Pet1/Detail', /^\d+攻$/u);
    requireText('Practice/Shop/Pet1/LifeValue', /^\d+命$/u);
    assert.ok(!visibleText('Practice/Team1/Name'), 'An empty recess should not display a numbered seat');
    for (const [stat, label] of [['Round', '回合'], ['Money', '金币'], ['Wins', '胜场'], ['Lives', '生命']]) {
      requireText(`Practice/${stat}/Label`, new RegExp(`^${label}$`, 'u'));
    }
    requirePlayButton('Practice/Primary/Hit', ['Practice/Shop/Reroll/Hit', 'Practice/Shop/RewardNext/Hit', 'Practice/Hint']);
    requirePlayButton('Practice/Shop/Reroll/Hit', ['Practice/Shop/Buy/Hit', 'Practice/Shop/Freeze/Hit', 'Practice/Hint']);
    requireText('Practice/Money/Value', /^10$/u);
    requireText('Practice/Lives/Value', /^5 \/ 5$/u);
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
      if (roundIndex === 0) {
        const battle = await capture('practice-battle');
        assert.ok(battle.paint.some(item => item.id === control('Practice/Enemy1/Portrait/Layer1').Id));
        let strike = false;
        for (let frame = 0; frame < 75 && !strike; frame++) {
          api.stepPlay(session, 0.1);
          strike = api.playSnapshot(session, { paint: true }).paint.some(control => control.name === 'Wake');
        }
        assert.ok(strike, 'Authoritative attack did not present its strike animation');
        await capture('practice-strike');
        requireText('Practice/Battle/Event', /攻击/u);
        for (let frame = 0; frame < 35; frame++) api.stepPlay(session, 1 / 60);
        await capture('practice-replay');
        for (const name of ['Replay', 'Auto', 'Fast']) requirePlayButton(`Practice/Battle/${name}/Hit`, ['Practice/Battle/Event']);
      }
      press('Primary');press('Primary');if(roundIndex<practiceRounds.length-1)press('Primary');
    }
    const final=await capture('practice-complete');
    for (const name of ['Rewatch', 'NewSeed']) requirePlayButton(`Practice/Battle/${name}/Hit`, ['Practice/Battle/Event']);
    assert.ok(final.logs.some(l=>/phase=ended/.test(l.text)),'Practice did not reach terminal state');
    requireText('Practice/Wins/Value', /^10 \/ 10$/u);
    press('Primary');await capture('practice-restart');
    requireText('Practice/Round/Value', /第 1 轮/u);
    const readOfferNames = () => [1, 2, 3].map(slot => visibleText(`Practice/Shop/Pet${slot}/Name`).text);
    const beforeReroll = readOfferNames();
    press('Shop/Pet1');await capture('practice-offer-detail');
    requireText('Practice/Tooltip/Heading', /芦纹龟/u);
    press('Shop/Freeze');press('Shop/Reroll');
    await capture('practice-frozen-reroll');
    requireText('Practice/Money/Value', /^9$/u);
    requireText('Practice/Shop/Pet1/Tag', /^已冻结$/u);
    const afterReroll = readOfferNames();
    assert.equal(afterReroll[0], beforeReroll[0]);
    assert.ok(afterReroll.slice(1).some((name, index) => name !== beforeReroll[index + 1]),
      'At least one unfrozen offer must change for the fixed restart seed');

    function pointer(type, { centerX, centerY }) {
      api.injectPlayPointer(session, type, centerX, centerY);
      api.stepPlay(session, 1 / 60);
    }
    const pet = 'Practice/Shop/Pet1';
    const team = 'Practice/Team1';
    const food = 'Practice/Shop/Food1';
    const box = trail => api.runtimeLayout(session).get(control(trail).Id);
    const slot = box(`${team}/Hit`);
    const outside = box('Practice/TeamCaption');
    function requireLiftedClearance(trail) {
      const lifted = box(trail);
      assert.ok(Math.abs(lifted.centerX - slot.centerX) <= slot.width, 'Dragged portrait should stay near the active slot');
      for (const target of ['Portrait', 'DropLabel']) {
        const obstacle = box(`${team}/${target}`);
        assert.ok(Math.abs(lifted.centerX - obstacle.centerX) >= (lifted.width + obstacle.width) / 2
          || Math.abs(lifted.centerY - obstacle.centerY) >= (lifted.height + obstacle.height) / 2,
          `Dragged portrait obscures the destination ${target}`);
      }
    }
    const picture = control(`${pet}/Portrait`);
    const petHome = picture.parent;
    const petBefore = visibleText(`${pet}/Name`).text;
    pointer('down', box(`${pet}/Hit`));
    pointer('move', slot);
    await capture('practice-drag-pet-target');
    requireText(`${team}/DropLabel`, /^购买$/u);
    requireText(`${pet}/Name`, /^拖动中$/u);
    assert.notEqual(picture.parent, petHome, 'Dragged portrait must lift out of the source card');
    requireLiftedClearance('Practice/Portrait');
    pointer('move', outside);
    pointer('up', outside);
    await capture('practice-drag-cancel');
    requireText('Practice/Money/Value', /^9$/u);
    assert.ok(!visibleText(`${team}/Name`));
    assert.equal(visibleText(`${pet}/Name`).text, petBefore);
    assert.equal(picture.parent, petHome);
    assert.ok(!visibleText(`${team}/DropLabel`));

    pointer('down', box(`${pet}/Hit`));
    pointer('move', slot);
    pointer('cancel', slot);
    await capture('practice-drag-interrupted');
    requireText('Practice/Money/Value', /^9$/u);
    assert.ok(!visibleText(`${team}/Name`));
    assert.equal(visibleText(`${pet}/Name`).text, petBefore);
    assert.equal(picture.parent, petHome);
    press('Shop/Reroll');
    await capture('practice-drag-interrupt-dismissed');
    requireText('Practice/Money/Value', /^9$/u);
    assert.ok(!visibleText(`${team}/DropLabel`));

    pointer('down', box(`${pet}/Hit`));
    pointer('move', slot);
    pointer('up', slot);
    pointer('up', slot);
    await capture('practice-drag-purchase-preview');
    requireText('Practice/Money/Value', /^9$/u);
    assert.ok(!visibleText(`${team}/Name`));
    requireText('Practice/Hint', /购买需 3 金.*点击标记站位确认/u);
    assert.equal(visibleText(`${pet}/Name`).text, petBefore);
    press('Team1');
    await capture('practice-drag-purchase');
    requireText('Practice/Money/Value', /^6$/u);
    requireText(`${pet}/Name`, /^空商品$/u);
    assert.equal(visibleText(`${team}/Name`).text, petBefore);
    assert.equal(picture.parent, petHome);
    assert.ok(!visibleText(`${team}/DropLabel`));

    const stats = () => ['Detail', 'LifeValue'].map(name => visibleText(`${team}/${name}`).text);
    const statsBefore = stats();
    const nearBottom = { centerX: slot.centerX, centerY: slot.centerY - slot.height / 2 + 2 };
    pointer('down', box(`${food}/Hit`));
    pointer('move', nearBottom);
    await capture('practice-drag-food-target');
    requireText(`${team}/DropLabel`, /^喂食$/u);
    requireLiftedClearance('Practice/Portrait');
    assert.ok(!visibleText(`${team}/Name`), 'Drop feedback occupies the destination caption');
    assert.ok(!visibleText('Practice/OpponentCaption'), 'The lifted portrait must not cover the board caption');
    pointer('up', nearBottom);
    await capture('practice-drag-feed-preview');
    requireText('Practice/Money/Value', /^6$/u);
    assert.deepEqual(stats(), statsBefore);
    requireText('Practice/Hint', /喂食需 3 金.*点击标记站位确认/u);
    press('Team1');
    await capture('practice-drag-feed');
    requireText('Practice/Money/Value', /^3$/u);
    requireText(`${food}/Name`, /^空商品$/u);
    assert.notDeepEqual(stats(), statsBefore);
    requireText(`${team}/XP`, /^L1/u);
    requireText('Practice/OpponentCaption', /下一位电脑对手/u);
    assert.ok(!visibleText(`${team}/DropLabel`));
  }
  if(mode) {
    const portraits = ['Team1', 'Shop/Pet1'].map(slot => control(`Practice/${slot}/Portrait/Layer1`).Id);
    const foodPortrait = control('Practice/Shop/Food1/Portrait/Layer1').Id;
    const shopPortraits = [...portraits, foodPortrait];
    function requireShopPortraits(frame) {
      assert.ok(shopPortraits.every(id => frame.paint.some(item => item.id === id)),
        'The online shop must show the pooled lineup, pet and food artwork');
    }
    // Client-only fixture from the native wire schema. No graph output claimed.
    const market=Array(41).fill(0);market.splice(0,23,1,1,10,0,0,2,1,2,3,1,-2,1,21,3,2,1,1,2,22,3,2,1,1);
    api.sendPlaySignal(session,'AP_GameLobby',[0,playerCount,0,0,0],'AllPlayers');
    click('Lobby/Choices/'+(mode===2?'Duel':'Room')+'/Hit');
    api.sendPlaySignal(session,'AP_GameLobby',[mode,playerCount,0,mode,0],'AllPlayers');
    for(let player=1;player<=playerCount;player++) {
      const target='Player'+player;const personalMarket=[...market];personalMarket[2]=11-player;
      personalMarket[15] = 2;
      if(mode===2){api.sendPlaySignal(session,'AP_DuelSnapshot',[2,player,1,0,false,false,0,1,1,0,0,30,0,5,5,0],target);api.sendPlaySignal(session,'AP_DuelMarket',[1,1,personalMarket],target);}
      else api.sendPlaySignal(session,'AP_RoomView',[1,2,1,player,1,playerCount,0,false,Array(8).fill(5),Array(8).fill(0),[2,1,4,3,6,5,8,7],Array(8).fill(0),personalMarket,0,42],target);
      api.setPlayView(session,player);
      requireShopPortraits(await capture('client-'+player+'-preparation-fixture'));
      requireText(mode === 2 ? 'Duel/MarketGold' : 'Room/Match/Shop/Money', new RegExp('金币 ' + (11 - player) + '(?: |$)', 'u'));
      if (mode === 8) requireText('Room/Standings/Count', new RegExp(`${playerCount} 真人 · ${8 - playerCount} 机器人`, 'u'));
    }
    api.setPlayView(session,1);
    const duel = mode === 2;
    const shop = duel ? 'Duel' : 'Room/Match/Shop';
    const rerollButton = duel ? 'Duel/Reroll' : `${shop}/Reroll/Hit`;
    const readyButton = duel ? 'Duel/Ready' : 'Room/Match/Ready/Hit';
    const between = duel ? 'Duel/InspectReward' : 'Room/Match/Hint';
    requirePlayButton(rerollButton, [readyButton, between]);
    requirePlayButton(readyButton, [rerollButton, between]);
    const requestName = duel ? 'AP_DuelRequest' : 'AP_RoomRequest';
    const requests = () => api.playSnapshot(session).server.inbound.filter(row => row.name === requestName).length;
    const beforeInspect = requests();
    if (duel) {
      const offer = visibleText('Duel/MarketOffers/OfferLabel1').textLayout;
      assert.ok(offer.fits && offer.lines.at(-1) === '3金', 'Offer price should stay on one visible line');
    }
    click(duel ? 'Duel/MarketOffers/InspectPet2' : `${shop}/InspectOffer2/Hit`);
    await capture('client-1-inspect-offer');
    requireText(`${shop}/AbilityTitle`, /烟尾雨燕.*L1.*烟羽/su);
    requireText(`${shop}/AbilityBody`, /开场.*随机.*1 伤/u);
    click(duel ? `${shop}/TeamInspection/InspectTeam1` : `${shop}/InspectTeam1/Hit`);
    await capture('client-1-inspect-team');
    requireText(`${shop}/AbilityTitle`, /芦纹龟.*L2.*芦盾/su);
    requireText(`${shop}/AbilityBody`, /开场.*前排.*2 盾/u);
    const teamStats = visibleText(duel ? `${shop}/TeamLabel1` : `${shop}/Team1/Text`).textLayout;
    assert.ok(teamStats.fits && teamStats.lines.slice(1).join('\n') === '3攻 2命\nL2 · 经验1');
    const [attack, health] = teamStats.richLines[1].runs.filter(run => run.bold);
    assert.ok(attack?.fontSize > 20 && health?.fontSize > 20 && attack.color !== health.color,
      'Combat numerals must stand out as two readable values');
    assert.equal(requests(), beforeInspect, 'Reading abilities must not issue any gameplay request');
    click(duel ? 'Duel/MarketOffers/Buy1' : `${shop}/Offer1/Hit`);
    await capture('client-1-buy-request');
    assert.ok(api.playSnapshot(session).server.inbound.some(row=>row.name===requestName&&row.values[0]===11),'Client buy did not send native request');

    // Round-one deterministic receipt for Player1 against seat 2. The simulator
    // supplies wire values while the GIL client verifies and resolves them.
    const replaySignal = duel ? 'AP_DuelReplay' : 'AP_RoomReplay';
    const sendReplay = (outcome, target = 'Player1') => api.sendPlaySignal(session, replaySignal, duel
      ? [1, 42, outcome, [1, 1, 5, 8, 1], [2, 2, 1, 4, 1]]
      : [1, 1, 2, outcome, 42, [1, 1, 1, 5, 8, 1, 0], [1, 2, 2, 1, 4, 1, 0]], target);
    if (duel) {
      api.sendPlaySignal(session, 'AP_DuelSnapshot', [2, 1, 1, 3, true, false, 0, 2, 2, 0, 0, 0, 0, 5, 5, 0], 'Player1');
    } else {
      api.sendPlaySignal(session, 'AP_RoomView', [2, 3, 1, 1, 2, playerCount, 0, true,
        Array(8).fill(5), Array(8).fill(0), [2, 1, 4, 3, 6, 5, 8, 7], Array(8).fill(0), market, 0, 0], 'Player1');
    }
    await capture('client-1-replay-wait');
    if (duel) requireText('Duel/Status', /战斗计算中/u);
    sendReplay(2);
    const rejected = await capture('client-1-replay-bad-outcome');
    assert.ok(rejected.logs.some(entry => entry.text.includes('replay_mismatch')), 'A contradictory result must be rejected');
    sendReplay(1);

    const eventTrail = duel ? 'Duel/ReplayStatus' : 'Room/Match/Replay/Event';
    const eventId = control(eventTrail).Id;
    const renderedEvent = () => api.playSnapshot(session, { paint: true }).paint.find(item => item.id === eventId)?.text;
    const expectEvents = [
      ['attack', /芦纹龟.*出击.*烟尾雨燕/u],
      ['damage', /烟尾雨燕.*-5命.*余0命/u],
      ['faint', /烟尾雨燕.*退场/u],
      ['result', /战斗结束|本轮获胜/u],
    ];
    for (let frame = 0; frame < 200 && expectEvents.length; frame++) {
      const [name, pattern] = expectEvents[0];
      const eventText = renderedEvent();
      if (eventText && pattern.test(eventText)) {
        const replayFrame = await capture(`client-1-replay-${name}`);
        requireText(eventTrail, pattern);
        if (duel && name === 'attack') requireText('Duel/Status', /正在播放本轮战斗/u);
        if (duel && name === 'result') requireText('Duel/Status', /回放结束 · 等待结算/u);
        if (name === 'attack') {
          const [own, enemy] = portraits.map(id => replayFrame.paint.find(item => item.id === id));
          assert.ok(own && enemy && own.left + own.width < enemy.left,
            'The original portraits must appear on opposing lanes');
          assert.ok(!replayFrame.paint.some(item => item.id === foodPortrait),
            'A food offer must not appear in battle');
          const playback = duel ? 'Duel/Replay' : 'Room/Match/Replay/Auto/Hit';
          click(playback);
          for (let step = 0; step < 12; step++) api.stepPlay(session, 0.05);
          assert.equal(renderedEvent(), eventText, 'Paused playback changed the rendered event');
          if (duel) {
            await capture('client-1-replay-paused');
            requireText('Duel/Status', /本轮回放已暂停/u);
          }
          click(playback);
        }
        expectEvents.shift();
      }
      api.stepPlay(session, 0.05);
    }
    assert.deepEqual(expectEvents.map(([name]) => name), [], 'Replay must visibly progress through authority-derived phases');
    if (duel) {
      api.sendPlaySignal(session, 'AP_DuelSnapshot', [2, 1, 1, 1, true, false, 1, 3, 3, 0, 0, 7, 0, 5, 4, 1], 'Player1');
      await capture('client-1-settlement');
      requireText('Duel/Status', /本轮获胜 · 确认下一轮/u);
    }
    if (!duel && playerCount > 1) {
      api.sendPlaySignal(session, 'AP_RoomView', [2, 3, 1, 2, 2, playerCount, 0, true,
        Array(8).fill(5), Array(8).fill(0), [2, 1, 4, 3, 6, 5, 8, 7], Array(8).fill(0), market, 0, 0], 'Player2');
      sendReplay(1, 'Player2');
      api.setPlayView(session, 2);
      click('Room/Match/Replay/Follow/Hit');
      await capture('client-2-replay-loss');
      requireText('Room/Match/Replay/RoundText', /本轮落败/u);
      requireText(eventTrail, /对方获胜/u);
      api.setPlayView(session, 1);
    }
    click(duel ? 'Duel/Back/Hit' : 'Room/Back/Hit');
    const returned = await capture('client-1-return');
    assert.ok(!returned.paint.some(item => shopPortraits.includes(item.id)), 'Pooled portraits must be hidden in the lobby');
    requirePlayButton('Lobby/Continue/Hit', ['Lobby/Title', 'Lobby/Status', 'Lobby/Feedback', 'Lobby/Help']);
    requireText('Lobby/Continue/Title', mode === 2 ? /回到好友 1v1/u : /回到八人吃鸡/u);
    click('Lobby/Continue/Hit');
    await capture('client-1-reenter');
    function nextMarket(version, gold) {
      const next = [...market];
      next[0] = 2;
      next[2] = gold;
      if (duel) {
        api.sendPlaySignal(session, 'AP_DuelSnapshot', [2, 1, 2, 0, false, false, 1, version, version,
          0, 0, 30, 0, 5, 4, 0], 'Player1');
        api.sendPlaySignal(session, 'AP_DuelMarket', [2, version, next], 'Player1');
      } else {
        api.sendPlaySignal(session, 'AP_RoomView', [version, 2, 2, 1, version, playerCount, 0, false,
          Array(8).fill(5), Array(8).fill(0), [2, 1, 4, 3, 6, 5, 8, 7], Array(8).fill(0), next, 0, 42], 'Player1');
      }
    }
    function requireSingleRequest(trail, action) {
      const before = requests();
      click(trail);click(trail);
      const after = api.playSnapshot(session).server.inbound.filter(row => row.name === requestName);
      assert.equal(after.length, before + 1, `Expected one pending request from ${trail}`);
      assert.equal(after.at(-1).values[0], action);
    }
    nextMarket(4, 10);
    requireSingleRequest(rerollButton, 10);
    nextMarket(5, 9);
    requireSingleRequest(readyButton, 1);
    requireShopPortraits(await capture('client-1-next-round-actions-fixture'));
    if (canvasId === 'mobile-19.5-9') {
      if (duel) {
        api.sendPlaySignal(session, 'AP_DuelSnapshot', [2, 1, 2, 3, true, false, 1, 6, 6, 0, 0, 0, 0, 5, 4, 0], 'Player1');
      } else {
        api.sendPlaySignal(session, 'AP_RoomView', [6, 3, 2, 1, 6, playerCount, 0, true,
          Array(8).fill(5), Array(8).fill(0), [2, 1, 4, 3, 6, 5, 8, 7], Array(8).fill(0), market, 0, 0], 'Player1');
      }
      api.sendPlaySignal(session, replaySignal, duel
        ? [2, 42, 1, [1, 1, 999, 999, 3], [2, 2, 1, 4, 1]]
        : [2, 1, 2, 1, 42, [1, 1, 1, 999, 999, 3, 0], [1, 2, 2, 1, 4, 1, 0]], 'Player1');
      const stats = duel ? 'Duel/ReplayBoard/Own1' : 'Room/Match/Replay/Own1';
      const statsId = control(stats).Id;
      for (let step = 0; step < 50; step++) {
        const label = api.playSnapshot(session, { paint: true }).paint.find(item => item.id === statsId);
        if (label?.text?.includes('盾')) break;
        api.stepPlay(session, 0.05);
      }
      await capture('client-1-replay-long-stats');
      const { textLayout } = visibleText(stats) ?? {};
      assert.ok(textLayout?.fits && textLayout.visibleLineCount === 3, 'Long combat values must leave the shield visible');
      assert.match(textLayout.lines[1], /^999攻 99[89]命$/u);
      assert.match(textLayout.lines[2], /^盾 \d+$/u);
    }
  }
  for(const [index,trail] of JSON.parse(process.env.SIMULATOR_CLICKS??'[]').entries()){click(trail);await capture('click-'+index);}
  } catch(error){runtimeExceptions.push({message:error.message,stack:error.stack});await capture('runtime-exception');}
  results.push({canvasId,playerCount,mode:mode??'practice',runtimeExceptions,inputs,playButtons,frames,history:api.playSnapshot(session).history});api.stopPlay(session);
}
const buildPath=path.join(path.dirname(gil),'BUILD.json');
const build=fs.existsSync(buildPath)?JSON.parse(fs.readFileSync(buildPath)):{};
if(build.sha256)assert.equal(build.sha256,receipt.mapSha256,'BUILD.json GIL digest mismatch');
const textDefects = results.flatMap(result => result.frames.flatMap(frame => frame.visibleTexts
  .filter(text => text.text.trim() && (!text.textLayout?.fits || text.textLayout.visibleLineCount === 0))
  .map(text => ({ canvasId: result.canvasId, frame: frame.name, path: text.path, text: text.text,
    height: text.height, requiredHeight: text.textLayout?.requiredHeight }))));
const assetDefects = results.flatMap(result => result.frames.flatMap(frame => frame.assetWarnings
  .map(warning => ({ canvasId: result.canvasId, mode: result.mode, frame: frame.name, ...warning }))));
const runtimeFailed = results.some(result => result.runtimeExceptions.length || result.frames.some(frame => frame.mountError || frame.logs.length));
const status = runtimeFailed ? 'runtime-failed' : assetDefects.length ? 'observed-asset-defects'
  : textDefects.length ? 'observed-text-defects' : 'executed';
const report={schemaVersion:1,toolSourceSha256:{nativeReader:sha256(fs.readFileSync(path.join(mcp,'src/scene-save.mjs'))),luaRuntime:sha256(fs.readFileSync(path.join(sim,'client/lua-runtime/src/runtime.js'))),luaBridge:sha256(fs.readFileSync(path.join(sim,'client/lua-runtime/src/lua-bridge.js'))),renderer:sha256(fs.readFileSync(path.join(sim,'studio/host-png.js'))),playSession:sha256(fs.readFileSync(path.join(sim,'studio/play/session.js')))},sourceRevision:build.sourceRevision??null,designVersion:build.designVersion??null,textDefects,assetDefects,scope:'Actual upstream Lua VM and software renderer, native GIL UI/scripts; server fixture explicitly identified',status,mcpCommit:revision(mcp),simulatorCommit:revision(sim),officialClient:'not-executed',...receipt,results};
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,output,controls:receipt.controls,results:results.map(r=>({canvasId:r.canvasId,playerCount:r.playerCount,runtimeExceptions:r.runtimeExceptions,frames:r.frames.map(f=>({name:f.name,mountError:f.mountError,errors:f.logs}))}))},null,2));

if(runtimeFailed || assetDefects.length || (process.env.SIMULATOR_REQUIRE_TEXT==='1'&&textDefects.length))process.exitCode=1;
