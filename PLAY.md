# Google Play 연동 가이드

이 저장소의 `index.html` 은 **의존성 없는 단일 HTML 게임**입니다.
현재 Play 관련 기능(로그인·리워드 광고·업적·순위표)은 **전부 목업**이며,
폰에서 실제 흐름 그대로 눌러볼 수 있게 만들어져 있습니다.
아래는 목업을 실제 SDK로 갈아끼우는 절차입니다.

---

## 1. 지금 폰에서 목업 돌려보기

| 방법 | 준비 | 비고 |
|---|---|---|
| 브라우저로 열기 | `index.html` 을 폰으로 전송해 열기 | 가장 빠름 |
| 로컬 서버 | `npm run serve` → 같은 Wi-Fi에서 `http://<PC-IP>:8080` | 서비스 워커까지 동작 |
| 홈 화면에 추가 | HTTPS 로 올린 뒤 Chrome → "앱 설치" | **실제 앱과 가장 비슷** (전체화면·스플래시·아이콘) |

우측 상단 **🧪 목업 설정** 버튼에서 다음을 바꿔가며 검증할 수 있습니다.

- **광고 결과** — 정상 / 재고 없음(No fill) / 네트워크 오류
- **광고 길이** — 5 / 15 / 30초
- **로그인 상태** — 비로그인 / 로그인됨
- **기기 프레임** — 상태바·노치를 덧그려 실제 기기처럼 확인

> 🧪 버튼은 개발용입니다. 배포 빌드에서는 `#devBtn` 을 제거하거나 `display:none` 처리하세요.

---

## 2. 배포 경로 선택

| | **Capacitor** (권장) | TWA (Bubblewrap) |
|---|---|---|
| AdMob 리워드 광고 | ✅ 네이티브 플러그인 | ❌ 웹 광고만 가능 |
| Play 게임즈 로그인/업적 | ✅ 네이티브 SDK | ❌ |
| 인앱 결제 | ✅ | ❌ |
| 필요한 것 | Android Studio, JDK 17 | 호스팅된 HTTPS PWA + Digital Asset Links |
| 앱 크기 | ~5MB | ~1MB |

리워드 광고가 핵심 루프이므로 **Capacitor** 를 전제로 아래를 작성했습니다.

---

## 3. Capacitor 프로젝트 만들기

```bash
npm install
npm run cap:add          # www/ 생성 + android/ 프로젝트 생성
npm run cap:open         # Android Studio 열기
```

`scripts/build-www.mjs` 가 `index.html` · `manifest.webmanifest` · `sw.js` · `icons/` 를
`www/` 로 모읍니다. 저장소 루트를 그대로 `webDir` 로 쓰면 `.git` 까지 APK에 들어가므로
반드시 이 단계를 거칩니다.

플러그인 추가:

```bash
npm i @capacitor-community/admob
npm i @openforge/capacitor-google-play-games   # 또는 직접 네이티브 브릿지 작성
npx cap sync android
```

---

## 4. 목업 → 실제 SDK 교체 지점

모든 Play 기능은 `index.html` 의 **`Play` 객체 한 곳**을 지납니다.
`NATIVE` 가 참이면 네이티브 분기로 빠지도록 이미 갈라져 있습니다.

```js
const NATIVE = !!(window.AndroidBridge && window.AndroidBridge.showRewardedAd);
```

| 목업 함수 | 실제로 붙일 것 | 위치 |
|---|---|---|
| `Play.showRewardedAd()` | AdMob `RewardedAd.show()` | `index.html` · `Play` 객체 |
| `Play.signIn()` / `signOut()` | Play Games Services v2 `GamesSignInClient` | 〃 |
| `Play.unlockAchievement(id)` | `AchievementsClient.unlock(id)` | 〃 |
| `Play.submitScore(v)` | `LeaderboardsClient.submitScore(id, v)` | 〃 |
| `mockRewardedAd()` | 통째로 삭제 가능 | 〃 |
| `DEV` 객체 · `#devBtn` | 배포 빌드에서 제거 | 〃 |

### 네이티브 브릿지 계약

Kotlin 쪽에서 `AndroidBridge` 라는 이름으로 JS 인터페이스를 노출하면 됩니다.

```kotlin
class AndroidBridge(private val activity: MainActivity) {
    @JavascriptInterface fun showRewardedAd()              // 끝나면 onRewardedAdResult 호출
    @JavascriptInterface fun signIn()
    @JavascriptInterface fun signOut()
    @JavascriptInterface fun unlockAchievement(id: String)
    @JavascriptInterface fun submitScore(value: Int)
}
webView.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")
```

광고 결과는 웹으로 되돌려 줍니다. 게임 쪽 `Play.showRewardedAd()` 가
`window.onRewardedAdResult` 를 등록해 두고 기다립니다.

