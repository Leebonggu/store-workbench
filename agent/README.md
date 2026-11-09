# 모어비쥬 Flue 에이전트 서버

웹 작업대의 사진·상품 정보 요청을 처리합니다. 설치·실행·검증은 [루트 README](../README.md)를 따르세요. `src/agents/product.ts`가 상품 원장 읽기와 결과 제출 도구를 등록합니다. `src/app.ts`가 로컬 API 입력·출력과 시간 제한을 검증합니다. 대화 자료는 `data/flue.db`에 저장되며 Git에서 제외합니다.

Flue init으로 생성한 Node 서버 구성을 기존 앱 옆 `agent/`에 유지합니다. 현재 에이전트는 웹이 보내는 initialData가 필요하므로 일반 “Hi” CLI 호출 대신 `npm run test:agent` 또는 웹에서 확인하세요. 실제 키 테스트는 아직 미실행입니다.
