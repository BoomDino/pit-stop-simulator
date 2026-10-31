const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
function harness() {
  const elements = new Map(), storage = new Map(), timers = [];
  const element = () => ({textContent:'', innerHTML:'', dataset:{}, style:{}, children:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(){},setAttribute(){},replaceChildren(...x){this.children=x;}, focus(){},
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},
    getContext(){return new Proxy({}, {get:()=>()=>{}});}});
  const document = {getElementById(id){if(!elements.has(id)) elements.set(id,element());return elements.get(id);},
    querySelectorAll(){return [];}, querySelector(){return null;}, createElement:element};
  const window = {location:{protocol:'http:'},addEventListener(){},
    soundEngine:new Proxy({}, {get:()=>()=>{}}),
    ParticleEngine:class {start(){} spawnSparks(){} spawnShockwave(){} spawnConfetti(){} spawnFaultSparks(){}},
    leaderboardManager:{renderToTable(){},renderToCompactTable(){},getBestTime(){return null;}}};
  const context = vm.createContext({window,document,crypto:{randomUUID},Date,Math,JSON,console,
    performance:{now:()=>10000},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    AbortController,fetch:async()=>{throw new Error('offline');},
    setInterval(){return 1;},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
    requestAnimationFrame(){return 1;},cancelAnimationFrame(){}});
  vm.runInContext(fs.readFileSync('js/rpa-engine.js','utf8'),context);
  vm.runInContext(fs.readFileSync('js/game.js','utf8')+'\nwindow.GameClass=PitStopGame;',context);
  return {window,document,timers,storage,context};
}
const flush = async()=>{for(let i=0;i<15;i++) await Promise.resolve();};
test('all six stages stay manual, finish with backend offline, and retain events',async()=>{
  const h=harness(); const game=new h.window.GameClass();
  game.assistModeEnabled=true; game.startGame();
  assert.equal(typeof game.scheduleAssistHit,'undefined');
  for(let stage=1;stage<=6;stage++) {
    assert.equal(game.currentStageIndex,stage);
    game.stageReadyTime=0; game.needleAngle=game.targetCenterAngle;
    game.handlePlayerAction();
    const advance=h.timers.findIndex(t=>t.ms===450 && t.fn.toString().includes('generation'));
    assert.notEqual(advance,-1); h.timers.splice(advance,1)[0].fn();
    await flush();
  }
  assert.equal(game.isCompleted,true); assert.equal(game.perfectHits,6);
  assert.equal(game.rpa.queue.length,6);
  assert.ok(game.rpa.queue.every(x=>x.state!=='SUCCESS' && !x.job_id));
  assert.equal(h.document.getElementById('rpa-bot').textContent,'BOT OFFLINE');
  assert.equal(JSON.parse(h.storage.get(game.rpa.key)).length,6);
});
test('real-result contract advances queue only after matched backend confirmation',async()=>{
  const h=harness();const game=new h.window.GameClass();game.assistModeEnabled=true;game.startGame();
  const calls=[];let id=0;
  game.rpa.api=async(path, options)=>{
    calls.push(path);
    if(options) return {state:'PENDING',job_id:String(++id)};
    return {state:'SUCCESS',job_id:String(id),result:'confirmed by test backend'};
  };
  for(let stage=1;stage<=6;stage++){game.perfectHits=stage;game.rpa.onHit(stage);await flush();}
  for(let i=0;i<12;i++){await game.rpa.pump();await flush();}
  assert.equal(game.rpa.queue.filter(x=>x.state==='SUCCESS').length,6);
  assert.equal(calls.filter(x=>x==='/api/pitstop/event').length,6);
});
test('reset cancels old stage advancement without deleting pending robot events',async()=>{
  const h=harness();const game=new h.window.GameClass();game.assistModeEnabled=true;game.startGame();
  game.stageReadyTime=0;game.needleAngle=game.targetCenterAngle;game.handlePlayerAction();
  const old=h.timers.find(t=>t.ms===450 && t.fn.toString().includes('generation'));
  game.resetGame();game.startGame();old.fn();
  assert.equal(game.currentStageIndex,1);assert.equal(game.rpa.queue.length,1);
  await flush();
});
test('assist disabled submits nothing; mid-run enabling retains sequence',async()=>{
  const h=harness();const game=new h.window.GameClass();game.startGame();
  game.rpa.onHit(1);assert.equal(game.rpa.queue.length,0);
  game.toggleAssistMode();assert.equal(game.rpa.queue[0].event.stage,1);
  await flush();
});
