# 여자 캐릭터 대기 동작 v1

내장 image_gen으로 남자 캐릭터를 화풍·배치 참고 이미지로 사용하여 제작했다. 코랄 후드, 민트 포켓, 크림색 반바지, 레몬 머리핀과 갈색 단발머리로 구성했다.

- 자산: `../images/characters/female/idle-v1.png`
- 이미지: 2172×724, 가로 4프레임, 프레임당 543×724
- CSS: `../images/characters/female/idle.css`
- 미리보기: `character-preview.html`에서 남자·여자 선택 가능
- 동작: 3초 주기 눈 깜빡임과 CSS 호흡 움직임. 일시정지·정적 포즈·움직임 감소 설정 지원

이번 작업은 여자 캐릭터의 기본 디자인과 대기 동작까지다. 인사·응원·격려·성공·실패는 후속 제작 대상이며, 생성 프레임 사이에는 미세한 윤곽 차이가 있을 수 있다.

## 최종 생성 프롬프트

```text
Use case: stylized-concept. Reference image is STYLE AND SPRITE LAYOUT reference only, not an edit target. Generate the female companion character for this same Card Flip Match game as ONE transparent PNG sprite sheet. Match reference polished cute 2D anime linework, chibi proportions, cel shading and warm approachable expression. Exactly four equal cells in one horizontal row, full body at identical scale and identical baseline and position in each cell. Canvas aspect ratio 3:1, each cell portrait 3:4. Female character: chestnut brown shoulder-length softly curved bob, small lemon-shaped hairclip, amber eyes, coral peach oversized sweatshirt with small mint pocket, cream shorts, white sneakers with mint accents. Rounded 2.5-head chibi silhouette, youthful friendly fresh bubbly casual look. Arms relaxed beside body. Frame 1 eyes fully open soft smile. Frame 2 identical character eyelids half closed. Frame 3 eyes closed blinking soft smile. Frame 4 eyes fully open identical to frame 1. ONLY eyelids change between cells, maintain absolute alignment, clothing, hair, body and proportions. Generous transparent margins all around each figure, no clipping. Truly transparent alpha background, no floor or cast shadow, no text, no grid, no labels, no watermark, no additional characters. This is a production idle blink sprite sheet.
```
