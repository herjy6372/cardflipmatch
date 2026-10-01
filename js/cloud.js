"use strict";
(() => {
  const C=window.CardFlipMatch, settings=C.firebaseSettings;
  let backend=null, initializing=null, syncing=null, unsubscribe=null, watchGeneration=0;
  let status=settings.enabled?"연결 준비 중":"로컬 모드 · Firebase 미설정";
  const subscribers=new Set();
  function publish(message) { status=message; subscribers.forEach(fn=>fn(status)); }
  function describe(error) {
    if (error?.code==="permission-denied") return "Firebase 규칙과 익명 로그인 설정을 확인해 주세요.";
    if (error?.code==="failed-precondition") return "Firestore 색인 설정을 확인해 주세요.";
    return "연결을 확인한 뒤 다시 동기화해 주세요.";
  }
  async function initialize() {
    if (!settings.enabled) return null;
    if (backend) return backend;
    if (initializing) return initializing;
    initializing=(async()=>{
      if (!/^https?:$/.test(location.protocol)) throw new Error("Firebase 동기화는 HTTP/HTTPS 주소에서 실행해 주세요.");
      if (!["apiKey","authDomain","projectId","appId"].every(k=>typeof settings.firebaseConfig[k]==="string" && settings.firebaseConfig[k].trim())) throw new Error("firebase-config.js의 웹 앱 설정을 입력해 주세요.");
      const [appSDK,authSDK,dbSDK]=await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
      ]);
      const app=appSDK.initializeApp(settings.firebaseConfig), auth=authSDK.getAuth(app);
      await auth.authStateReady();
      if (!auth.currentUser) await authSDK.signInAnonymously(auth);
      backend={sdk:dbSDK,db:dbSDK.getFirestore(app),uid:auth.currentUser.uid};
      return backend;
    })();
    try { return await initializing; } finally { initializing=null; }
  }
  function sync() {
    if (!settings.enabled) return Promise.resolve(false);
    if (syncing) return syncing;
    syncing=(async()=>{
      try {
        const b=await initialize();
        publish("순위 동기화 중…");
        // Same document id + transaction makes a retry safe after an uncertain response.
        while (C.storage.pending().length) {
          const record=C.storage.pending()[0];
          const ref=b.sdk.doc(b.db,"leaderboards",`${record.version}_${record.scoringVersion}_${record.difficulty}`,"records",`${b.uid}_${record.id}`);
          await b.sdk.runTransaction(b.db,async tx=>{
            const existing=await tx.get(ref);
            if (!existing.exists()) tx.set(ref,{...C.storage.cleanRecord(record),uid:b.uid,submittedAt:b.sdk.serverTimestamp()});
          });
          C.storage.markSynced(record.id);
        }
        publish("Firebase 동기화 완료"); return true;
      } catch(error) {
        publish(`로컬 기록 보관 중 · ${error?.message && !error.code?error.message:describe(error)}`);
        return false;
      }
    })().finally(()=>{syncing=null;});
    return syncing;
  }
  function stopWatching() { watchGeneration++; if (unsubscribe) unsubscribe(); unsubscribe=null; }
  async function watch(difficulty,onRecords,onFailure) {
    stopWatching(); const generation=watchGeneration;
    if (!settings.enabled) { onFailure(); return; }
    try {
      const b=await initialize();
      if (generation!==watchGeneration) return;
      const collection=b.sdk.collection(b.db,"leaderboards",`${C.config.version}_${C.config.scoringVersion}_${difficulty}`,"records");
      const query=b.sdk.query(collection,b.sdk.orderBy("score","desc"),b.sdk.orderBy("completedRounds","desc"),b.sdk.orderBy("elapsedMs","asc"),b.sdk.orderBy("attempts","asc"),b.sdk.orderBy("createdAt","asc"),b.sdk.limit(100));
      unsubscribe=b.sdk.onSnapshot(query,snapshot=>{
        if (generation!==watchGeneration) return;
        const records=snapshot.docs.map(doc=>doc.data()).filter(C.storage.validateRecord);
        onRecords(C.storage.rankings(difficulty,records));
      },error=>{
        if (generation!==watchGeneration) return;
        publish(`온라인 순위 연결 실패 · ${describe(error)}`); onFailure();
      });
    } catch(error) {
      if (generation!==watchGeneration) return;
      publish(`온라인 순위 연결 실패 · ${error?.code?describe(error):error.message}`); onFailure();
    }
  }
  C.cloud={get enabled(){return settings.enabled;},get status(){return status;},sync,watch,stopWatching,
    subscribe(fn){subscribers.add(fn);fn(status);return ()=>subscribers.delete(fn);}};
  window.addEventListener("online",()=>sync());
  window.addEventListener("pagehide",stopWatching);
})();
