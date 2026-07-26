# BACKDOOR

**BACKDOOR**는 Three.js로 제작된 1인칭 3D 웹 공포게임입니다. *Backrooms*의 음산한 분위기와
*Roblox: Doors*의 긴장감 넘치는 문 통과 게임플레이를 결합했습니다. 플레이어는 노란 벽과 형광등,
축축한 카펫으로 가득한 무한한 공간(백룸)에 갇혀, **99개의 문**을 차례로 통과하며 탈출을 시도합니다.

브라우저에서 바로 실행되며, 모든 맵/방/문/함정/엔티티는 매 플레이마다 절차적으로 새로 생성됩니다.

> PC 전용 게임입니다. (모바일/터치 미지원)

---

## 게임 특징

- **절차적 생성**: 문을 열 때마다 복도, 방, 미로, 페이드 도어 룸 등 완전히 새로운 구조가 생성됩니다.
  같은 문 번호라도 두 번 플레이하면 다른 레이아웃이 나옵니다.
- **99개의 문**: 화면 상단에 현재 문 번호가 표시되며, 99번 문을 통과하면 탈출(승리)합니다.
- **페이크 문**: 일부 구간에는 좌/우 두 개의 문이 등장하며, 하나만 진짜입니다. 잘못 열면
  점프 스케어, 불 꺼짐, 체력 감소 등의 함정이 발동합니다.
- **7종의 엔티티**: Rush, Crawler, Watcher, Shadow, Fake Human, Backrooms Monster, Unknown.
  각각 속도/시야각/청각/행동 패턴이 다르며 A\* 기반 길찾기로 플레이어를 추적합니다.
- **은신 시스템**: 락커, 캐비닛, 책상 밑, 침대 밑, 박스, 환풍구 등에 숨을 수 있습니다. 숨는 동안
  엔티티는 플레이어를 발견할 수 없습니다.
- **랜덤 이벤트/함정**: 조명 깜빡임, 정전, 형광등 폭발, 안개, 비명, 벽 긁는 소리, 잠긴 문(열쇠 필요) 등.
- **손전등 & 배터리, 인벤토리(열쇠/배터리/구급키트)**
- **완전한 오디오**: 별도의 오디오 파일 없이 Web Audio API로 발소리·숨소리·형광등 험·엔티티
  울음소리·점프스케어 사운드를 실시간 합성하며, Three.js PositionalAudio로 공간감 있게 재생합니다.
- **후처리**: Bloom, 필름 그레인/비네트, ACES 톤매핑, 지수 안개(FogExp2), 실시간 그림자.
- **세이브/자동저장**: 진행 상황(문 번호, 체력, 인벤토리, 시드 등)이 LocalStorage에 자동 저장되며,
  Firebase 프로젝트를 연결하면 Firestore로도 미러링되어 다른 기기에서 이어할 수 있습니다.
- **업적 & 통계**: 사망 횟수, 최고 기록, 플레이 시간, 엔티티 도감(Codex) 등을 추적합니다.
- **안전 구간**: 1~2번 문에는 엔티티가 등장하지 않아 조작을 먼저 익힐 수 있고, 3번 문부터 위험이 시작됩니다.
- **건축 시스템**: `B`로 건축 모드에 진입해 가로/높이/깊이를 직접 정한 블록을 설치·제거할 수 있습니다.
  설치한 블록은 실제 충돌체이자 내비게이션 그리드 장애물이라 복도를 막는 바리케이드로 쓸 수 있습니다.

---

## 조작법

| 키 | 동작 |
|---|---|
| `W` `A` `S` `D` | 이동 |
| 마우스 이동 | 시점 회전 (Pointer Lock) |
| `Shift` (누르고 있기) | 달리기 (스태미나 소모) |
| `C` (누르고 있기) | 앉기 (은신/저소음 이동) |
| `Space` | 점프 |
| `E` | 상호작용 (문 열기 / 숨기·나오기 / 아이템 줍기) |
| `F` | 손전등 On/Off |
| `B` | 건축 모드 On/Off |
| `G` | (건축 모드) 블록 설치 |
| `H` | (건축 모드) 조준 중인 블록 제거 |
| `Tab` | 인벤토리 (예약됨) |
| `ESC` | 일시정지 메뉴 |

게임 화면을 클릭하면 마우스 포인터가 잠기며(Pointer Lock) 시점을 조작할 수 있습니다. 브라우저나
호스팅 환경이 Pointer Lock을 막는 경우(예: 임베드된 iframe)에도, 마우스 왼쪽 버튼을 누른 채
드래그하면 동일하게 시점을 회전할 수 있는 대체 조작이 항상 활성화되어 있습니다.

