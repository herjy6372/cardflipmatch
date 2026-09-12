"use strict";
(() => {
  const C = window.CardFlipMatch;
  const bgm = new Audio("sounds/bgm/background.mp3");
  bgm.loop = true; bgm.preload = "metadata";
  let enabled = false;
  let settings = C.storage.settings;
  const effects = new Map();
  for (const name of ["flip","match","mismatch","success","fail"]) {
    const audio = new Audio(`sounds/${name}.mp3`); audio.preload="auto"; effects.set(name,audio);
  }
  const retry = document.getElementById("audio-retry");
  function reportUnavailable() { retry.hidden = !enabled || settings.bgmMuted; }
  function requestPlay() {
    if (!enabled || document.hidden || settings.bgmMuted || settings.bgmVolume === 0) return;
    try {
      const request = bgm.play();
      if (request) request.then(() => { retry.hidden=true; if (!enabled || document.hidden || settings.bgmMuted) bgm.pause(); }).catch(reportUnavailable);
    } catch { reportUnavailable(); }
  }
  function sync() {
    bgm.volume=settings.bgmVolume; bgm.muted=settings.bgmMuted;
    for (const [kind,label] of [["bgm","배경음"],["sfx","효과음"]]) {
      const muted=settings[`${kind}Muted`];
      const button=document.getElementById(`${kind}-toggle`);
      button.textContent=`${label} ${muted?"꺼짐":"켜짐"}`;
      button.setAttribute("aria-pressed",String(muted));
      document.getElementById(`${kind}-volume`).value=String(Math.round(settings[`${kind}Volume`]*100));
      document.getElementById(`${kind}-output`).value=`${Math.round(settings[`${kind}Volume`]*100)}%`;
    }
    for (const audio of effects.values()) { audio.volume=settings.sfxVolume; audio.muted=settings.sfxMuted; }
  }
  function save() {
    const {bgmMuted,bgmVolume,sfxMuted,sfxVolume}=settings;
    if (!C.storage.saveSettings({bgmMuted,bgmVolume,sfxMuted,sfxVolume})) C.notify?.("설정을 저장할 수 없어 이번 실행에서만 유지합니다.");
  }
  for (const kind of ["bgm","sfx"]) {
    document.getElementById(`${kind}-toggle`).addEventListener("click",() => {
      settings[`${kind}Muted`]=!settings[`${kind}Muted`]; sync(); save();
      if (kind === "bgm") { if (settings.bgmMuted) { bgm.pause(); retry.hidden=true; } else requestPlay(); }
    });
    document.getElementById(`${kind}-volume`).addEventListener("input",event => {
      settings[`${kind}Volume`]=Number(event.target.value)/100; sync();
      if (kind === "bgm") { if (!settings.bgmVolume) bgm.pause(); else requestPlay(); }
    });
    document.getElementById(`${kind}-volume`).addEventListener("change",save);
  }
  retry.addEventListener("click",requestPlay);
  bgm.addEventListener("error",reportUnavailable);
  sync();
  C.audio = {
    start(reset=false) { enabled=true; if (reset) { bgm.pause(); try { bgm.currentTime=0; } catch {} } requestPlay(); },
    stop() { enabled=false; bgm.pause(); try { bgm.currentTime=0; } catch {} retry.hidden=true; this.stopEffects(); },
    stopEffects() { for (const audio of effects.values()) { audio.pause(); try { audio.currentTime=0; } catch {} } },
    visibility() { if (document.hidden) { bgm.pause(); this.stopEffects(); } else requestPlay(); },
    play(name) {
      if (!enabled || settings.sfxMuted || document.hidden) return;
      const audio=effects.get(name); if (!audio) return;
      try { audio.currentTime=0; const p=audio.play(); if (p) p.catch(() => {}); } catch {}
    }
  };
})();
