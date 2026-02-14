# SVG Boiling Animation Demo (Next.js)

이 프로젝트는 기존 `svg-boiling-animation-demo` 프로토타입을
브라우저에서 바로 동작하는 Next.js 웹 앱으로 전환한 버전입니다.

## 구현 범위

- 모바일 기기 기준 레이아웃(393x852)을 유지하면서, 화면 크기에 따라 반응형으로 스케일링.
- `app/page.tsx`에서 SVG 보일링 애니메이션, 업로드/설정/업데이트 동작, GIF/Animated SVG 내보내기를 동작하도록 구성.
- 파일 업로드(`.svg`, `.png`, `.jpg`, `.jpeg`) 지원.
- Vercel 배포를 고려한 메타데이터·빌드 설정 정리.
- 코드 안정성 향상을 위해 ESLint/Toast 유틸 타입 안정성 오류 정리.

## 실행 방법

```bash
bun install
bun run dev
```

브라우저에서 `http://localhost:3000`을 열어 동작을 확인하세요.

## 빌드

```bash
bun run build
```

정적 페이지(`/`)가 정상 생성되면 빌드 통과입니다.

## 배포(Vercel)

1. 변경 사항을 커밋하고 GitHub에 푸시
2. Vercel에서 새 프로젝트 생성 후 해당 레포지토리 연결
3. Framework는 `Next.js`로 자동 감지
4. 기본 빌드/설치 명령은 그대로 사용
   - Install: `bun install`
   - Build: `bun run build`
5. 기본 데모에는 별도 환경변수 없음

## 테스트/검증

- `bun run lint`를 통해 정적 분석 경고를 확인할 수 있습니다.
- 테스트 파일은 현재 저장소에 별도로 없으므로, 자동 테스트는 없어도 정상 동작 확인은 빌드 및 직접 브라우저 점검으로 진행했습니다.

## 폴더 참고

- `index.html`, `mobile/` 등은 원본 프로토타입 참고용으로 보존되어 있으며, Next.js 앱 라우트에서는 사용되지 않습니다.
