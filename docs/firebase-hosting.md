# Firebase Hosting 배포

프로젝트: `cardflipmatch-herjy6372`

공개 주소: https://cardflipmatch-herjy6372.web.app/

2026-10-01 배포 및 검증 완료:

- 게임 실행 파일 25개의 HTTPS 응답과 로컬 파일 내용 일치 확인.
- 문서, 테스트, 도구, Git 설정, 원본 WAV URL은 404 확인.
- 공개 사이트에서 카드 맞추기, 라운드 완료, 최종 370점 저장 확인.
- web.app과 firebaseapp.com의 서로 다른 저장 공간에서 온라인 순위 공유 및 실시간 갱신 확인.
- 375px 화면에서 카드 입력, 결과, 순위 확인. 가로 넘침 없음, 카드 버튼 138×172.5px.
- 기존 연결확인/동기화확인 및 이번 배포확인/모바일확인 테스트 기록 총 4개만 정확한 문서 ID로 삭제. 서버 조회 및 공개 순위에서 삭제 확인.
- 실제 휴대폰 브라우저는 검증하지 않음. 모바일 크기의 데스크톱 브라우저 검사 결과임.
- 전체 게임/미디어 회귀 테스트 및 동기화 테스트 통과.

1. 공식 Firebase CLI를 설치하고 `firebase login`으로 로그인합니다.
2. 프로젝트 폴더에서 `node .tools/build-hosting.cjs`를 실행합니다.
3. `firebase deploy --only hosting --project cardflipmatch-herjy6372`를 실행합니다.

`dist`에는 게임 실행에 필요한 HTML, CSS, JavaScript, 이미지, MP3만 복사됩니다. 문서, 테스트, 원본 WAV, 도구와 Git 정보는 공개하지 않습니다. 빌드 도구는 예상하지 않은 파일이 dist에 있으면 중단합니다.

배포 완료 후 CLI가 출력한 HTTPS 주소에서 게임과 온라인 순위를 확인합니다. 휴대폰 크기 테스트는 실제 휴대폰 브라우저 검증과 구분해야 합니다.
