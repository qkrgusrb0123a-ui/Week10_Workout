# 백엔드 ↔ Docker Compose 로컬 연결 가이드

이 파일들은 **백엔드와 Docker 연결을 위한 시작 단계**입니다. `/api/health`, `/api/concerts`, `/api/concerts/1`만 구현되어 있으며 좌석 예매·조회·취소·대기열 API는 **아직 구현하지 않았습니다**.

## 1. 파일 배치

압축을 풀어 나온 `Week10_Workout` 내부 파일을 GitHub 저장소를 clone한 로컬 프로젝트 루트에 복사합니다. 기존 README는 유지합니다.

## 2. Node.js 로컬 직접 실행 (Windows PowerShell)

```powershell
cd Week10_Workout
npm install
npm start
```

`http://localhost:3000` / `http://localhost:3000/api/health` / `http://localhost:3000/api/concerts`에서 확인합니다.

## 3. Docker Desktop + Docker Compose 실행

Docker Desktop을 실행하고 **Linux 컨테이너 모드**인지 확인합니다.

```powershell
cd Week10_Workout
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f web
```

브라우저에서 `http://localhost`에 접속합니다. 버튼을 누르면 서버 상태와 샘플 공연 목록을 확인할 수 있습니다. API는 `http://localhost/api/health`와 `http://localhost/api/concerts`입니다.

`compose.yaml`에서 `ports: - "80:3000"`은 **PC의 80번 포트 → 컨테이너 3000번 포트** 연결을 뜻합니다. 80번 포트가 이미 사용 중이면 로컬에서만 `"8080:3000"`으로 바꿔 `http://localhost:8080`으로 접근하세요. AWS에 배포할 때는 다시 실제 외부 포트에 맞춰 설정하고 README에 기록합니다.

## 4. 종료와 데이터 보존 확인

```powershell
docker compose down
docker compose up -d
```

이때 **이름 있는 볼륨** `concert-data`가 남으므로 SQLite DB는 유지됩니다. 다음 명령은 볼륨까지 삭제하므로 데이터가 사라집니다.

```powershell
docker compose down -v
```

## 5. 각 파일 역할

- `server/app.js`: Express 실행, HTML 제공, API 라우팅
- `server/db.js`: SQLite 연결, 테이블 생성, 샘플 공연·좌석 입력
- `server/routes/concerts.js`: 공연 조회 API
- `Dockerfile`: Node.js 실행 이미지 생성
- `compose.yaml`: 호스트 포트 매핑, DB 영속 볼륨, 컨테이너 실행
- `public/index.html`: 연결 테스트용 임시 화면
- `.dockerignore`: 빌드에서 로컬 DB·모듈·비밀 설정 제외

## 6. 확인할 사항

1. `/api/health`에서 `{"status":"ok","database":"connected"}` 확인
2. `/api/concerts`에서 샘플 공연 확인
3. `/api/concerts/1`에서 좌석 상태 확인
4. `docker compose down` → `up` 이후에도 데이터 유지 확인
5. GitHub에 올리기 전 실제 DB 파일(`data/*.db`)과 `.env`가 추적되지 않는지 확인

## 7. 주의

- 현재 코드는 전체 콘서트 예매 서비스가 아닙니다. 백엔드·DB·Docker 연결용 최소 단계입니다.
- SQLite 파일은 컨테이너 내부 `/app/data/concert.db`에 저장되며 Docker 볼륨 `concert-data`가 보존합니다.
- Dockerfile의 `npm install`은 네트워크 연결을 필요로 합니다. 로컬에서 `npm install` 후 생성되는 `package-lock.json`을 Git에 포함하고, 추후 Dockerfile의 명령을 `npm ci --omit=dev`로 바꾸면 버전 재현성이 좋아집니다.
- 실제 로컬 Docker 동작과 기능 시험은 개발 PC에서 직접 확인해야 합니다.
- 과제의 AI 활용 기록에는 본 파일 및 기초 코드 생성 도움도 투명하게 추가하세요. 강의의 에이전틱 코딩 도구 사용 금지 규정은 따로 준수해야 합니다.
