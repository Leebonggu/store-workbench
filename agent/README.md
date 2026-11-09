> 2026-11-09 실호출 갱신: GPT-6.1 Sol 기본 모델로 실제 사진 3종의 Flue 요청·응답을 검증했습니다. 아래의 키 미설정/실모델 미검증 표기는 이전 시점 기록입니다. [비교·검증 결과](../docs/evaluations/2026-11-09-model-comparison.md) 참조.

# 모어비쥬 Flue 에이전트 서버

웹 작업대의 사진·상품 정보 요청을 처리합니다. 설치·실행·검증은 [루트 README](../README.md)를 따르세요. `src/agents/product.ts`가 상품 원장 읽기와 결과 제출 도구를 등록합니다. `src/app.ts`가 로컬 API 입력·출력과 시간 제한을 검증합니다. 대화 자료는 `data/flue.db`에 저장되며 Git에서 제외합니다.

Flue init으로 생성한 Node 서버 구성을 기존 앱 옆 `agent/`에 유지합니다. 현재 에이전트는 웹이 보내는 initialData가 필요하므로 일반 “Hi” CLI 호출 대신 `npm run test:agent` 또는 웹에서 확인하세요. 실제 키 테스트는 아직 미실행입니다.
