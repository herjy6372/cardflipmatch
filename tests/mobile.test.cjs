const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const offlineContext=require('./offline-context.cjs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.GAME_TEST_BROWSER});
  try {
    const context=await offlineContext(browser,{viewport:{width:375,height:812},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.locator('#nickname').fill('터치검사');
    await page.locator('#age').selectOption('undisclosed');await page.locator('#gender').selectOption('undisclosed');
    assert.ok(await page.locator('#nickname').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
    await page.locator('#start-button').tap();
    const ids=await page.locator('.card').evaluateAll(items=>items.map(e=>e.dataset.id).sort());
    await page.locator(`[data-id="${ids[0]}"]`).tap();await page.locator(`[data-id="${ids[1]}"]`).tap();
    assert.equal(await page.locator('.is-matched').count(),2);
    await page.setViewportSize({width:812,height:375});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator(`[data-id="${ids[2]}"]`).tap();await page.locator(`[data-id="${ids[3]}"]`).tap();
    assert.equal(await page.locator('body').getAttribute('data-view'),'round-clear');
    await page.locator('#round-clear-panel .quit-button').tap();await page.locator('#show-ranking').tap();
    assert.equal(await page.locator('#ranking-body tr').count(),1);
    assert.equal(await page.locator('#ranking-empty').isVisible(),false);
    await page.evaluate(()=>{CardFlipMatch.cloud.watch=(mode,success)=>success([]);});
    await page.locator('#back-result').tap();await page.locator('#show-ranking').tap();
    assert.equal(await page.locator('#ranking-empty').isVisible(),true);
    await page.setViewportSize({width:320,height:740});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log('PASS touch input, orientation change during play, mobile input size, 320px empty online ranking and populated local ranking');
    await context.close();
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