### 건축(barricade) 시스템

`B`를 누르면 우측에 건축 패널이 열리며 블록의 **가로/높이/깊이**를 직접 정할 수 있습니다
(0.2m ~ 4m). 화면 중앙이 조준점이 되며, `G`로 바라보는 표면에 블록을 설치하고 `H`로 조준 중인
블록을 제거합니다. 설치한 블록은 실제 충돌체이며 엔티티의 길찾기 그리드에도 반영되므로, 복도를
막아 추적자를 따돌리는 용도로 실제로 사용할 수 있습니다.

---

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

터미널에 표시되는 주소(기본 `http://localhost:5173`)를 브라우저에서 열면 바로 플레이할 수 있습니다.

### 3. 프로덕션 빌드

```bash
npm run build
```

`dist/` 폴더에 정적 파일이 생성됩니다.

### 4. 빌드 결과 미리보기

```bash
npm run preview
```

---

## GitHub Pages 배포 방법

1. `vite.config.js`의 `base` 옵션은 이미 상대 경로(`'./'`)로 설정되어 있어 별도 수정 없이
   서브 경로(예: `https://<user>.github.io/backdoor/`)에서도 정상 동작합니다.
2. 빌드를 생성합니다.

   ```bash
   npm run build
   ```

3. `dist/` 폴더의 내용을 `gh-pages` 브랜치에 배포합니다. 예시 (`gh-pages` 패키지 사용 시):

   ```bash
   npm install --save-dev gh-pages
   npx gh-pages -d dist
   ```

   또는 GitHub Actions로 `main` 브랜치 push 시 `npm run build` 후 `dist/`를 Pages에
   배포하는 워크플로우를 구성해도 됩니다.
4. 저장소 **Settings → Pages**에서 배포 브랜치를 `gh-pages`로 지정하면 완료됩니다.

---

## Firebase 클라우드 저장 (선택 사항)

기본 상태(설정 없음)에서는 LocalStorage에만 저장되며 완전히 정상 동작합니다. 다른 기기에서도
이어하고 싶다면:

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 생성합니다.
2. **Firestore Database**를 생성하고, **Authentication → Sign-in method**에서 **익명(Anonymous)**
   로그인을 활성화합니다.
3. 프로젝트 설정(⚙) → **일반** → **내 앱**에서 웹 앱을 추가하고 SDK 설정 값을 복사합니다.
4. `src/save/firebaseConfig.js`의 빈 값들을 복사한 값으로 채웁니다.
5. 다시 빌드/실행하면 저장할 때마다 Firestore(`backdoorSaves/{uid}`)에도 자동으로 저장되고,
   새 기기에서 로컬 저장 데이터가 없을 때 자동으로 불러옵니다.

`firebaseConfig.js`를 비워두면 이 모든 동작은 자동으로 비활성화되며 에러 없이 LocalStorage만
사용합니다.

---

## 프로젝트 구조

```
backdoor/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── LICENSE
├── .gitignore
├── public/
└── src/
    ├── main.js                 # 진입점
    ├── styles/
    │   └── main.css            # 전체 UI 스타일
    ├── scripts/                 # 렌더링 / 플레이어 / 게임 루프
    │   ├── Game.js              # 메인 게임 클래스 (상태 관리, 루프)
    │   ├── SceneManager.js      # Three.js 렌더러/카메라/포스트프로세싱
    │   ├── PlayerController.js  # 이동, 충돌, Pointer Lock, 앉기/달리기/점프
    │   ├── FlashlightController.js
    │   ├── Inventory.js
    │   ├── BuildSystem.js       # 건축 모드 (블록 설치/제거, 커스텀 크기)
    │   └── TextureFactory.js    # 절차적 캔버스 텍스처(벽/천장/카펫/문 등)
    ├── rooms/                   # 절차적 방/문 생성
    │   ├── RoomGenerator.js     # 문(도어) 단위 청크 생성 (복도/방/미로/페이크도어)
    │   ├── ChunkBuilder.js      # 청크 지오메트리/콜라이더/조명 빌더
    │   ├── GridWorld.js         # 그리드 기반 벽 자동 생성 + 내비게이션 그리드
    │   ├── DoorSystem.js        # 문 생성/애니메이션/페이크 도어
    │   ├── HidingSpots.js       # 은신처(락커/캐비닛/책상/침대/박스/환풍구)
    │   └── Traps.js             # 랜덤 이벤트/함정(정전, 안개, 비명 등)
    ├── entities/                # 엔티티 & AI
    │   ├── EntityDefinitions.js # 종류별 스탯 + 절차적 메시
    │   ├── Entity.js            # 상태 머신 AI (순찰/추적/탐색), A* 길찾기
    │   └── EntityManager.js
    ├── system/                  # 코어 시스템
    │   ├── Random.js            # 시드 기반 PRNG (재현 가능한 랜덤 생성)
    │   ├── InputManager.js      # 키보드/마우스/Pointer Lock
    │   ├── AudioManager.js      # Web Audio 기반 절차적 사운드
    │   ├── Pathfinding.js       # A* + 내비게이션 그리드
    │   ├── ObjectPool.js
    │   ├── SettingsManager.js
    │   ├── AchievementManager.js
    │   └── StatsManager.js
    ├── save/
    │   ├── SaveManager.js       # LocalStorage 저장/불러오기/자동저장 (+ 클라우드 동기화)
    │   ├── CloudSaveManager.js  # Firestore 미러링 (설정 없으면 자동 비활성화)
    │   └── firebaseConfig.js    # 여기에 자신의 Firebase 프로젝트 설정을 채워 넣으세요
    └── ui/                       # 화면 UI
        ├── UIManager.js          # 화면 전환 총괄
        ├── HUD.js                # 인게임 HUD (체력/스태미나/배터리/문 번호 등)
        ├── screens.js            # 메인메뉴/설정/일시정지/게임오버/승리/도감/통계
        └── Notifications.js
```

