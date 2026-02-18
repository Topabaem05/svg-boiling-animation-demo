# PRD: 이미지 업로드 5MB 제한 및 온디바이스 보일링 처리 가능성

## 1. Goal

- 업로드 이미지(프레임 및 오버레이) 용량을 **최대 5MB**로 제한한다.
- 보일링 애니메이션의 핵심 처리(업로드 파싱, 래스터->SVG 변환, 필터 애니메이션, GIF 렌더링)를 **클라이언트 디바이스에서 처리**하도록 유지/확인한다.
- 사용자가 한글로 이해하기 쉬운 에러/제약 UX를 제공한다.

## 2. Instructions

- 입력 파일 크기 검사: `app/page.tsx`에서 업로드 진입점(`handleFileUpload`, `handleOverlayFileChange`)에 공통 상한값 적용.
- 상한 초과 시: 즉시 업로드 중단, 상태 메시지 표시, 콘솔 예외 대신 사용자 피드백 노출.
- 기존 UX를 깨지 않도록 프레임 추가/오버레이 설정/애니메이션 로직은 유지하고, 추가 예외 경로만 보강.
- 서버 업로드/변환 경로가 없으므로 새 서버 API 생성 없이 클라이언트 라우팅 위주로 구현.

## 3. Discoveries (현재 코드베이스 분석)

- `app/page.tsx`는 클라이언트 컴포넌트(`"use client"`)로 동작한다.
- 프레임 업로드는 `handleFileUpload`로 진입하며 SVG/래스터로 분기한다.
  - SVG: `FileReader.readAsText` + `DOMParser` + `createFrameLayerFromSvg`
  - 래스터: `createFrameLayerFromRaster`에서 `FileReader`, `Image`, `canvas`, `ctx.getImageData`, `imagetracerjs`를 사용해 클라이언트에서 SVG로 변환
- 오버레이 업로드는 `handleOverlayFileChange`에서 `FileReader` + `Image` + 상태 저장만 수행하며 서버 전송 없음.
- GIF 내보내기도 `exportAsGIF`에서 브라우저에서 SVG를 임시 렌더링해 프레임 캡처 후 `gif.js`로 인코딩.
- 현재 런타임 경로에 별도 API 라우트/서버 액션이 없다(`app/api` 미존재).
- GIF 작업은 브라우저에서 수행되며, 원래 `public/gif.worker.js`의 원격 CDN 호출 의존성이 있던 점은 현재 로컬 번들 스크립트 복사로 완화했다.

## 4. Accomplished (변경 사항)

- 업로드 용량 제한 상수 추가:
  - `MAX_UPLOAD_BYTES = 5 * 1024 * 1024`
  - `MAX_UPLOAD_MB = 5`
- 프레임 업로드 핸들러(`handleFileUpload`)에 크기 검사 추가.
- 오버레이 업로드 핸들러(`handleOverlayFileChange`)에 크기 검사 추가.
- 업로드 실패/초과/변환 실패 시 `uploadErrorMessage` 상태로 사용자 메시지 렌더링.
- 레이어 패널 하단에 업로드 오류 배너를 표시해 업로드 제약을 즉시 알리도록 반영.

## 5. Risks and Considerations

- 이미지가 5MB를 넘으면 업로드가 차단되며 현재는 변환 단계 진입 자체를 막는다.
- 모바일 저사양 기기에서 `imagetracerjs`/캔버스 메모리 소모로 인해 큰 해상도(5MB 미만이더라도)에서 처리 지연이 발생할 수 있다.
- GIF 작업은 클라이언트 처리이며 `public/gif.worker.js`의 CDN 의존성은 현재 로컬 번들 스크립트 복사본으로 제거되어 오프라인/온디바이스 처리 일치성이 높아졌다.

- 업로드/내보내기 처리 중에는 현재 상태 메시지를 노출하고, 비지원 브라우저에서는 동작이 차단되며 사용자에게 기기 처리 기반 제약 안내를 표시하는 흐름을 반영.

## 6. Execution Plan (1차 구현)

### In Scope

1. 업로드 크기 제한 상수 및 검사 로직 적용 완료 (`app/page.tsx`).
2. 사용자 피드백 메시지 표시 및 클리어 플로우 정리.
3. 기본 빌드/타입체크 검증.
4. GIF 워커 자산의 로컬 번들링 전환(기존 CDN 의존성 제거)
   - 가능성: 높음, 적용 완료.
5. 업로드/내보내기 로컬 처리 진행 상태 및 브라우저 지원 범위 가드 추가.
   - 적용 완료.
6. 오버레이/프레임 썸네일 자동 리사이징 전략(클라이언트 압축)

### Out of Scope(현재)

1. 파일 업로드 거부된 큰 파일에 대한 자동 압축 후 업로드 재시도 로직
   - 이유: 사용자에게 초과 제한을 명시하고, 업로드 성공률보다 제한 준수/명확한 오류 UX 우선.

## 7. Acceptance Criteria

- 프레임 업로드에서 5MB 초과 파일은 즉시 등록되지 않고 에러 메시지가 노출된다.
- 오버레이 업로드도 동일한 상한이 적용된다.
- 기존 SVG 업로드/래스터 변환/보일링 애니메이션/내보내기 동작은 기존과 동일하게 동작한다.
- 새 코드에 대한 `bun run lint`, `bun run typecheck`, `bun run build` 통과.
- 필요 시 수동 Smoke Test에서 업로드 실패/성공 케이스를 확인한다.
