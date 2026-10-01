"use strict";
window.CardFlipMatch = window.CardFlipMatch || {};
(() => {
  const C = window.CardFlipMatch;
  const emojis = ["🍎","🍌","🍇","🍓","🍒","🍍","🥝","🍉","🐶","🐱","🐼","🐸","🦊","🐵","🐙","🦋","🚗","🚀","⚽","🎸","👑","🌈","⭐","🌻"];
  const names = ["사과","바나나","포도","딸기","체리","파인애플","키위","수박","강아지","고양이","판다","개구리","여우","원숭이","문어","나비","자동차","로켓","축구공","기타","왕관","무지개","별","해바라기"];
  const difficulties = {
    easy:{label:"쉬움",secondsPerPair:6,baseSeconds:24},
    normal:{label:"보통",secondsPerPair:4,baseSeconds:22},
    hard:{label:"어려움",secondsPerPair:3,baseSeconds:16}
  };
  const progressiveCounts = [4,8,12,16,20,24,28,32,40,48];
  function roundConfig(round, difficulty = "normal") {
    if (!Number.isInteger(round) || round < 1 || round > 50) throw new Error("라운드는 1~50 범위여야 합니다.");
    if (!Object.hasOwn(difficulties,difficulty)) throw new Error("난이도를 확인해 주세요.");
    const mode=difficulties[difficulty], count=progressiveCounts[Math.floor((round-1)/5)];
    if (count % 2 || count / 2 > emojis.length || new Set(emojis).size !== emojis.length) throw new Error("카드 설정이나 이모지 수를 확인해 주세요.");
    return { round, difficulty, count, pairs:count / 2, cols:count===4?2:count<=20?4:count<=32?6:8,
      seconds:count/2*mode.secondsPerPair+mode.baseSeconds-(round-1)%5 };
  }
  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function createCards(round, difficulty = "normal") {
    const config = roundConfig(round,difficulty);
    return shuffle(shuffle(emojis.map((emoji, pairId) => ({emoji,pairId,name:names[pairId]})))
      .slice(0,config.pairs).flatMap(pair => [0,1].map(copy => ({ ...pair, id:`${pair.pairId}-${copy}`, isFlipped:false, isMatched:false }))));
  }
  const motions = {
    idle:{duration:3000,frames:4,hold:false},
    greeting:{duration:800,frames:4,hold:false},
    cheer:{duration:600,frames:4,hold:false},
    encourage:{duration:500,frames:4,hold:false},
    success:{duration:1200,frames:4,hold:true},
    fail:{duration:1000,frames:4,hold:true}
  };
  const characterAssets={idle:{file:"idle-v1.png",fallback:"static-idle-v1.png",width:2172,height:724,cols:4,rows:1},reactions:{file:"reactions-v1.png",fallback:"static-poses-v1.png",width:971,height:1620,cols:4,rows:5,row:{greeting:0,cheer:1,encourage:2,success:3,fail:4},bounds:{male:[0,326,638,960,1264,1620],female:[0,322,646,974,1292,1620]}}};
  C.config = { emojis,names,difficulties,progressiveCounts,roundConfig,shuffle,createCards,motions,characterAssets,version:"difficulty-v2",scoringVersion:"run-total-v1",matchPoints:100,bonusPerSecond:10,flipBackMs:500,warningSeconds:10 };
})();