> **에셋에 대하여**: 이 프로젝트는 외부 이미지/오디오 파일을 전혀 사용하지 않습니다. 모든 텍스처는
> `TextureFactory.js`에서 Canvas 2D로, 모든 사운드는 `AudioManager.js`에서 Web Audio API
> 오실레이터/노이즈 버퍼로 실행 중에 절차적으로 생성됩니다. 따라서 저장소를 클론한 뒤 별도의
> 에셋 다운로드 없이 곧바로 실행할 수 있습니다.

---

## 추가 시스템

- ✔ 인벤토리 (열쇠/배터리/구급 키트)
- ✔ 열쇠로 잠긴 문 열기
- ✔ 손전등 & 배터리 소모/충전
- ✔ 체력 회복 아이템
- ✔ 엔티티 도감 (목격한 개체만 정보 공개)
- ✔ 일시정지 (ESC)
- ✔ 체크포인트 (자동 저장 + Continue)
- ✔ 게임 오버 화면 / 승리(탈출) 화면
- ✔ 랜덤 시드 기반 절차적 생성 (매 판 다른 레이아웃)
- ✔ 업적 시스템 (14종)
- ✔ 통계 (사망 횟수, 최고 기록, 플레이 시간, 은신 횟수 등)
- ✔ 건축/바리케이드 시스템 (커스텀 크기 블록 설치/제거)
- ✔ Firebase 클라우드 저장 (선택 사항, 설정 시 자동 활성화)
- ✔ 안전 구간 (1~2번 문은 엔티티 없음, 3번 문부터 시작)

---

## 기술 스택

- [Three.js](https://threejs.org/) — 3D 렌더링, 포스트프로세싱(Bloom), 그림자, 안개
- [Vite](https://vitejs.dev/) — 개발 서버 & 번들러
- Web Audio API — 절차적 효과음/공간음향
- Canvas 2D API — 절차적 텍스처
- Vanilla JavaScript(ES6) + HTML + CSS — 프레임워크 없이 순수 구현

## 성능 최적화

- 청크(문 단위) 단위 로딩: 한 번에 하나의 방/복도만 메모리에 존재하며, 이전 청크는 문을 통과할 때
  지오메트리/텍스처/콜라이더를 모두 dispose하여 메모리 누수를 방지합니다.
- Three.js의 Frustum Culling이 자동 적용되며, 안개(FogExp2)로 원거리 렌더링 부담을 시각적으로도
  자연스럽게 줄입니다.
- 엔티티는 필요할 때만 생성되고 청크 전환 시 제거되어 동시에 존재하는 엔티티 수를 최소화합니다.
- 그래픽 설정(Low/Medium/High)으로 그림자, 픽셀 비율, Bloom 강도를 조절할 수 있습니다.

---

## 스크린샷

> `docs/screenshots/` 폴더에 스크린샷을 추가하고 아래 자리에 링크하세요.

| 메인 메뉴 | 인게임 |
|---|---|
| _(스크린샷 자리)_ | _(스크린샷 자리)_ |

---

## 라이선스

이 프로젝트는 [MIT License](./LICENSE)를 따릅니다.
