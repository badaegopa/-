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

## 4-1. 당첨 순위표 — 서버가 필요한 부분

**여러 사용자의 번호를 한 순위표에 모으려면 서버가 반드시 필요합니다.**
현재는 `localStorage` 만 쓰기 때문에 티켓·당첨 기록이 그 기기 안에만 남습니다.
다른 사람의 티켓을 볼 방법이 없고, 기기를 바꾸거나 앱을 지우면 사라집니다.

게임 쪽 준비는 끝나 있습니다. `index.html` 의 `Lotto` 객체에서
`API_BASE` 만 채우면 아래 세 엔드포인트로 붙습니다.

| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| GET | `/rounds/:drwNo` | — | `{ drwNo, nums:[6], bonus, prize:{1..5}, date }` |
| POST | `/tickets` | `{ round, nums:[6] }` | 발행 즉시 서버 보관 |
| GET | `/winners?round=` | `round` 생략 시 누적 | `[{ round, name, rank, prize }]` |

`API_BASE` 가 비어 있으면 회차 번호로 고정된 **모의 추첨**이 대신 돌아갑니다.
화면 곳곳에 「모의」 배지와 경고 문구가 붙어 실제 결과가 아님을 밝힙니다.

### 서버가 해야 할 일

1. **회차 결과 수급** — 동행복권이 공식 API를 제공하지는 않습니다.
   널리 쓰이는 비공식 엔드포인트(`common.do?method=getLottoNumber&drwNo=N`)가
   당첨번호 6개·보너스·추첨일과 **1등 1인 수령액**을 JSON으로 돌려줍니다.
   비공식이라 언제든 바뀔 수 있으니 실패 시 재시도·캐시를 두세요.
   브라우저에서 직접 부르면 CORS로 막히므로 **서버가 대신 받아야** 합니다.
2. **2·3등 금액 확보** — 위 응답에는 없습니다. 당첨결과 페이지에서 따로
   가져오거나 직접 입력해야 합니다. **4등 5만원 / 5등 5천원은 고정**입니다.
3. **채점** — 6개=1등, 5+보너스=2등, 5개=3등, 4개=4등, 3개=5등.
   게임 안 `rankOf()` 와 같은 규칙입니다.
4. **집계** — 회차별 상위 5명, 그리고 주차를 누적한 전체 상위 5명.
5. **추첨 시각** — 매주 토요일 20:45 KST. 게임은 제1회(2002-12-07 20:45 KST)를
   기준으로 회차를 계산하므로 서버도 같은 기준을 쓰면 어긋나지 않습니다.

### 정책·개인정보 주의

- 티켓을 서버에 보관하는 순간 **개인정보처리방침과 데이터 안전 신고 대상**이
  됩니다. 기기 식별자만 쓰고 계정 정보를 받지 않는 설계를 권합니다.
- 닉네임을 이용자가 직접 입력하게 하면 **신고·차단 수단**이 필요합니다.
- **당첨금 순위를 전면에 내세우면 도박성 앱으로 오인될 소지**가 큽니다.
  실제 구매 대행이나 금전 거래가 없다는 점을 스토어 설명과 앱 안에 명시하고,
  당첨금 표시 옆의 「모의」/「실제 회차 결과」 구분을 끝까지 유지하세요.
- 이 앱은 번호를 생성할 뿐 **복권을 판매하거나 당첨금을 지급하지 않습니다.**
  그 사실이 화면에서 분명해야 합니다.

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
