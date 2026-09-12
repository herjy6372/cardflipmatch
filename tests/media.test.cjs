const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'.tools','test-results');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,bytes)=>{
    if(err){res.writeHead(404).end();return;}
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
    if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):bytes.length-1,bytes.length-1);if(start>end){res.writeHead(416).end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});res.end(bytes.subarray(start,end+1));}
    else{res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(bytes);}
  });
});
async function start(page){await page.locator('#nickname').fill('미디어검사');await page.locator('#age').selectOption('undisclosed');await page.locator('#gender').selectOption('female');await page.locator('#start-button').click();}
async function solve(page){await page.evaluate(()=>{const bs=[...document.querySelectorAll('.card')].sort((a,b)=>a.dataset.id.localeCompare(b.dataset.id));for(const b of bs)b.click();});}
const results=[];const pass=text=>{results.push(text);console.log('PASS '+text);};
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  const browser=await chromium.launch({headless:true,...(process.env.GAME_TEST_BROWSER?{executablePath:process.env.GAME_TEST_BROWSER}:{})});
  try{
    // Reuse the complete game suite on HTTP as well as file://.
    await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'game.test.cjs')],{env:{...process.env,GAME_TEST_URL:url},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`HTTP game tests failed: ${code}`)));});
    pass('Complete game suite also passes on local HTTP');
    const context=await browser.newContext({viewport:{width:1280,height:1000}});
    await context.addInitScript(()=>{
      const NativeAudio=window.Audio;window.__audios=[];
      window.Audio=function(...args){const a=new NativeAudio(...args);window.__audios.push(a);return a;};
      let hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
      window.__visibility=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
    });
    const p=await context.newPage();const errors=[],failed=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
    await p.goto(url);
    await p.waitForFunction(()=>__audios[0].readyState>=1);
    assert.equal(await p.evaluate(()=>__audios[0].paused),true);
    assert.ok(await p.evaluate(()=>__audios[0].duration>=179&&__audios[0].duration<=181));
    await start(p);await p.waitForFunction(()=>!__audios[0].paused);
    assert.equal(await p.evaluate(()=>__audios.length),6);
    assert.equal(await p.evaluate(()=>__audios[0].loop),true);
    await p.evaluate(()=>{__audios[0].currentTime=40;});
    await solve(p);assert.equal(await p.locator('body').getAttribute('data-view'),'round-clear');assert.ok(await p.evaluate(()=>__audios[0].currentTime>=40));
    await p.locator('#next-round').click();assert.equal(await p.evaluate(()=>__audios.length),6);assert.ok(await p.evaluate(()=>__audios[0].currentTime>=40));
    pass('Native MP3 duration, no initial autoplay, singleton BGM and continuous round-clear playback');
    await p.locator('#bgm-toggle').click();assert.equal(await p.evaluate(()=>__audios[0].paused&&__audios[0].muted),true);
    assert.equal(await p.evaluate(()=>__audios[1].muted),false);
    await p.locator('#bgm-toggle').click();await p.waitForFunction(()=>!__audios[0].paused);
    await p.locator('#sfx-toggle').click();assert.equal(await p.evaluate(()=>__audios[1].muted),true);assert.equal(await p.evaluate(()=>__audios[0].muted),false);
    await p.evaluate(()=>{__visibility(true);});assert.equal(await p.evaluate(()=>__audios[0].paused),true);
    await p.evaluate(()=>{const t=Date.now();Date.now=()=>t+40000;__visibility(false);});
    assert.equal(await p.locator('body').getAttribute('data-view'),'result');
    await p.waitForFunction(()=>!__audios[0].paused);
    pass('Independent mute, hidden tab pauses music only, return recalculates timeout before playback');
    await p.locator('#result-panel .home-button').click();
    assert.equal(await p.evaluate(()=>__audios[0].paused&&__audios[0].currentTime===0),true);
    await p.evaluate(()=>{__visibility(true);__visibility(false);});assert.equal(await p.evaluate(()=>__audios[0].paused),true);
    await p.locator('input[name="character"][value="female"]').check();
    await p.locator('#bgm-toggle').click();
    await p.reload();assert.equal(await p.locator('input[value="female"]').isChecked(),true);
    pass('Home resets BGM; READY visibility does not autoplay; audio settings preserve character choice');
    await p.locator('#bgm-toggle').click();
    await p.evaluate(()=>{window.__realPlay=__audios[0].play.bind(__audios[0]);__audios[0].play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));});
    await start(p);await p.locator('#audio-retry').waitFor({state:'visible'});
    assert.equal(await p.locator('body').getAttribute('data-view'),'play');
    await p.evaluate(()=>{__audios[0].play=window.__realPlay;});await p.locator('#audio-retry').click();await p.waitForFunction(()=>!__audios[0].paused);
    pass('Autoplay rejection keeps game playable and manual retry works');
    // Check each configured row and holding/static poses for both characters.
    for(const sex of ['male','female']){
      await p.evaluate(sex=>{CardFlipMatch.character.choose(sex);CardFlipMatch.character.reset();},sex);
      for(const motion of ['idle','greeting','cheer','encourage','success','fail']){
        await p.evaluate(m=>{CardFlipMatch.character.reset();CardFlipMatch.character.show(m,true);},motion);
        await p.waitForFunction(m=>document.getElementById('character-sprite').dataset.motion===m,motion);
        await p.locator('#character-sprite').screenshot({path:path.join(out,`${sex}-${motion}.png`),animations:'disabled'});
        assert.equal(await p.locator('#character-fallback').isHidden(),true);
      }
    }
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.evaluate(()=>CardFlipMatch.character.show('success',true));
    await p.waitForFunction(()=>document.getElementById('character-sprite').style.backgroundImage.includes('static-poses'));
    assert.equal(await p.locator('#character-sprite').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await p.locator('#character-sprite').evaluate(el=>el.style.backgroundPositionX),'100%');
    pass('Both character sets: all 6 motions, static success pose and reduced motion');
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await context.close();
    const fallbacks=await browser.newContext();
    await fallbacks.route('**/images/characters/*/reactions-v1.png',r=>r.abort());
    const fp=await fallbacks.newPage();await fp.goto(url);await start(fp);
    await fp.waitForFunction(()=>document.getElementById('character-sprite').style.backgroundImage.includes('static-poses'));
    assert.equal(await fp.locator('body').getAttribute('data-view'),'play');
    await fallbacks.close();pass('Missing animated sheet uses independent static pose sheet');
    const missing=await browser.newContext();
    await missing.route('**/images/**',r=>r.abort());await missing.route('**/sounds/**',r=>r.abort());
    const mp=await missing.newPage();const missingErrors=[];mp.on('pageerror',e=>missingErrors.push(e.message));
    await mp.goto(url);await mp.locator('#character-fallback').waitFor({state:'visible'});await start(mp);await solve(mp);assert.equal(await mp.locator('body').getAttribute('data-view'),'round-clear');await mp.locator('#round-clear-panel .quit-button').click();assert.equal(await mp.locator('body').getAttribute('data-view'),'result');assert.deepEqual(missingErrors,[]);
    pass('All images and audio missing: name fallback and complete gameplay remain available');await missing.close();
    // Last-pair boundary: a selection at zero must fail; a selection with time left succeeds.
    for(const remaining of [1,0]){
      const c=await browser.newContext();const q=await c.newPage();await q.goto(url);
      await q.evaluate(()=>{window.__fixedTime=100000;Date.now=()=>window.__fixedTime;});await start(q);
      await q.evaluate(left=>{
        const bs=[...document.querySelectorAll('.card')].sort((a,b)=>a.dataset.id.localeCompare(b.dataset.id));
        bs[0].click();bs[1].click();bs[2].click();window.__fixedTime=130000-left;bs[3].click();
      },remaining);
      let stored=await q.evaluate(()=>CardFlipMatch.storage.rankings());
      if(remaining){assert.equal(stored.length,0);assert.equal(await q.locator('body').getAttribute('data-view'),'round-clear');await q.locator('#round-clear-panel .quit-button').click();stored=await q.evaluate(()=>CardFlipMatch.storage.rankings());}
      assert.equal(stored.length,1);assert.equal(stored[0].reason,remaining?'quit':'timeout');
      assert.equal(stored[0].score,remaining?200:100);await c.close();
    }
    pass('Last pair at 1ms clears round without scoreboard; at 0ms ends game once');
    fs.writeFileSync(path.join(out,'media-results.json'),JSON.stringify({passed:results,date:new Date().toISOString()},null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
