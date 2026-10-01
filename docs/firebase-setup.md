# Firebase 공유 순위 설정

게임 코드는 준비되어 있으며, 현재 `js/firebase-config.js`의 `enabled:false`로 로컬 모드입니다. 실제 Firebase 프로젝트 생성·로그인·규칙 배포와 기기 간 확인은 프로젝트 소유자가 진행해야 합니다.

## 1. 프로젝트와 웹 앱 만들기

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 만듭니다. 이 게임에는 Analytics가 필요하지 않습니다.
2. 프로젝트 설정 → 내 앱 → 웹 앱(`</>`)을 등록합니다.
3. 표시되는 `firebaseConfig`의 값을 `js/firebase-config.js`의 `firebaseConfig`에 넣습니다. 제공된 추가 필드도 함께 넣어도 됩니다.
4. Authentication → 로그인 방법에서 **익명(Anonymous)**을 활성화합니다. 별도 가입 화면 없이 브라우저마다 사용자 ID를 발급합니다.
5. Authentication → 설정 → 승인된 도메인에 실행 도메인을 등록합니다. 로컬 테스트는 `localhost`와 사용하는 `127.0.0.1`을 확인합니다.
6. Firestore Database에서 **Standard edition** 데이터베이스를 만듭니다. 생성 후 위치를 바꾸기 어려우므로 대상 사용자의 위치를 고려하세요. 기본 데이터베이스 `(default)`를 사용합니다.

## 2. 규칙과 색인 적용

`firestore.rules`를 Firestore → 규칙에 붙여 넣고 게시합니다. 이 파일은 이 게임의 기본 데이터베이스 전용 규칙입니다. 다른 앱과 같은 데이터베이스를 쓰면 기존 규칙을 검토해 병합해야 합니다.

규칙은 인증된 사용자의 기록 생성만 허용합니다. 기록 수정·삭제는 금지하고, 순위 목록 요청은 최대 100개로 제한하며, 점수·라운드·난이도·필드를 검증합니다. 나이·성별 등 불필요한 필드는 거부합니다.

Firestore → 색인 → 복합 색인에서 다음 색인을 만듭니다. 컬렉션 ID는 `records`, 쿼리 범위는 **컬렉션**입니다.

| 필드 | 정렬 |
| --- | --- |
| score | 내림차순 |
| completedRounds | 내림차순 |
| elapsedMs | 오름차순 |
| attempts | 오름차순 |
| createdAt | 오름차순 |

CLI를 사용한다면 프로젝트 폴더에서 다음과 같이 적용할 수 있습니다. `YOUR_PROJECT_ID`를 실제 프로젝트 ID로 바꾸세요.

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore --project YOUR_PROJECT_ID
```

색인이 준비될 때까지 기다린 후 `js/firebase-config.js`의 `enabled`를 `true`로 바꿉니다.

## 3. 실행 및 실제 동기화 확인

Firebase 모드는 파일 더블클릭(`file://`) 대신 HTTP/HTTPS에서 실행합니다. Python이 있으면 프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

1. `http://127.0.0.1:8765`에서 게임을 종료하고 하단에 **Firebase 동기화 완료**가 나타나는지 확인합니다.
2. 최종 순위에서 **ONLINE LEADERBOARD**와 선택한 난이도가 표시되는지 확인합니다.
3. 다른 브라우저 또는 배포한 주소를 여는 다른 기기에서 동일 난이도로 게임을 종료하고 앞의 기록이 보이는지 확인합니다. 다른 기기는 PC의 `127.0.0.1`에 접속할 수 없으므로 웹 호스팅 주소가 필요합니다.
4. 연결을 끊고 게임을 종료하면 로컬에 기록이 남습니다. 연결 복구, 페이지 재실행, **다시 동기화** 중 하나로 업로드를 재시도합니다.
5. 여러 번 재시도해도 동일한 사용자 ID/기록 ID 조합은 한 번만 저장되어야 합니다.

## 저장 방식과 한계

- `leaderboards/difficulty-v2_run-total-v1_난이도/records/사용자ID_기록ID`에 종료 게임을 저장합니다. 서버 접수 시각도 별도로 저장합니다.
- Firebase 활성화 시 이 브라우저의 새 난이도 버전(v4) 미전송 기록을 업로드합니다. 과거 v2/v3 기록은 업로드하거나 새 순위에 섞지 않습니다.
- 공유 순위에는 별명·난이도·점수·게임 결과·시간·시도·기록 시각이 공개됩니다. 나이·성별은 전송하지 않습니다.
- 온라인 순위는 상위 100개 기록을 표시합니다. 내 기록이 없으면 미전송 또는 상위 100개 밖이라고 안내하며, 임의의 전체 순위를 계산하지 않습니다. 목록 경계에서 같은 점수의 기록 일부가 제외될 수 있습니다.
- 로컬 기록은 전체 난이도 합계 최근 500개까지 보관합니다. 미전송 기록도 이 한도에 포함되므로 500개를 넘기기 전에 동기화하세요. 로컬 저장이 차단되면 새로고침 전 현재 실행에서만 재시도할 수 있습니다.
- 익명 계정은 브라우저 저장소에 연결됩니다. 저장소를 지우거나 브라우저를 바꾸면 새 사용자 ID가 생깁니다. 동일 별명의 다른 게임은 각각 기록되며, 개인 계정의 기기 간 복원 기능은 포함하지 않습니다.
- 규칙은 잘못된 필드와 점수 범위를 검사하지만 실제 플레이를 증명하지 않습니다. 경쟁/보상이 있는 서비스라면 서버에서 플레이·점수를 검증하고 App Check 및 요청 제한을 추가해야 합니다.
- 실제 Firebase 프로젝트가 아직 없으므로 실제 서버 연결과 규칙 배포 검증은 수행하지 않았습니다. 자동 테스트는 로컬 게임과 Firebase SDK 대역을 이용한 동기화 동작을 검증합니다.

공식 문서: [웹 SDK 연결](https://firebase.google.com/docs/web/alt-setup), [익명 로그인](https://firebase.google.com/docs/auth/web/anonymous-auth), [Firestore 보안 규칙](https://firebase.google.com/docs/firestore/security/get-started), [실시간 순위 구독](https://firebase.google.com/docs/firestore/query-data/listen).
