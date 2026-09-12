"use strict";
(() => {
  const C = window.CardFlipMatch;
  const key = "cardFlipMatch:v3";
  const defaults = { character:"male",bgmMuted:false,bgmVolume:0.3,sfxMuted:false,sfxVolume:0.7 };
  let data = { schema:3, records:[], settings:{...defaults} };
  let available = true;
  const isNumber = (value,min,max) => Number.isFinite(value) && value >= min && value <= max;
  const validName = name => typeof name === "string" && name.trim().length >= 1 && name.length <= 12 && !/[\u0000-\u001f\u007f]/u.test(name);
  function validateRecord(r) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || r.id.length > 100 || !r.id || !validName(r.nickname) || r.version !== C.config.version || r.scoringVersion !== C.config.scoringVersion || !Number.isInteger(r.round) || r.round < 1 || r.round > 50 || !["timeout","complete","quit"].includes(r.reason) || !Number.isInteger(r.completedRounds)) return false;
    if (r.reason==="complete" ? r.round!==50 || r.completedRounds!==50 : r.reason==="timeout" ? r.completedRounds!==r.round-1 : ![r.round-1,r.round].includes(r.completedRounds) || r.completedRounds===50) return false;
    let maxPairs=0,completedPairs=0,maxTime=0,maxBonus=0;
    for (let round=1;round<=r.round;round++) {
      const cfg=C.config.roundConfig(round); maxPairs+=cfg.pairs; maxTime+=cfg.seconds*1000;
      if (round<=r.completedRounds) { completedPairs+=cfg.pairs; maxBonus+=cfg.seconds*C.config.bonusPerSecond; }
    }
    return Number.isInteger(r.bonus) && isNumber(r.bonus,0,maxBonus) && r.bonus%C.config.bonusPerSecond===0 && Number.isInteger(r.matchedPairs) && isNumber(r.matchedPairs,completedPairs,maxPairs) && (r.completedRounds===r.round?r.matchedPairs===maxPairs:r.matchedPairs<maxPairs) && Number.isInteger(r.score) && r.score===r.matchedPairs*C.config.matchPoints+r.bonus && isNumber(r.elapsedMs,0,maxTime) && Number.isInteger(r.attempts) && isNumber(r.attempts,r.matchedPairs,5000000) && isNumber(r.createdAt,0,Number.MAX_SAFE_INTEGER);
  }
  function cleanRecord(r) {
    // Persist only ranking fields. Age and gender never enter storage.
    return {id:r.id,nickname:r.nickname.trim(),version:r.version,scoringVersion:r.scoringVersion,round:r.round,completedRounds:r.completedRounds,reason:r.reason,score:r.score,bonus:r.bonus,elapsedMs:r.elapsedMs,attempts:r.attempts,matchedPairs:r.matchedPairs,createdAt:r.createdAt};
  }
  function cleanSettings(s) {
    s = s && typeof s === "object" ? s : {};
    return {character:["male","female"].includes(s.character)?s.character:defaults.character,
      bgmMuted:typeof s.bgmMuted === "boolean"?s.bgmMuted:defaults.bgmMuted,
      sfxMuted:typeof s.sfxMuted === "boolean"?s.sfxMuted:defaults.sfxMuted,
      bgmVolume:isNumber(s.bgmVolume,0,1)?s.bgmVolume:defaults.bgmVolume,
      sfxVolume:isNumber(s.sfxVolume,0,1)?s.sfxVolume:defaults.sfxVolume};
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      if (raw.length > 500000) throw new Error("oversized storage");
      const parsed = JSON.parse(raw);
      if (parsed.schema !== 3 || !Array.isArray(parsed.records)) throw new Error("invalid schema");
      const seen = new Set();
      data.records = parsed.records.filter(validateRecord).filter(r => !seen.has(r.id) && seen.add(r.id)).slice(-500).map(cleanRecord);
      data.settings = cleanSettings(parsed.settings);
    } else {
      // Preserve v2 round records untouched; carry over only user preferences.
      const legacy=localStorage.getItem("cardFlipMatch:v2");
      if (legacy && legacy.length<=500000) {
        const parsed=JSON.parse(legacy);
        if (parsed.schema===2) data.settings=cleanSettings(parsed.settings);
      }
    }
  } catch { available = false; }
  function persist() {
    try { localStorage.setItem(key,JSON.stringify(data)); available = true; }
    catch { available = false; }
    return available;
  }
  function compare(a,b) {
    return b.score-a.score || b.completedRounds-a.completedRounds || a.elapsedMs-b.elapsedMs || a.attempts-b.attempts;
  }
  C.storage = {
    key, validName, validateRecord, compare,
    get available() { return available; },
    get settings() { return {...data.settings}; },
    saveSettings(patch) { data.settings=cleanSettings({...data.settings,...patch}); return persist(); },
    addRecord(record) {
      if (!validateRecord(record)) return false;
      if (!data.records.some(r => r.id === record.id)) data.records.push(cleanRecord(record));
      data.records = data.records.slice(-500);
      return persist();
    },
    rankings() {
      const list = data.records.filter(r => r.version === C.config.version && r.scoringVersion === C.config.scoringVersion).sort((a,b) => compare(a,b) || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
      let rank = 1;
      return list.map((r,i) => { if (i && compare(list[i-1],r)!==0) rank=i+1; return {...r,rank}; });
    }
  };
})();
