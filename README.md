# 월간 KPI 실습앱

기존 정적 HTML KPI 화면을 유지하면서 Supabase Auth 로그인과 본인 KPI 조회·추가를 연결한 실습 폴더입니다. 프레임워크나 계정 생성 기능은 추가하지 않았습니다.

## 실행

정적 웹 서버를 통해 `index.html`을 열어야 합니다. 예를 들어 VS Code Live Server 또는 사용할 수 있는 로컬 정적 서버로 `http://localhost`에서 실행하세요. Auth와 DB 요청이 브라우저에서 나가므로 `file://` 직접 열기는 사용하지 마세요. Supabase JS v2는 공식 CDN 스크립트로 불러오며 실행 시 네트워크가 필요합니다.

## 파일 역할

- `index.html`: KPI 대시보드 구조와 입력 폼
- `style.css`: 화면 및 작은 화면용 반응형 스타일
- `app.js`: 필터, KPI 렌더링, 입력 화면 동작
- `core.js`: 값 검사·계산, Supabase client 초기화, Auth, 본인 행 조회·추가 데이터 접근 계층
- `config.js`: 공개 프로젝트 URL·publishable key 설정 위치. 실제 계정 비밀번호나 service-role/secret key를 넣지 말 것
- `data/kpi.json`, `data/kpi.csv`: 가져오기 실습·원본 비교용 데이터 사본. 앱은 이를 KPI 행으로 표시하거나 자동 업로드하지 않음
- `prd.md`: 현재 소스에서 확인되는 요구사항과 다음 단계 제안
- `schema.sql`: 새 DB용 테이블·제약·CRUD RLS 설계
- `schema_existing_migration.sql`: 알려진 앱 schema 변형을 위한 보존형 변경 초안. 적용 전 사전 조회와 실제 스키마 비교 필요
- `데이터_모델_설계.md`: 화면 검사와 DB 검사의 차이, 필드·중복·RLS 설명
- `config.example.js`: 공개 설정의 예시 자리표시자
- `config.js`: 로컬 공개 설정 위치. 앱이 읽으며 `.gitignore`로 Git 제외
- `검증체크리스트.md`: 샘플 화면 확인 항목과 DB 연결 후 확인 항목

## 샘플과 실제 DB의 차이

`config.js`가 유효하면 기존 Supabase 사용자로 로그인하고, `kpi_records`의 본인 행만 조회·추가합니다. `supabase-js`의 기본 세션 지속 설정을 켜서 세션을 브라우저 저장소에 유지하고, DB 행은 Supabase에 저장되어 새로고침 후 다시 조회됩니다. 설정이 비어 있으면 샘플을 대신 보여주지 않고 미설정 메시지를 표시합니다. JSON/CSV는 자동 로딩·저장하지 않습니다.

DB를 사용하기 전에 새 DB는 `schema.sql`, 기존 DB는 `schema_existing_migration.sql`의 사전 조회와 실제 구조 비교가 필요합니다. 이 작업에서는 SQL을 실행하지 않았습니다. 현재 로그인 화면은 기존 사용자 로그인만 제공하며 앱 내 계정 생성, 관리자 역할, 수정·삭제 UI는 없습니다. 본인 전용 접근은 RLS에 의해 강제되어야 합니다.

## GitHub에 올릴 파일

정적 앱과 실습 문서를 공유할 때 포함할 파일은 다음과 같습니다.

- `index.html`, `style.css`, `app.js`, `core.js`
- `data/kpi.json`, `data/kpi.csv`
- `README.md`, `prd.md`, `검증체크리스트.md`, `데이터_모델_설계.md`, `schema.sql`, `schema_existing_migration.sql`, `config.example.js`, `.gitignore`

`config.js`는 로컬 설정 파일로 GitHub에 올리지 않습니다. 브라우저에 포함하는 키는 공개용 publishable key만 사용하고, secret/service-role 키는 절대 넣지 않습니다. 이 작업에서 외부 배포·업로드는 수행하지 않았습니다.
