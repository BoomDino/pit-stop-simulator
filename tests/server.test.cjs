const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const source = fs.readFileSync('server.js', 'utf8');
function harness() {
  let handler, proxyOptions;
  const http = {
    createServer(fn) { handler=fn; return {listen(){}}; },
    request(options) { proxyOptions=options; const emitter=new EventEmitter(); return emitter; }
  };
  vm.runInNewContext(source, {require(name){return name==='http'?http:require(name);},
    process:{env:{},uptime:()=>1}, __dirname:process.cwd(), URL, console});
  function request(url,method='GET') {
    let status=200,body='';const headers={};
    const req={url,method,headers:{host:'localhost:3000'},pipe(upstream){upstream.emit('error',new Error('offline'));}};
    const res={setHeader(k,v){headers[k]=v;},writeHead(code,h){status=code;Object.assign(headers,h);},
      end(value=''){body=value;},get headersSent(){return false;}};
    handler(req,res);
    return {status,body,headers,proxyOptions};
  }
  return request;
}
test('private backend, credentials, database and git paths are not served',()=>{
  const request=harness();
  for(const file of ['/backend/.env','/.git/config','/backend/pitstop.sqlite3','/server.js','/uipath/PitStopAutomation.xaml','/%2eenv']) {
    assert.equal(request(file).status,404,file);
  }
  assert.equal(request('/%ZZ').status,400);
});
test('automation proxy reports backend unavailable and preserves route',()=>{
  const request=harness();const res=request('/api/pitstop/event?retry=true','POST');
  assert.equal(res.status,503);assert.match(res.body,/FastAPI unavailable/);
  assert.equal(res.proxyOptions.path,'/api/pitstop/event?retry=true');
  assert.equal(res.proxyOptions.hostname,'127.0.0.1');
});
test('simulation telemetry remains explicitly labelled and leaderboard stays local',()=>{
  const request=harness();
  assert.equal(JSON.parse(request('/api/telemetry').body).simulated,true);
  assert.ok(Array.isArray(JSON.parse(request('/api/leaderboard').body)));
});
