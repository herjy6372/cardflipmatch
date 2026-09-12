# 남자 캐릭터 대기 동작 v1

제작 방식: 내장 image_gen으로 스프라이트 생성, CSS로 프레임 전환과 호흡 움직임 구현.

자산: `../images/characters/male/idle-v1.png` (2172×724, 가로 4프레임, 프레임당 543×724). 원래 요청한 정사각형 셀과 달리 세로형 셀로 생성되어 CSS는 실제 크기에 맞췄다.

미리보기: `character-preview.html`. 대기 동작만 제작했으며 인사·응원·격려·성공·실패 및 여자 캐릭터는 후속 제작 대상이다. 프레임별 미세한 윤곽 차이는 생성 이미지 특성상 존재할 수 있다.

## 최종 생성 프롬프트

```text
Use case: stylized-concept. Asset type: production 2D idle animation sprite sheet for Card Flip Match web game. Create ONE transparent PNG sprite sheet with exactly 4 equal square cells arranged horizontally in one row (4 columns, 1 row). Same full-body cheerful male chibi character repeated identically in all cells, same scale and foot baseline, centered in each cell, generous transparent margins, no grid lines or text. Character: 2.5 heads tall, fluffy chocolate brown hair, friendly amber eyes, mint oversized hoodie with tiny lemon yellow pocket accent, cream shorts, white sneakers with coral accents. Clean polished hand drawn 2D anime mobile game illustration, rounded silhouette, crisp dark soft outlines, restrained cel shading, fresh bubbly welcoming mood. Arms relaxed at sides. Frame 1 eyes open soft smile neutral idle. Frame 2 identical pose and face but eyelids half closed. Frame 3 identical pose eyes fully closed blinking with smile. Frame 4 identical to frame 1 eyes open. No extra characters, props, ground, shadows outside character, logos, labels, watermark. Genuine transparent alpha background. All 4 characters must have exactly the same proportions, clothes, position within their equal cells; ONLY eyelids change. This is one animation asset, not a character concept layout.
```
