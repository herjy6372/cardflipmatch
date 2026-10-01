/* Run: node tests/game.test.cjs (Playwright must be available to Node). */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const url=process.env.GAME_TEST_URL || pathToFileURL(path.join(root,'index.html')).href;
const screenshotDir=path.join(root,'.tools','test-results');
fs.mkdirSync(screenshotDir,{recursive:true});
const reports=[];
const pass=message=>{reports.push(message);console.log('PASS '+message);};
async function profile(page,name='민트') {
  await page.locator('#nickname').fill(name);
  await page.locator('#age').selectOption('25');
  await page.locator('#gender').selectOption('undisclosed');
}
async function start(page,name) {await profile(page,name);await page.locator('#start-button').click();}
async function solve(page) {
  await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll('#board .card')].sort((a,b)=>a.dataset.id.localeCompare(b.dataset.id));
    for(const button of buttons)if(!button.classList.contains('is-matched'))button.click();
  });
}
async function matchOne(page) {
  await page.evaluate(()=>{
    const bs=[...document.querySelectorAll('.card:not(.is-matched)')];
    const first=bs[0],second=bs.find(b=>b!==first&&b.dataset.id.split('-')[0]===first.dataset.id.split('-')[0]);first.click();second.click();
  });
}
async function mismatch(page) {
  await page.evaluate(()=>{
    const bs=[...document.querySelectorAll('.card:not(.is-matched)')];
    const first=bs[0],second=bs.find(b=>b.dataset.id.split('-')[0]!==first.dataset.id.split('-')[0]);first.click();second.click();
  });
}
async function view(page){return page.locator('body').getAttribute('data-view');}
async function advanceTime(page,ms){await page.evaluate(ms=>{window.__fixedTime+=ms;},ms);}
async function records(page){return page.evaluate(()=>CardFlipMatch.storage.rankings());}
async function restart(page){await page.locator('#show-ranking').click();await page.locator('#continue-button').click();}
async function quit(page){await page.locator('.quit-button:visible').click();}
async function checkOverflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label);}
(async()=>{
  const memory=new Map();
  const legacy=JSON.stringify({schema:2,records:[{id:'old-round-record'}],settings:{character:'female',bgmVolume:.6}});
  memory.set('cardFlipMatch:v2',legacy);
  const sandbox={window:{},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
  vm.createContext(sandbox);
  for(const f of ['config','storage'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),sandbox);
  const C=sandbox.window.CardFlipMatch;
  assert.equal(C.storage.rankings().length,0);assert.equal(C.storage.settings.character,'female');assert.equal(C.storage.settings.bgmVolume,.6);
  C.storage.saveSettings({sfxVolume:.4});assert.equal(memory.get('cardFlipMatch:v2'),legacy);
  pass('v4 keeps old round records untouched and migrates preferences only');
  for(let round=1;round<=50;round++){
    const cfg=C.config.roundConfig(round),cards=C.config.createCards(round);
    assert.equal(cards.length,cfg.count);assert.equal(new Set(cards.map(c=>c.id)).size,cfg.count);
    const counts={};for(const c of cards)counts[c.pairId]=(counts[c.pairId]||0)+1;
    assert.ok(Object.values(counts).every(n=>n===2));
  }
  for(const [r,count,sec] of [[1,4,30],[2,4,29],[5,4,26],[6,8,38],[10,8,34],[11,12,46],[16,16,54],[21,20,62],[26,24,70],[31,28,78],[36,32,86],[41,40,102],[46,48,118],[50,48,114]]){
    const c=C.config.roundConfig(r);assert.equal(c.count,count);assert.equal(c.seconds,sec);
  }
  for(const r of [0,51,1.5,NaN])assert.throws(()=>C.config.roundConfig(r));
  for(let round=1;round<=50;round++){
    const easy=C.config.roundConfig(round,'easy'),normal=C.config.roundConfig(round,'normal'),hard=C.config.roundConfig(round,'hard');
    assert.ok(easy.seconds>normal.seconds && normal.seconds>hard.seconds);
    for(const mode of ['easy','hard']) assert.equal(C.config.createCards(round,mode).length,normal.count);
  }
  assert.throws(()=>C.config.roundConfig(1,'invalid'));
  pass('All 150 difficulty/round configurations, progression, boundaries, unique cards and exact pairs');
  const record=(id,overrides={})=>({id,nickname:'테스트',difficulty:'normal',version:'difficulty-v2',scoringVersion:'run-total-v1',round:2,completedRounds:1,reason:'timeout',score:400,bonus:100,elapsedMs:40000,attempts:3,matchedPairs:3,createdAt:100,...overrides});
  C.storage.addRecord(record('a'));C.storage.addRecord(record('b'));C.storage.addRecord(record('c',{score:390,bonus:90}));
  C.storage.addRecord(record('d',{round:1,completedRounds:0,reason:'quit',score:100,bonus:0,matchedPairs:1,elapsedMs:1000}));
  assert.equal(C.storage.rankings().map(x=>x.rank).join(','),'1,1,3,4');
  C.storage.addRecord(record('a'));assert.equal(C.storage.rankings().length,4);
  C.storage.addRecord(record('e',{age:25,gender:'female'}));assert.ok(!memory.get(C.storage.key).includes('gender'));assert.ok(!memory.get(C.storage.key).includes('age'));
  for(const patch of [{round:51},{score:Infinity},{score:401},{reason:'success'},{scoringVersion:'old'},{completedRounds:50}])assert.equal(C.storage.validateRecord(record('bad',patch)),false);
  assert.ok(C.storage.compare(record('a',{score:500,bonus:200}),record('b'))<0);
  assert.ok(C.storage.compare(record('a',{completedRounds:2}),record('b'))<0);
  assert.ok(C.storage.compare(record('a',{elapsedMs:1000}),record('b',{elapsedMs:2000}))<0);
  assert.ok(C.storage.compare(record('a',{attempts:3}),record('b',{attempts:4}))<0);
  pass('Total-score ranking across rounds, ties, validation, duplicate guard and no age/gender persistence');
  C.storage.addRecord(record('easy',{difficulty:'easy'}));
  assert.equal(C.storage.rankings('easy').length,1);assert.equal(C.storage.rankings('hard').length,0);
  const pending=C.storage.pending().length;C.storage.markSynced('easy');assert.equal(C.storage.pending().length,pending-1);
  pass('Difficulty rankings are separated and successful uploads leave the pending queue');
  const browser=await chromium.launch({headless:true,...(process.env.GAME_TEST_BROWSER?{executablePath:process.env.GAME_TEST_BROWSER}:{})});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:1000}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.locator('#character-sprite').waitFor({state:'visible'});
    await page.evaluate(()=>{window.__fixedTime=100000;Date.now=()=>window.__fixedTime;});
    await page.screenshot({path:path.join(screenshotDir,'desktop-ready.png'),fullPage:true});
    await page.locator('#start-button').click();assert.equal(await view(page),'ready');
    await profile(page,'   ');await page.locator('#start-button').click();assert.equal(await view(page),'ready');
    await start(page,'<b>민트</b>');
    const ids=await page.locator('#board .card').evaluateAll(bs=>bs.map(b=>b.dataset.id));
    const first=ids[0],second=ids.find(id=>id.split('-')[0]!==first.split('-')[0]),third=ids.find(id=>id!==first&&id!==second);
    await page.locator(`[data-id="${first}"]`).focus();await page.keyboard.press('Enter');
    await page.locator(`[data-id="${first}"]`).dispatchEvent('click');assert.equal(await page.locator('#attempts-value').textContent(),'0');
    await page.evaluate(({second,third})=>{document.querySelector(`[data-id="${second}"]`).click();document.querySelector(`[data-id="${third}"]`).click();},{second,third});
    assert.equal(await page.locator('#board .is-open').count(),2);assert.equal(await page.locator('#attempts-value').textContent(),'1');
    await page.waitForTimeout(600);assert.equal(await page.locator('#board .is-open').count(),0);
    pass('Profile validation, keyboard, duplicate input and mismatch lock unchanged');
    let expectedScore=0,expectedBonus=0,expectedPairs=0;
    for(let round=1;round<=50;round++){
      const cfg=C.config.roundConfig(round);
      assert.equal(await view(page),'play');assert.equal(Number(await page.locator('#round-number').textContent()),round);
      assert.equal(await page.locator('#board .card').count(),cfg.count);
      assert.equal(Number((await page.locator('#score-value').textContent()).replaceAll(',','')),expectedScore);
      if(round===46){
        for(const width of [320,375,768,1280]){
          await page.setViewportSize({width,height:900});await checkOverflow(page,`48 cards at ${width}`);
          const sizes=await page.locator('.card').evaluateAll(bs=>bs.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})));
          assert.ok(sizes.every(s=>s.w>=44&&s.h>=44));
          await page.screenshot({path:path.join(screenshotDir,`board-48-${width}.png`),fullPage:true});
        }
        await page.setViewportSize({width:812,height:375});await checkOverflow(page,'landscape');await page.setViewportSize({width:1280,height:1000});
      }
      await advanceTime(page,1700);await solve(page);
      const bonus=(cfg.seconds-2)*10;expectedScore+=cfg.pairs*100+bonus;expectedBonus+=bonus;expectedPairs+=cfg.pairs;
      if(round<50){
        assert.equal(await view(page),'round-clear');assert.equal(await page.locator('#round-clear-title').textContent(),`${round}라운드 완료!`);
        assert.equal(await page.locator('#result-panel').isHidden(),true);assert.equal(await page.locator('#ranking-panel').isHidden(),true);assert.equal((await records(page)).length,0);
        await page.locator('#show-ranking').dispatchEvent('click');assert.equal(await view(page),'round-clear');
        if(round===1)await page.screenshot({path:path.join(screenshotDir,'round-clear.png'),fullPage:true});
        await advanceTime(page,60000);await page.locator('#next-round').click();
        await page.locator('#next-round').dispatchEvent('click');assert.equal(Number(await page.locator('#round-number').textContent()),round+1);
      }
    }
    const complete=(await records(page))[0];
    assert.equal(await view(page),'result');assert.equal((await records(page)).length,1);assert.equal(complete.reason,'complete');assert.equal(complete.completedRounds,50);
    assert.equal(complete.score,expectedScore);assert.equal(complete.bonus,expectedBonus);assert.equal(complete.matchedPairs,expectedPairs);assert.equal(complete.attempts,expectedPairs+1);assert.equal(complete.elapsedMs,85000);
    assert.equal(await page.locator('#final-score').textContent(),`${expectedScore.toLocaleString('ko-KR')}점`);
    pass('Rounds 1-49 show only clear notice, no records or scoreboard; round 50 saves exactly one cumulative game');
    pass('Exact all-round score/bonus/pairs/attempts sum and active time excluding intermissions');
    await page.locator('#show-ranking').click();assert.equal(await view(page),'ranking');assert.equal(await page.locator('#ranking-body tr').count(),1);assert.equal(await page.locator('#ranking-body b').count(),0);
    assert.equal(complete.nickname,'<b>민트</b>');assert.equal('age' in complete,false);assert.equal('gender' in complete,false);
    await page.screenshot({path:path.join(screenshotDir,'desktop-ranking.png'),fullPage:true});
    await page.locator('#back-result').click();await page.locator('#show-ranking').click();assert.equal((await records(page)).length,1);
    await page.locator('#continue-button').click();assert.equal(await page.locator('#round-number').textContent(),'01');assert.equal(await page.locator('#score-value').textContent(),'0');
    pass('Final total ranking, safe text, no duplicate save, new game resets to round 1 and zero');
    await solve(page);await page.locator('#next-round').click();await matchOne(page);await advanceTime(page,31000);
    await page.locator('.card:not(.is-matched)').first().click();assert.equal(await view(page),'result');
    let last=(await records(page)).find(r=>r.reason==='timeout');assert.equal(last.round,2);assert.equal(last.completedRounds,1);assert.equal(last.score,600);assert.equal(last.bonus,300);assert.equal(last.matchedPairs,3);assert.equal(last.elapsedMs,29000);
    pass('Timeout in round 2 includes completed round score plus current partial score, with no failure bonus');
    await restart(page);await solve(page);await page.locator('#next-round').click();await mismatch(page);
    await quit(page);assert.equal(await view(page),'result');last=(await records(page)).find(r=>r.reason==='quit');assert.equal(last.score,500);assert.equal(last.completedRounds,1);assert.equal(last.attempts,3);
    const count=(await records(page)).length;await page.locator('#play-panel .quit-button').dispatchEvent('click');await page.waitForTimeout(600);assert.equal((await records(page)).length,count);
    await page.locator('#show-ranking').click();await page.setViewportSize({width:320,height:900});await checkOverflow(page,'final totals scoreboard');
    assert.equal(await page.locator('#ranking-body tr:first-child td:nth-child(3)').evaluate(cell=>{
      const range=document.createRange();range.selectNodeContents(cell);
      const style=getComputedStyle(cell);
      return range.getClientRects().length===1 && range.getBoundingClientRect().width<=cell.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    }),true,'six-digit total fits on one line at 320px');
    await page.screenshot({path:path.join(screenshotDir,'mobile-ranking.png'),fullPage:true});
    await page.locator('#continue-button').click();await page.waitForTimeout(600);assert.equal(await page.locator('.is-open').count(),0);assert.equal(await page.locator('#attempts-value').textContent(),'0');
    pass('Quit during pending mismatch saves totals once, cancels callbacks, and resets new game');
    await solve(page);await advanceTime(page,120000);await quit(page);last=(await records(page)).find(r=>r.reason==='quit'&&r.round===1);
    assert.equal(last.score,500);assert.equal(last.elapsedMs,0);assert.equal(last.completedRounds,1);
    pass('Quit between rounds preserves credited score once and excludes waiting time');
    await restart(page);await quit(page);assert.equal(await page.locator('#final-score').textContent(),'0점');assert.equal(await page.locator('#final-progress').textContent(),'0 / 50라운드 완료 · 1라운드에서 종료');
    pass('Immediate quit produces valid zero-score game result');
    await page.locator('#result-panel .home-button').click();await page.locator('input[name="character"][value="female"]').check();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    assert.equal(await page.locator('#character-sprite').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.reload();assert.equal(await view(page),'ready');assert.equal(await page.locator('input[value="female"]').isChecked(),true);assert.equal(await page.locator('#nickname').inputValue(),'');
    pass('Responsive 320/375/768/1280px, 44px cards, reduced motion and settings restore unchanged');
    for (const mode of ['easy','hard']) {
      await page.locator('#difficulty').selectOption(mode);await start(page);await solve(page);await quit(page);
      const stored=await page.evaluate(mode=>CardFlipMatch.storage.rankings(mode),mode);
      assert.equal(stored.length,1);assert.equal(stored[0].difficulty,mode);
      await page.locator('#show-ranking').click();assert.equal(await page.locator('#ranking-body tr').count(),1);
      await page.locator('#ranking-panel .home-button').click();await page.reload();
      assert.equal(await page.locator('#difficulty').inputValue(),mode);
    }
    await page.locator('#difficulty').selectOption('normal');
    pass('Easy/hard gameplay, difficulty selection persistence and isolated ranking UI');
    await page.evaluate(()=>localStorage.setItem(CardFlipMatch.storage.key,'{broken'));await page.reload();await start(page);await quit(page);assert.equal(await view(page),'result');assert.equal(await page.locator('#notice').isVisible(),true);
    assert.deepEqual(errors,[]);await context.close();
    const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};});
    const p2=await blocked.newPage();await p2.goto(url);await start(p2);await solve(p2);assert.equal((await records(p2)).length,0);await quit(p2);await p2.locator('#show-ranking').click();assert.equal(await p2.locator('#ranking-body tr').count(),1);
    pass('Corrupt or denied storage: cumulative session results still work');await blocked.close();
    fs.writeFileSync(path.join(screenshotDir,'results.json'),JSON.stringify({url,passed:reports,date:new Date().toISOString()},null,2));
    console.log(`\n${reports.length} test groups passed. Screenshots: ${screenshotDir}`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
