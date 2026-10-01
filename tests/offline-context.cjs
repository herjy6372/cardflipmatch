// Regression suites must never send synthetic game records to the live leaderboard.
module.exports=async function offlineContext(browser,options) {
  const context=await browser.newContext(options);
  await context.addInitScript(()=>{
    window.CardFlipMatch={};
    let offlineSettings={enabled:false,firebaseConfig:{}};
    Object.defineProperty(window.CardFlipMatch,'firebaseSettings',{
      get(){return offlineSettings;},
      set(settings){offlineSettings={...settings,enabled:false};}
    });
  });
  return context;
};
