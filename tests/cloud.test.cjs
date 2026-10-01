// SDK doubles test retry/queue/listener behavior; no real Firebase credentials required.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function fixture({enabled=true,protocol='https:'}={}) {
  const memory=new Map(),documents=new Map(),events=new Map();
  let fail=false,loseAck=false,callbacks=null,stops=0,writes=0,loads=0;
  const dbSDK={
    getFirestore:()=>({}),doc:(db,...segments)=>segments.join('/'),collection:(db,...segments)=>segments.join('/'),
    serverTimestamp:()=>123,orderBy:(field,direction)=>({field,direction}),limit:n=>({limit:n}),query:(ref,...clauses)=>({ref,clauses}),
    async runTransaction(db,fn){
      if(fail)throw Object.assign(new Error('offline'),{code:'unavailable'});
      await fn({get:async ref=>({exists:()=>documents.has(ref)}),set:(ref,data)=>{writes++;documents.set(ref,data);}});
      if(loseAck){loseAck=false;throw Object.assign(new Error('lost ack'),{code:'unavailable'});}
    },
    onSnapshot(query,success,error){callbacks={query,success,error};return ()=>{stops++;};}
  };
  const auth={currentUser:{uid:'anonymous-one'},authStateReady:async()=>{}};
  const window={addEventListener:(name,fn)=>events.set(name,fn),loadSDK:async url=>{
    loads++;
    if(url.endsWith('firebase-app.js'))return {initializeApp:()=>({})};
    if(url.endsWith('firebase-auth.js'))return {getAuth:()=>auth,signInAnonymously:async()=>{auth.currentUser={uid:'anonymous-one'};}};
    return dbSDK;
  }};
  const sandbox={window,location:{protocol},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
  vm.createContext(sandbox);
  for(const file of ['config','storage','firebase-config'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),sandbox);
  window.CardFlipMatch.firebaseSettings={enabled,firebaseConfig:{apiKey:'test',authDomain:'test',projectId:'test',appId:'test'}};
  // Replace only the network SDK imports with controlled doubles.
  const cloud=fs.readFileSync(path.join(root,'js/cloud.js'),'utf8').replace(/import\("([^"]+)"\)/g,'window.loadSDK("$1")');
  vm.runInContext(cloud,sandbox);
  return {C:window.CardFlipMatch,documents,events,memory,auth,setFail:value=>{fail=value;},loseAck:()=>{loseAck=true;},get callbacks(){return callbacks;},get writes(){return writes;},get stops(){return stops;},get loads(){return loads;}};
}
const record=(id,difficulty='normal')=>({id,nickname:'검사',difficulty,version:'difficulty-v2',scoringVersion:'run-total-v1',round:1,completedRounds:0,reason:'quit',score:100,bonus:0,elapsedMs:1000,attempts:1,matchedPairs:1,createdAt:100});
(async()=>{
  const local=fixture({enabled:false});local.C.storage.addRecord(record('local'));
  assert.equal(await local.C.cloud.sync(),false);assert.equal(local.loads,0);assert.equal(local.C.storage.pending().length,1);
  const file=fixture({protocol:'file:'});assert.equal(await file.C.cloud.sync(),false);assert.match(file.C.cloud.status,/HTTP/);
  const f=fixture();f.auth.currentUser=null;
  f.C.storage.addRecord(record('one'));f.setFail(true);
  assert.equal(await f.C.cloud.sync(),false);assert.equal(f.C.storage.pending().length,1);
  assert.match(f.C.cloud.status,/로컬 기록 보관/);
  f.setFail(false);f.loseAck();assert.equal(await f.C.cloud.sync(),false);
  assert.equal(f.writes,1);assert.equal(f.C.storage.pending().length,1);
  assert.equal(await f.C.cloud.sync(),true);assert.equal(f.writes,1);assert.equal(f.C.storage.pending().length,0);
  const uploaded=[...f.documents.values()][0];assert.equal(uploaded.uid,'anonymous-one');assert.equal('age' in uploaded,false);assert.equal('gender' in uploaded,false);
  f.C.storage.addRecord(record('two','hard'));
  await Promise.all([f.C.cloud.sync(),f.C.cloud.sync()]);assert.equal(f.writes,2);
  let received=null,failed=false;
  await f.C.cloud.watch('normal',entries=>{received=entries;},()=>{failed=true;});
  assert.ok(f.callbacks.query.ref.endsWith('difficulty-v2_run-total-v1_normal/records'));
  assert.equal(f.callbacks.query.clauses.at(-1).limit,100);
  f.callbacks.success({docs:[{data:()=>record('one')},{data:()=>record('invalid','hard')},{data:()=>({...record('bad'),score:999})}]});
  assert.equal(received.length,1);assert.equal(received[0].rank,1);
  f.callbacks.error({code:'failed-precondition'});assert.equal(failed,true);assert.match(f.C.cloud.status,/색인/);
  const previous=f.callbacks;f.C.cloud.stopWatching();received=null;
  previous.success({docs:[{data:()=>record('one')}]});assert.equal(received,null);assert.equal(f.stops,1);
  f.C.storage.addRecord(record('three'));f.events.get('online')();await f.C.cloud.sync();assert.equal(f.C.storage.pending().length,0);
  console.log('PASS unconfigured/file modes, anonymous auth, offline queue, lost acknowledgement, idempotent/concurrent retry, field privacy, bounded difficulty query, malformed records, listener failure and cancellation, online reconnect');
})().catch(error=>{console.error(error);process.exitCode=1;});
