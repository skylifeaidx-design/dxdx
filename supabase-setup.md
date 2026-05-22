# Supabase 프로젝트 셋업 가이드

DX 트레저 헌트 게임을 위한 Supabase 백엔드 설정 가이드입니다.
총 소요 시간: **약 10분**

---

## 1단계: Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → **Start your project** 클릭
2. GitHub 계정으로 로그인 (또는 이메일 가입)
3. **New project** 클릭
4. 프로젝트 정보 입력:
   - **Name**: `dx-treasure-hunt`
   - **Database Password**: 원하는 비밀번호 입력 (메모해두세요)
   - **Region**: `Northeast Asia (Seoul)` 선택
5. **Create new project** 클릭 → 2~3분 대기

---

## 2단계: 데이터베이스 테이블 생성

프로젝트 대시보드 → 좌측 메뉴 **SQL Editor** 클릭 → 아래 SQL을 복사-붙여넣기 후 **Run** 클릭:

```sql
-- ============================================
-- DX 트레저 헌트 - 데이터베이스 스키마
-- ============================================

-- 1) 참가자 테이블
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '👤',
    total_score INTEGER DEFAULT 0,
    completed_missions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) 미션 제출 테이블
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id),
    mission_id TEXT NOT NULL,
    photo_url TEXT,
    status TEXT DEFAULT 'approved',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, mission_id)  -- 한 미션당 1회 제출만 허용
);

-- 3) 점수 증가 함수 (RPC)
CREATE OR REPLACE FUNCTION increment_score(p_id TEXT, points INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE players
    SET total_score = total_score + points,
        completed_missions = completed_missions + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
```

---

## 3단계: Storage 버킷 생성

1. 좌측 메뉴 → **Storage** 클릭
2. **New bucket** 클릭
3. 버킷 정보:
   - **Name**: `photos`
   - **Public bucket**: ✅ 체크 (공개 버킷)
   - **File size limit**: `10MB`
   - **Allowed MIME types**: `image/*`
4. **Create bucket** 클릭

---

## 4단계: RLS (Row Level Security) 정책 설정

SQL Editor에서 아래 SQL 실행:

```sql
-- ============================================
-- RLS 정책 (9명 내부 이벤트이므로 간단하게 설정)
-- ============================================

-- players 테이블: 누구나 읽기/쓰기 가능
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read players"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert players"
    ON players FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update players"
    ON players FOR UPDATE
    USING (true);

-- submissions 테이블: 누구나 읽기/쓰기 가능
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read submissions"
    ON submissions FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert submissions"
    ON submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update submissions"
    ON submissions FOR UPDATE
    USING (true);

CREATE POLICY "Anyone can delete submissions"
    ON submissions FOR DELETE
    USING (true);

-- Storage: photos 버킷 접근 정책
CREATE POLICY "Anyone can upload photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can read photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'photos');
```

---

## 5단계: API 키 복사 → app.js에 입력

1. 좌측 메뉴 → **Settings** → **API**
2. 아래 두 값을 복사:
   - **Project URL**: `https://xxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJI...` (매우 긴 문자열)
3. `app.js` 파일 상단의 값을 교체:

```javascript
const SUPABASE_URL = 'https://xxxxxxx.supabase.co';        // ← 여기에 Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...';               // ← 여기에 anon public key
```

---

## 6단계: 참가자 이름 수정

`app.js`의 `PLAYERS` 배열에서 실제 이름으로 수정:

```javascript
const PLAYERS = [
    { id: 'park_a',  name: '박OO', emoji: '🦊' },
    { id: 'ham',     name: '함OO', emoji: '🐻' },
    // ... 나머지 수정
];
```

---

## 7단계: 배포

### 방법 A: 로컬 테스트 (가장 빠름)
```bash
cd treasure-hunt
npx -y serve .
# 또는
python -m http.server 8080
```
→ 브라우저에서 `http://localhost:3000` 접속

### 방법 B: GitHub Pages (무료 배포)
1. `treasure-hunt/` 폴더를 GitHub 저장소에 push
2. 저장소 Settings → Pages → Source: Deploy from a branch
3. Branch: main, Folder: /treasure-hunt → Save
4. 몇 분 후 `https://username.github.io/repo-name/` 으로 접속

### 방법 C: Netlify Drop (가장 간편)
1. [app.netlify.com/drop](https://app.netlify.com/drop) 접속
2. `treasure-hunt/` 폴더를 드래그 & 드롭
3. 즉시 배포 완료 → URL 공유

---

## 🔧 트러블슈팅

| 증상 | 해결 |
|------|------|
| 사진 업로드 실패 | Storage 버킷이 `public`인지 확인 |
| 실시간 순위 안 됨 | `ALTER PUBLICATION` SQL 실행 확인 |
| "permission denied" 오류 | RLS 정책(4단계) SQL 재실행 |
| 점수 반영 안 됨 | `increment_score` 함수 생성 확인 |
| 재접속 시 데이터 사라짐 | localStorage는 정상, Supabase 연결 확인 |

---

## 이벤트 종료 후 정리

이벤트 후 프로젝트를 유지하거나 삭제할 수 있습니다:
- **유지**: 무료 플랜은 7일 비활성 시 자동 일시정지 (데이터는 보존)
- **데이터 내보내기**: SQL Editor에서 `SELECT * FROM submissions;` 실행 후 CSV 다운로드
- **사진 다운로드**: Storage → photos 버킷에서 일괄 다운로드
- **삭제**: Settings → General → Delete project
