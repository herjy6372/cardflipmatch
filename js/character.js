"use strict";
(() => {
  const C = window.CardFlipMatch;
  const sprite=document.getElementById("character-sprite");
  const fallback=document.getElementById("character-fallback");
  const speech=document.getElementById("character-message");
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const cache=new Map();
  let selected=C.storage.settings.character, motion="idle", token=0, paintId=0, timer=null, locked=false;
  const descriptions={idle:"대기",greeting:"인사",cheer:"응원",encourage:"격려",success:"성공 축하",fail:"실패 격려"};
  const messages={idle:"준비됐나요? 함께 짝을 찾아요!",greeting:"좋아요! 차근차근 기억해 봐요.",cheer:"짝을 찾았어요! 정말 멋져요.",encourage:"괜찮아요. 그 위치를 기억해요!",success:"해냈어요! 반짝이는 기억력이에요.",fail:"아깝지만 괜찮아요. 다시 도전해요!"};
  function load(path) {
    if (!cache.has(path)) cache.set(path,new Promise(resolve => {
      const image=new Image(); image.onload=() => resolve(true); image.onerror=() => resolve(false); image.src=path;
    }));
    return cache.get(path);
  }
  async function paint(currentToken, held=false) {
    const currentPaint=++paintId;
    const name=selected === "male" ? "남자 캐릭터" : "여자 캐릭터";
    document.getElementById("character-name").textContent=name;
    fallback.textContent=name;
    sprite.setAttribute("aria-label",`${name} ${descriptions[motion]}`);
    const base=`images/characters/${selected}/`;
    let isStatic=reduced.matches;
    let asset=motion==="idle"?C.config.characterAssets.idle:C.config.characterAssets.reactions;
    let path=base+(isStatic?asset.fallback:asset.file);
    if (!await load(path)) {
      path=base+asset.fallback; isStatic=true;
      if (!await load(path)) {
        path=base+"static-idle-v1.png"; asset=C.config.characterAssets.idle;
        if (!await load(path)) {
          if (currentToken !== token || currentPaint!==paintId) return;
          sprite.hidden=true; fallback.hidden=false; return;
        }
      }
    }
    if (currentToken !== token || currentPaint!==paintId) return;
    sprite.hidden=false; fallback.hidden=true;
    sprite.style.backgroundImage=`url("${path}")`;
    const row=asset.rows===1?0:asset.row[motion];
    const top=asset.rows===1?0:asset.bounds[selected][row];
    const frameHeight=asset.rows===1?asset.height:asset.bounds[selected][row+1]-top;
    sprite.style.backgroundSize=`${asset.cols*100}% ${asset.height/frameHeight*100}%`;
    sprite.style.aspectRatio=`${asset.width/asset.cols} / ${frameHeight}`;
    const endFrame=(held || isStatic) && ["success","fail"].includes(motion);
    sprite.style.backgroundPosition=`${endFrame?100:0}% ${asset.rows===1?0:top/(asset.height-frameHeight)*100}%`;
    sprite.style.animation="none";
    sprite.dataset.motion=motion;
    if (!isStatic && motion === "idle") sprite.style.animation="";
    else if (!isStatic && !held) {
      void sprite.offsetWidth;
      sprite.style.animation=`sprite-frames ${C.config.motions[motion].duration}ms steps(3, end) forwards`;
    }
  }
  function show(next, force=false) {
    if (!C.config.motions[next] || (locked && !force)) return;
    clearTimeout(timer); token++; motion=next;
    const localToken=token;
    if (["success","fail"].includes(next)) locked=true;
    speech.textContent=messages[next]; paint(localToken);
    if (next !== "idle") timer=setTimeout(() => {
      if (localToken !== token) return;
      if (C.config.motions[next].hold) paint(localToken,true);
      else show("idle",true);
    },C.config.motions[next].duration);
  }
  C.character={
    get selected() { return selected; },
    choose(value) {
      if (!["male","female"].includes(value)) return;
      selected=value; locked=false;
      if (!C.storage.saveSettings({character:value})) C.notify?.("캐릭터 설정은 이번 실행에서만 유지합니다.");
      show("greeting",true);
    },
    reset() { locked=false; show("idle",true); },
    show,
    preload() {
      for (const sex of ["male","female"]) for (const asset of Object.values(C.config.characterAssets)) {
        load(`images/characters/${sex}/${asset.file}`);
        load(`images/characters/${sex}/${asset.fallback}`);
      }
    }
  };
  reduced.addEventListener("change",() => paint(token,locked));
  const radio=document.querySelector(`input[name="character"][value="${selected}"]`);
  if (radio) radio.checked=true;
  show("idle",true);
})();
