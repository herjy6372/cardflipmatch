# 모바일 사용성 점검 — 2026-10-01

작은 화면의 입력/선택 글자를 16px로 키우고, 카드와 주요 버튼에 touch-action: manipulation을 적용했습니다. 온라인 순위가 비어 있으면 첫 기록을 안내하는 상태 문구를 표시합니다.

`node tests/mobile.test.cjs`는 Chromium의 터치 입력 환경에서 375px 세로 화면 카드 입력, 플레이 중 812px 가로 화면 전환, 라운드 완료, 로컬 순위 및 빈 온라인 순위, 320px 가로 넘침을 검사합니다. 테스트는 Firebase 연결을 끄므로 운영 순위에 기록을 올리지 않습니다.

이 검증은 브라우저의 모바일/터치 모사이며 실제 iPhone 또는 Android 기기 검증은 아닙니다. 소리와 캐릭터 동작은 기존 미디어 회귀 테스트로 검사합니다.

공개 주소:
- https://herjy6372.github.io/cardflipmatch/
- https://cardflipmatch-herjy6372.web.app/
