# 캐릭터 반응 시트 제작 기록

도구: 내장 `image_gen` 생성과 배경 제거 편집. 기존 남녀 `idle-v1.png`는 참고 이미지로만 사용했고 원본을 수정하지 않았다.

최종 파일은 `images/characters/male/reactions-v1.png`, `images/characters/female/reactions-v1.png`다. 각각 971×1620px RGBA, 4열 프레임과 5행 반응(인사·박수·끄덕임·성공·실패 뒤 격려)을 포함한다. 실제 행 높이가 달라 원본을 재가공하지 않고 `js/config.js`의 행 경계로 표시 영역을 지정했다.

원본과 같은 시트를 별도 `static-poses-v1.png`로 복사했다. 기존 대기 시트도 `static-idle-v1.png`로 복사했다. 대체 시트는 CSS에서 상태별 프레임을 고정해 사용한다.

## 생성 프롬프트

아래 프롬프트를 `{sex}` = `male`, `female`로 각각 사용했다. 참고 파일은 해당 캐릭터의 기존 `idle-v1.png`다.

```text
Use case: stylized-concept. Reference image is identity reference only. Generate ONE transparent sprite atlas PNG of this same {sex} chibi character, preserve hair and outfit colors. EXACTLY 4 COLUMNS x 5 ROWS, 20 equal rectangular cells. Canvas 1536x2560, each cell 384x512. Center one full-body figure in each cell, identical scale and baseline, 15% transparent margins inside EVERY cell. Five animation strips, each 4 frames left-to-right. Row 1: hand waving greeting. Row 2: hands apart then together clapping cheer. Row 3: gentle head nod with hands relaxed at sides. Row 4: cheerful celebration arms raised ending with happy victory pose. Row 5: disappointment then warm encouraging thumbs-up ending with smile. Exact equal grid spacing critically important. Genuine transparent alpha background, NOT a painted checkerboard, no background color, no ground, no shadows, no text, no grid lines, no labels. Same clean 2D line art, same identity all frames. All 5 rows must exist, each with exactly four full characters.
```

첫 생성은 RGB 체크무늬 배경이어서 그대로 적용하지 않았다. 생성된 남녀 시트를 각각 편집 대상으로 사용해 아래 배경 제거 요청을 실행했다. 최종 RGBA와 투명 알파를 확인했다.

## 최종 편집 프롬프트

```text
Use case: background-extraction. Edit target: attached sprite sheet. REMOVE the entire gray-and-white checkerboard background. Deliver PNG with ACTUAL TRANSPARENT ALPHA pixels around characters, NOT RGB white or checkerboard. Preserve all 20 figures, their pixels, clothes, poses, scale and exact 4-column 5-row positions. No drawing changes, no new figures. This image is to be composited on a mint-colored web game panel. Transparent background cutout is the only change. Output genuine RGBA transparent PNG.
```

생성 이미지 특성상 원본 대기 그림과 반응 사이의 미세한 윤곽·크기 차이는 있다. 기존 미리보기와 대기 애니메이션 파일은 보존했다.
