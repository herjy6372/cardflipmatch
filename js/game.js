"use strict";
(() => {
  const C=window.CardFlipMatch;
  const $=id=>document.getElementById(id);
  const panels=["ready","play","round-clear","result","ranking"];
  let state="READY", round=1, cfg=C.config.roundConfig(1), cards=[], selected=[];
  let isResolving=false, isPreparing=false, timer=null, flipTimer=null, gameId=0;
  let score=0, attempts=0, matchedPairs=0, startedAt=0, deadlineAt=0, finalResult=null;
  let profile=null, warned=false;
  let totals=null, roundSettled=false;
  function resetRun() {
    totals={score:0,bonus:0,attempts:0,matchedPairs:0,elapsedMs:0,completedRounds:0};
    finalResult=null;
  }
  const elements=new Map();
  C.notify=message=>{ $("notice").textContent=message; $("notice").hidden=false; };
  function announce(message) { $("announcement").textContent=message; }
  function view(name,focusId) {
    if (name!=="ranking") C.cloud.stopWatching();
    panels.forEach(panel=>{ $(`${panel}-panel`).hidden=panel!==name; });
    $("layout").classList.toggle("is-active",name!=="ready");
    document.body.dataset.view=name;
    if (focusId) $(focusId).focus();
  }
  function cleanup() {
    clearInterval(timer); clearTimeout(flipTimer); timer=null; flipTimer=null;
    gameId++; selected=[]; isResolving=false;
    C.audio.stopEffects();
  }
  function remaining(now=Date.now()) { return Math.max(0,Math.min(cfg.seconds*1000,deadlineAt-now)); }
  function updateStats(now=Date.now()) {
    const ms=remaining(now),seconds=Math.ceil(ms/1000);
    $("time-value").replaceChildren(document.createTextNode(String(seconds)),Object.assign(document.createElement("small"),{textContent:"초"}));
    $("pairs-value").textContent=cfg.pairs-matchedPairs;
    $("score-value").textContent=((totals?.score || 0)+(roundSettled?0:score)).toLocaleString("ko-KR");
    $("attempts-value").textContent=attempts;
    $("time-bar").style.width=`${ms/(cfg.seconds*1000)*100}%`;
    const urgent=seconds<=C.config.warningSeconds;
    $("time-stat").classList.toggle("urgent",urgent);
    $("time-warning").hidden=!urgent;
    if (urgent && !warned && state==="PLAYING") { warned=true; announce("남은 시간이 10초 이하입니다."); }
  }
  function refreshCard(card,index) {
    const button=elements.get(card.id);
    button.classList.toggle("is-open",card.isFlipped || card.isMatched);
    button.classList.toggle("is-matched",card.isMatched);
    const exposed=card.isFlipped || card.isMatched;
    button.setAttribute("aria-label",`${index+1}번 카드, ${exposed?card.name+", ":""}${card.isMatched?"짝 찾음":exposed?"열림":"닫힘"}`);
    button.setAttribute("aria-disabled",String(state!=="PLAYING" || card.isMatched || card.isFlipped || isResolving));
    // The concealed face is never exposed in accessible text or a title attribute.
    button.querySelector(".card-front").textContent=exposed?card.emoji:"";
  }
  function refreshBoard() { cards.forEach(refreshCard); }
  function renderBoard() {
    const board=$("board"); board.replaceChildren(); elements.clear();
    board.style.setProperty("--cols",cfg.cols);
    board.style.setProperty("--tablet-cols",Math.min(cfg.cols,6));
    board.style.setProperty("--mobile-cols",Math.min(cfg.cols,4));
    board.dataset.count=String(cfg.count);
    const fragment=document.createDocumentFragment();
    for (const card of cards) {
      const button=document.createElement("button"); button.type="button"; button.className="card"; button.dataset.id=card.id;
      const inner=document.createElement("span"); inner.className="card-inner"; inner.setAttribute("aria-hidden","true");
      const back=document.createElement("span"); back.className="card-face card-back"; back.textContent="✿";
      const front=document.createElement("span"); front.className="card-face card-front";
      inner.append(back,front); button.append(inner); elements.set(card.id,button); fragment.append(button);
    }
    board.append(fragment); refreshBoard();
  }
  function startRound(nextRound,resetMusic=false) {
    if (isPreparing || state==="PLAYING" || !profile) return;
    isPreparing=true; $("start-button").disabled=true;
    try {
      const nextConfig=C.config.roundConfig(nextRound,profile.difficulty),nextCards=C.config.createCards(nextRound,profile.difficulty);
      cleanup(); state="READY"; cfg=nextConfig; round=nextRound; cards=nextCards;
      score=0; attempts=0; matchedPairs=0; finalResult=null; warned=false; roundSettled=false;
      C.character.reset();
      $("round-number").textContent=String(round).padStart(2,"0");
      $("player-greeting").textContent=`${profile.nickname}님 · ${C.config.difficulties[profile.difficulty].label} · ${cfg.pairs}쌍의 그림을 찾아 주세요.`;
      renderBoard();
      startedAt=Date.now(); deadlineAt=startedAt+cfg.seconds*1000; state="PLAYING";
      refreshBoard(); updateStats(startedAt); view("play","round-heading");
      C.character.show("greeting"); C.audio.start(resetMusic);
      const currentGame=gameId;
      timer=setInterval(()=>{ if (currentGame===gameId) tick(); },100);
      announce(`${round}라운드 시작. ${cfg.count}장, ${cfg.seconds}초입니다.`);
    } catch (error) {
      cleanup(); state="READY"; C.audio.stop(); C.character.reset(); view("ready","setup-title");
      C.notify(error instanceof Error?error.message:"게임을 준비하지 못했습니다. 다시 시작해 주세요.");
    } finally { isPreparing=false; $("start-button").disabled=false; }
  }
  function tick() {
    if (state!=="PLAYING") return;
    const now=Date.now(); updateStats(now);
    if (remaining(now)<=0) finish("timeout",now);
  }
  function selectCard(id) {
    if (state!=="PLAYING") return;
    const now=Date.now();
    if (remaining(now)<=0) { finish("timeout",now); return; }
    if (isResolving || isPreparing) return;
    const card=cards.find(item=>item.id===id);
    if (!card || card.isFlipped || card.isMatched) return;
    card.isFlipped=true; selected.push(card.id); C.audio.play("flip");
    if (selected.length<2) { refreshBoard(); return; }
    attempts++; isResolving=true;
    const first=cards.find(item=>item.id===selected[0]);
    if (first.pairId===card.pairId) {
      first.isMatched=true; card.isMatched=true; matchedPairs++; score+=C.config.matchPoints;
      selected=[]; isResolving=false; refreshBoard(); updateStats(now);
      if (matchedPairs===cfg.pairs) {
        if (round===50) finish("complete",now);
        else clearRound(now);
      }
      else { C.audio.play("match"); C.character.show("cheer"); announce(`짝을 찾았습니다. 남은 쌍 ${cfg.pairs-matchedPairs}개.`); }
    } else {
      refreshBoard(); updateStats(now); C.audio.play("mismatch"); C.character.show("encourage");
      const currentGame=gameId;
      flipTimer=setTimeout(()=>{
        if (currentGame!==gameId || state!=="PLAYING") return;
        if (remaining()<=0) { finish("timeout",Date.now()); return; }
        first.isFlipped=false; card.isFlipped=false; selected=[]; isResolving=false; flipTimer=null; refreshBoard();
      },C.config.flipBackMs);
    }
  }
  function settleRound(now,completed) {
    if (roundSettled) return;
    roundSettled=true;
    const bonus=completed?Math.floor(remaining(now)/1000)*C.config.bonusPerSecond:0;
    totals.score+=score+bonus;
    totals.bonus+=bonus;
    totals.attempts+=attempts;
    totals.matchedPairs+=matchedPairs;
    totals.elapsedMs+=Math.min(cfg.seconds*1000,Math.max(0,now-startedAt));
    if (completed) totals.completedRounds++;
  }
  function clearRound(now) {
    if (state!=="PLAYING" || round>=50) return;
    state="ROUND_CLEAR";
    settleRound(now,true); cleanup(); refreshBoard(); updateStats(now);
    C.character.show("success",true); C.audio.play("success");
    $("round-clear-title").textContent=`${round}라운드 완료!`;
    $("round-clear-description").textContent=`모든 짝을 찾았어요. ${round+1}라운드에 도전해 볼까요?`;
    $("next-round").textContent=`${round+1}라운드 시작 →`;
    view("round-clear","round-clear-title"); announce(`${round}라운드 완료!`);
  }
  function finish(reason,now) {
    if (state!=="PLAYING" && !(state==="ROUND_CLEAR" && reason==="quit")) return;
    if (!["timeout","complete","quit"].includes(reason)) return;
    state="GAME_OVER";
    settleRound(now,reason==="complete");
    const id=typeof crypto.randomUUID==="function"?crypto.randomUUID():`${now}-${gameId}-${Math.random().toString(36).slice(2)}`;
    finalResult=Object.freeze({id,nickname:profile.nickname,difficulty:profile.difficulty,version:C.config.version,scoringVersion:C.config.scoringVersion,round,reason,...totals,createdAt:now});
    cleanup(); refreshBoard(); updateStats(now);
    const saved=C.storage.addRecord(finalResult);
    void C.cloud.sync();
    if (!saved) C.notify("기록을 저장할 수 없습니다. 순위는 이번 실행에서만 유지돼요.");
    C.character.show(reason==="complete"?"success":"fail",true);
    C.audio.play(reason==="complete"?"success":"fail");
    $("result-title").textContent=reason==="timeout"?"시간이 다 됐어요!":reason==="complete"?"50라운드, 모두 완성!":"이번 도전을 마쳤어요";
    $("result-symbol").textContent=reason==="complete"?"✦":"☁";
    $("result-description").textContent=`${profile.nickname}님의 게임이 ${reason==="timeout"?"시간 초과로":reason==="quit"?"포기로":"50라운드 전체 완료로"} 종료되었어요.`;
    $("final-score").textContent=`${finalResult.score.toLocaleString("ko-KR")}점`;
    $("bonus-detail").textContent=`누적 짝 점수 ${finalResult.matchedPairs*100} + 누적 시간 보너스 ${finalResult.bonus}`;
    $("final-progress").textContent=`${finalResult.completedRounds} / 50라운드 완료 · ${round}라운드에서 종료`;
    $("final-time").textContent=`${(finalResult.elapsedMs/1000).toFixed(2)}초`;
    $("final-attempts").textContent=`${finalResult.attempts}회`;
    $("final-pairs").textContent=`${finalResult.matchedPairs}쌍`;
    view("result","result-title"); announce($("result-title").textContent);
  }
  function showRankings() {
    if (state!=="GAME_OVER" || !finalResult) return;
    renderRankings(C.storage.rankings(profile.difficulty),false);
    view("ranking","ranking-title");
    C.cloud.watch(profile.difficulty,entries=>renderRankings(entries,true),()=>renderRankings(C.storage.rankings(profile.difficulty),false));
  }
  function renderRankings(entries,online) {
    if (state!=="GAME_OVER" || !finalResult) return;
    const mine=entries.find(r=>r.id===finalResult.id);
    $("ranking-round").textContent=`${C.config.difficulties[profile.difficulty].label} · 전체 총점`;
    $("ranking-source").textContent=online?"ONLINE LEADERBOARD":"LOCAL LEADERBOARD";
    $("ranking-description").textContent=online?"공유 순위표의 상위 100개 기록이에요. 같은 난이도끼리 비교하며 실시간으로 갱신돼요.":"이 브라우저에 저장된 최근 500개 게임 중 같은 난이도의 기록이에요.";
    $("my-rank").textContent=mine?`${profile.nickname}님은 ${online?"온라인":"로컬"} ${mine.rank}위예요!`:online?"이번 기록이 동기화 중이거나 온라인 상위 100개 기록에 포함되지 않았어요.":"이번 도전의 순위를 확인해 보세요.";
    const body=$("ranking-body"); body.replaceChildren();
    $("ranking-empty").hidden=entries.length!==0;
    for (const entry of entries) {
      const row=document.createElement("tr");
      if (entry.id===finalResult.id) { row.className="current-record"; row.setAttribute("aria-current","true"); }
      const rankCell=document.createElement("td"); rankCell.textContent=String(entry.rank);
      const nameCell=document.createElement("td"); nameCell.textContent=entry.nickname;
      const resultLabel=document.createElement("small"); resultLabel.textContent=`${entry.reason==="timeout"?"시간 초과":entry.reason==="quit"?"포기":"전체 완료"} · ${entry.completedRounds}라운드 완료${entry.id===finalResult.id?" · 이번 기록":""}`; nameCell.append(resultLabel);
      const scoreCell=document.createElement("td"); scoreCell.textContent=entry.score.toLocaleString("ko-KR");
      const timeCell=document.createElement("td"); timeCell.textContent=`${(entry.elapsedMs/1000).toFixed(2)}초`;
      const attemptLabel=document.createElement("small"); attemptLabel.textContent=`${entry.attempts}회`; timeCell.append(attemptLabel);
      row.append(rankCell,nameCell,scoreCell,timeCell); body.append(row);
    }
    $("continue-button").textContent="1라운드부터 새 게임 →";
  }
  function home() {
    if (state==="PLAYING" || state==="ROUND_CLEAR") return;
    cleanup(); state="READY"; isPreparing=false; finalResult=null; round=1; cards=[]; elements.clear(); $("board").replaceChildren();
    C.audio.stop(); C.character.reset(); view("ready","setup-title");
  }
  for (let age=1;age<=120;age++) $("age").append(new Option(`${age}세`,String(age)));
  $("nickname").addEventListener("input",()=>$("nickname").setCustomValidity(""));
  $("profile-form").addEventListener("submit",event=>{
    event.preventDefault(); if (state!=="READY" || isPreparing) return;
    const nickname=$("nickname").value.trim();
    if (!C.storage.validName(nickname)) { $("nickname").setCustomValidity("공백만 있는 별명은 사용할 수 없어요. 1~12자로 입력해 주세요."); $("nickname").reportValidity(); return; }
    if (!$("profile-form").reportValidity()) return;
    const age=$("age").value,gender=$("gender").value;
    if (!(age==="undisclosed" || (Number.isInteger(Number(age)) && Number(age)>=1 && Number(age)<=120)) || !["male","female","other","undisclosed"].includes(gender)) return;
    const difficulty=$("difficulty").value;
    if (!Object.hasOwn(C.config.difficulties,difficulty)) return;
    C.storage.saveSettings({difficulty});
    profile={nickname,age:age==="undisclosed"?null:Number(age),gender,difficulty};
    $("nickname").value=nickname; resetRun(); startRound(1,true);
  });
  document.querySelectorAll('input[name="character"]').forEach(input=>input.addEventListener("change",()=>{ if (state==="READY" && !isPreparing) C.character.choose(input.value); }));
  $("board").addEventListener("click",event=>{ const button=event.target.closest("button.card"); if (button && $("board").contains(button)) selectCard(button.dataset.id); });
  document.querySelectorAll(".home-button").forEach(button=>button.addEventListener("click",home));
  document.querySelectorAll(".quit-button").forEach(button=>button.addEventListener("click",()=>{
    if (state!=="PLAYING" && state!=="ROUND_CLEAR") return;
    const now=Date.now();
    finish(state==="PLAYING" && remaining(now)<=0?"timeout":"quit",now);
  }));
  $("next-round").addEventListener("click",()=>{
    if (state==="ROUND_CLEAR" && round<50 && !isPreparing) startRound(round+1);
  });
  $("show-ranking").addEventListener("click",showRankings);
  $("back-result").addEventListener("click",()=>{ if(state==="GAME_OVER") view("result","result-title"); });
  $("continue-button").addEventListener("click",()=>{
    if (state!=="GAME_OVER" || !finalResult) return;
    resetRun(); startRound(1,true);
  });
  document.addEventListener("visibilitychange",()=>{ if (!document.hidden) tick(); C.audio.visibility(); });
  window.addEventListener("pagehide",()=>C.audio.stop());
  if (!C.storage.available) C.notify("저장된 기록을 읽을 수 없어 기본 설정으로 시작합니다. 게임은 계속할 수 있어요.");
  $("difficulty").value=C.storage.settings.difficulty;
  function previewDifficulty() {
    const config=C.config.roundConfig(1,$("difficulty").value);
    $("difficulty-preview").textContent=`1라운드 · ${config.count}장 · ${config.seconds}초`;
  }
  $("difficulty").addEventListener("change",previewDifficulty); previewDifficulty();
  C.cloud.subscribe(status=>{ $("sync-status").textContent=status; $("sync-retry").hidden=!C.cloud.enabled; });
  $("sync-retry").addEventListener("click",async()=>{
    $("sync-retry").disabled=true;
    try { await C.cloud.sync(); if (document.body.dataset.view==="ranking") showRankings(); }
    finally { $("sync-retry").disabled=false; }
  });
  C.character.preload(); view("ready"); void C.cloud.sync();
})();