```kotlin
// 시청 완료 → "rewarded" / 중간 닫기 → "dismissed"
// 재고 없음 → "nofill" / 로드 실패 → "error"
runOnUiThread { webView.evaluateJavascript("window.onRewardedAdResult('rewarded')", null) }
```

네 가지 결과 문자열은 게임이 그대로 처리합니다 — 각각 보상 지급 / 무시 /
"볼 수 있는 광고가 없습니다" / "광고를 불러오지 못했습니다" 토스트로 이어집니다.

### 업적 ID 매핑

게임 내 ID는 아래와 같습니다. Play Console에서 만든 업적 ID로 치환하세요.

| 게임 ID | 이름 | 조건 |
|---|---|---|
| `first_run` | 첫 탐험 | 번호 여섯을 처음 완성 |
| `gold_take` | 행운을 줍다 | 황금 상자를 담음 |
| `picky` | 까다로운 눈 | 한 판에서 5개 이상 지나침 |
| `shoestring` | 아슬아슬 | 남은 걸음 2보 이하로 완주 |
| `veteran` | 숲의 단골 | 5회 완주 |
| `dice_six` | 숲의 장난 | 주사위에서 6이 나옴 |

순위표 점수는 **완주 시 남은 걸음 수**입니다(높을수록 상위).
`submitScore(steps)` 가 `finish()` 안에서 호출되며, 바람으로 채운 판은 제출하지 않습니다.

---

## 5. Play Console 등록 자산

`play-assets/` 에 생성해 두었습니다.

| 파일 | 용도 | 규격 |
|---|---|---|
| `store-icon-512.png` | 스토어 아이콘 | 512×512 PNG |
| `adaptive-foreground-432.png` | 적응형 아이콘 전경 | 432×432, 안전영역 확보됨 |
| `feature-graphic-1024x500.png` | 피처 그래픽 | 1024×500 |
| `screenshot-1~6-*.png` | 폰 스크린샷 | 1080×1920 (실제 플레이 화면) |

앱 아이콘(런처)은 `icons/` 의 192·512와 maskable을 Android Studio의
Image Asset 마법사에 넣으면 밀도별로 생성됩니다.

---

## 6. 출시 전 확인 사항

체크 항목이지 법률 자문이 아닙니다. **정책은 수시로 바뀌므로 제출 직전에
Play Console의 최신 정책 문서를 직접 확인하세요.**

- **번호 생성기의 성격 표기** — 이 앱은 도박이 아니라 무작위 번호 생성기입니다.
  스토어 설명·앱 내 문구 어디에도 *당첨 보장·확률 상승·번호 예측* 을 암시하는
  표현이 없어야 합니다. 현재 게임 내 고지문은 "오락용 무작위 번호 생성기이며
  당첨을 보장하지 않는다"로 되어 있고, 번호 구성 코멘트에도 확률과 무관하다는
  설명이 붙어 있습니다. 이 문구는 유지하는 편이 안전합니다.
- **국가별 제한** — 복권 관련 앱은 일부 국가에서 배포가 제한될 수 있습니다.
  Play Console의 국가 설정에서 배포 대상을 확인하세요.
- **리워드 광고** — 사용자가 명시적으로 선택해야 재생되고, 중간에 닫으면
  보상이 없어야 합니다. 현재 구현이 이 조건을 만족합니다.
- **개인정보처리방침 URL** — 광고 SDK를 넣는 순간 **필수**입니다.
- **데이터 안전 섹션** — 현재 게임은 서버 전송이 전혀 없고
  `localStorage` 에만 저장합니다(기록·행운의 상자·업적·로그인 상태).
  AdMob을 붙이면 광고 ID 수집이 추가되므로 그에 맞춰 신고해야 합니다.
- **타깃 API 레벨** — Play의 최신 요구 수준에 맞추세요(매년 상향).
- **연령 등급** — 설문에서 도박·복권 항목을 정확히 답변하세요.
- **AdMob 테스트 ID** — 개발 중에는 반드시 Google이 제공하는 테스트 단위 ID를
  쓰고, 자기 광고를 클릭하지 마세요(계정 정지 사유).

---

## 7. 파일 구조

```
index.html                  게임 본체 (단일 파일, Play 목업 계층 포함)
manifest.webmanifest        PWA 매니페스트
sw.js                       오프라인 셸 캐시
icons/                      PWA·런처 아이콘
play-assets/                스토어 등록용 아이콘·피처그래픽·스크린샷
capacitor.config.json       Capacitor 설정
package.json                빌드 스크립트
scripts/build-www.mjs       www/ 로 웹 자산 모으기
```
