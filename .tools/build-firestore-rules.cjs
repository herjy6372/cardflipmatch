// Regenerate rules bounds whenever difficulty-v2 changes. Does not deploy anything.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),sandbox);
const C=sandbox.window.CardFlipMatch.config;
const pairs=[0],seconds={easy:[0],normal:[0],hard:[0]};
for(let round=1;round<=50;round++){
  pairs.push(pairs.at(-1)+C.roundConfig(round).pairs);
  for(const mode of Object.keys(seconds))seconds[mode].push(seconds[mode].at(-1)+C.roundConfig(round,mode).seconds);
}
const rules=`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function totalPairs(round) { return ${JSON.stringify(pairs)}[round]; }
    function totalSeconds(round, difficulty) {
      return difficulty == 'easy' ? ${JSON.stringify(seconds.easy)}[round]
        : difficulty == 'normal' ? ${JSON.stringify(seconds.normal)}[round]
        : ${JSON.stringify(seconds.hard)}[round];
    }
    function validRecord(r, board, recordId) {
      return r.keys().hasAll(['id','nickname','difficulty','version','scoringVersion','round','completedRounds','reason','score','bonus','elapsedMs','attempts','matchedPairs','createdAt','uid','submittedAt'])
        && r.keys().hasOnly(['id','nickname','difficulty','version','scoringVersion','round','completedRounds','reason','score','bonus','elapsedMs','attempts','matchedPairs','createdAt','uid','submittedAt'])
        && r.uid == request.auth.uid
        && r.id is string && r.id.matches('^[A-Za-z0-9-]{1,100}$')
        && recordId == r.uid + '_' + r.id
        && r.nickname is string && r.nickname.size() >= 1 && r.nickname.size() <= 12
        && r.nickname.matches('.*[^ ].*') && !r.nickname.matches('.*[\\x00-\\x1F\\x7F].*')
        && r.difficulty in ['easy','normal','hard']
        && r.version == 'difficulty-v2' && r.scoringVersion == 'run-total-v1'
        && board == r.version + '_' + r.scoringVersion + '_' + r.difficulty
        && r.round is int && r.round >= 1 && r.round <= 50
        && r.completedRounds is int && r.completedRounds >= 0 && r.completedRounds <= r.round
        && ((r.reason == 'complete' && r.round == 50 && r.completedRounds == 50)
          || (r.reason == 'timeout' && r.completedRounds == r.round - 1)
          || (r.reason == 'quit' && r.completedRounds in [r.round - 1,r.round] && r.completedRounds < 50))
        && r.matchedPairs is int && r.matchedPairs >= totalPairs(r.completedRounds)
        && (r.completedRounds == r.round ? r.matchedPairs == totalPairs(r.round) : r.matchedPairs < totalPairs(r.round))
        && r.bonus is int && r.bonus >= 0 && r.bonus <= totalSeconds(r.completedRounds,r.difficulty) * 10 && r.bonus % 10 == 0
        && r.score is int && r.score == r.matchedPairs * 100 + r.bonus
        && r.elapsedMs is number && r.elapsedMs >= 0 && r.elapsedMs <= totalSeconds(r.round,r.difficulty) * 1000
        && r.attempts is int && r.attempts >= r.matchedPairs && r.attempts <= 5000000
        && r.createdAt is number && r.createdAt >= 0 && r.createdAt <= 9007199254740991
        && r.submittedAt == request.time;
    }
    match /leaderboards/{board}/records/{recordId} {
      allow get: if request.auth != null;
      allow list: if request.auth != null && request.query.limit != null && request.query.limit <= 100;
      allow create: if request.auth != null && validRecord(request.resource.data,board,recordId);
      allow update, delete: if false;
    }
  }
}
`;
// Escape regex backslashes again for the Firestore rules string literal.
fs.writeFileSync(path.join(root,'firestore.rules'),rules.replaceAll('\\x','\\\\x'));
console.log('Generated firestore.rules bounds for all 150 configurations');
