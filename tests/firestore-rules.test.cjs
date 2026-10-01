// Emulator only: these synthetic scores must never reach the public leaderboard.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw new Error('Set FIRESTORE_EMULATOR_HOST to a local emulator. Live tests are prohibited.');
const project='demo-cardflipmatch',sandbox={window:{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/config.js'),'utf8'),sandbox);
const C=sandbox.window.CardFlipMatch.config;
const root=`projects/${project}/databases/(default)/documents`,url=`http://${host}/v1/${root}:commit`;
let serial=0;
const runId=Date.now().toString(36);
const encode=value=>typeof value==='string'?{stringValue:value}:Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
const token=uid=>[Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({aud:project,iss:`https://securetoken.google.com/${project}`,sub:`${runId}-${uid}`,user_id:`${runId}-${uid}`,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'anonymous'}})).toString('base64url'),''].join('.');
function fixture(mode='normal',round=1,reason='quit'){
  const completed=reason==='complete'?50:round-1;
  let pairs=0,bonus=0,elapsed=0;
  for(let i=1;i<=completed;i++){const cfg=C.roundConfig(i,mode),time=cfg.pairs*100+200;pairs+=cfg.pairs;bonus+=Math.floor(cfg.seconds-time/1000)*10;elapsed+=time;}
  if(reason!=='complete')elapsed+=reason==='timeout'?C.roundConfig(round,mode).seconds*1000:500;
  return {id:`test-${++serial}`,nickname:'규칙검사',difficulty:mode,version:C.version,scoringVersion:C.scoringVersion,round,completedRounds:completed,reason,matchedPairs:pairs,bonus,score:pairs*100+bonus,elapsedMs:elapsed,attempts:pairs};
}
function writes(uid,r,{ledger=true,clientTime=false,wrongLink=false}={}){
  uid=`${runId}-${uid}`;
  const board=`${r.version}_${r.scoringVersion}_${r.difficulty}`,id=`${uid}_${r.id}`;
  const record={update:{name:`${root}/leaderboards/${board}/records/${id}`,fields:Object.fromEntries(Object.entries({...r,uid}).map(([k,v])=>[k,encode(v)]))},currentDocument:{exists:false},updateTransforms:[{fieldPath:'submittedAt',setToServerValue:'REQUEST_TIME'}]};
  if(clientTime)record.update.fields.createdAt=encode(0);else record.updateTransforms.push({fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'});
  return [record,...(ledger?[{update:{name:`${root}/submissionLimits/${uid}`,fields:{board:encode(board),recordId:encode(wrongLink?'wrong':id)}},updateTransforms:[{fieldPath:'lastAt',setToServerValue:'REQUEST_TIME'}]}]:[])];
}
async function commit(uid,body,allowed){const res=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token(uid)}`,'Content-Type':'application/json'},body:JSON.stringify({writes:body})});const json=await res.json();assert.equal(res.ok,allowed,JSON.stringify(json));return json;}
async function check(record,allowed,options){await commit(`user-${++serial}`,writes(`user-${serial}`,record,options),allowed);}
(async()=>{
  for(const mode of ['easy','normal','hard']){
    for(let round=1;round<=50;round++){
      await check(fixture(mode,round,'quit'),true);
      await check(fixture(mode,round,'timeout'),true);
    }
    await check(fixture(mode,50,'complete'),true);
  }
  console.log('PASS legitimate cumulative quit/timeout across 150 round configurations and 3 full completions');
  const good=fixture('normal',2,'quit');
  for(const patch of [{score:999999},{bonus:0,score:200,elapsedMs:500},{elapsedMs:59001},{attempts:100000},{completedRounds:50},{matchedPairs:100},{age:30},{uid:'victim'},{nickname:' '},{bonus:271,score:471},{reason:'complete'}]){
    // UID is tested separately because the helper intentionally supplies authenticated ownership.
    if('uid' in patch){const body=writes('forged-user',{...good,id:'forged'});body[0].update.fields.uid=encode('victim');await commit('forged-user',body,false);continue;}
    await check({...good,id:`tamper-${++serial}`,...patch},false);
  }
  await check(good,false,{ledger:false});await check(good,false,{wrongLink:true});await check(good,false,{clientTime:true});
  await check({...fixture(),matchedPairs:1,attempts:1,score:100,elapsedMs:0},false);
  const uid='repeat-user',first=fixture(),second=fixture();
  await commit(uid,writes(uid,first),true);
  await commit(uid,writes(uid,second),false);
  const recordName=writes(uid,first)[0].update.name;
  await commit(uid,[{update:{name:recordName,fields:{score:encode(999)}}}],false);
  await commit(uid,[{delete:recordName}],false);
  await commit('other-user',[{update:{name:`${root}/submissionLimits/${uid}`,fields:{}}}],false);
  await commit(uid,[writes(uid,second)[1]],false);
  await commit('multi-user',[...writes('multi-user',fixture()),...writes('multi-user',fixture()).slice(0,1)],false);
  await new Promise(resolve=>setTimeout(resolve,11000));
  await commit(uid,writes(uid,second),true);
  console.log('PASS score/time/bonus/attempt tampering, extra private fields, timestamp backdating, missing/mismatched ledger, UID ownership, rapid submission, multi-record batch, immutable record and cooldown recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
