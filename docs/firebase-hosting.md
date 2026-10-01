# Firebase Hosting 배포

프로젝트: `cardflipmatch-herjy6372`

1. 공식 Firebase CLI를 설치하고 `firebase login`으로 로그인합니다.
2. 프로젝트 폴더에서 `node .tools/build-hosting.cjs`를 실행합니다.
3. `firebase deploy --only hosting --project cardflipmatch-herjy6372`를 실행합니다.

`dist`에는 게임 실행에 필요한 HTML, CSS, JavaScript, 이미지, MP3만 복사됩니다. 문서, 테스트, 원본 WAV, 도구와 Git 정보는 공개하지 않습니다. 빌드 도구는 예상하지 않은 파일이 dist에 있으면 중단합니다.

배포 완료 후 CLI가 출력한 HTTPS 주소에서 게임과 온라인 순위를 확인합니다. 휴대폰 크기 테스트는 실제 휴대폰 브라우저 검증과 구분해야 합니다.
