# Firebase 실제 연결 확인 — 2026-10-01

- 프로젝트: `CardFlipMatch` / `cardflipmatch-herjy6372`
- 웹 앱: `CardFlipMatch Web`
- Firebase Authentication: 익명 로그인 활성화
- 데이터베이스: Firestore Standard, `(default)`, `asia-northeast3`(서울)
- 요금제: Spark 유지
- 규칙: 저장소의 `firestore.rules`를 콘솔에서 게시
- 복합 색인: `records`, score DESC → completedRounds DESC → elapsedMs ASC → attempts ASC → createdAt ASC, 컬렉션 범위
- 클라이언트: `js/firebase-config.js` 연결 정보 입력 및 `enabled:true`

## 실제 확인

`http://127.0.0.1:8765`에서 보통 난이도의 `연결확인` 게임을 종료해 기록을 업로드했습니다. 별도 브라우저 저장 공간인 `http://localhost:8765`에서 `동기화확인` 게임을 종료한 뒤, 온라인 순위표에 두 기록이 함께 표시되는 것을 확인했습니다. 두 기록은 0점으로 순위표에 남아 있습니다.

두 번째 클라이언트는 첫 번째 클라이언트의 localStorage에 접근할 수 없으므로, 공유 순위가 서버를 통해 전달된 것을 확인할 수 있습니다. 실제 모바일 기기는 이번 검증에 사용하지 않았습니다.

## 자동 검증

- HTTP 게임 회귀 테스트: 15개 그룹 통과
- 음원/캐릭터/실패 대응 테스트: 9개 그룹 통과
- 동기화 SDK 대역 테스트: 오프라인 큐·재시도·중복 방지·구독 취소 통과
- 회귀 테스트는 테스트 전용 설정으로 온라인 연결을 끕니다. 실제 순위에 자동 테스트 기록을 업로드하지 않습니다.

## 운영 상태

GitHub에 코드는 보관하지만 공개 웹 호스팅은 아직 배포하지 않았습니다. 다른 기기에서 게임을 열려면 HTTPS 게임 주소를 배포해야 합니다. 관리자 비밀 키나 서비스 계정은 게임 코드에 포함하지 않습니다.
