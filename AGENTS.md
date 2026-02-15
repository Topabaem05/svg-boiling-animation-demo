# Repository Agent Guide (boling)

This repository is primarily a Next.js (App Router) TypeScript project, with a separate Expo-based prototype under `mobile/`.

No Cursor rules or GitHub Copilot instruction files were found:
- No `.cursorrules`
- No `.cursor/rules/`
- No `.github/copilot-instructions.md`

## Commands (root)

All commands below are defined in `package.json`.

```bash
# Install
bun install

# Dev server (uses separate dist dir: .next-dev)
bun run dev

# Clean dev/prod build artifacts
bun run clean

# Production build
bun run build

# Lint (Next.js ESLint preset)
bun run lint

# Typecheck (runs build first, then tsc --noEmit)
bun run typecheck

# CI-style verification (lint + typecheck)
bun run verify

# Run prod server after build
bun run start
```

Where to verify the above:
- `package.json`
- `README.md`

## Tests

There is currently no test runner configured:
- No `test` script in `package.json`
- No `*.test.*`, `*.spec.*`, or `__tests__/` files found

So there is no supported “run a single test” command yet.

## Mobile (Expo prototype)

Commands are defined in `mobile/package.json`:

```bash
cd mobile
npm install
npm run start
npm run android
npm run ios
npm run web
```

Note: the root project uses Bun scripts; `mobile/` uses npm (via `package-lock.json`).

## Project Layout

- `app/` Next.js App Router entrypoints
  - `app/layout.tsx` Root layout / metadata
  - `app/page.tsx` Main interactive demo (client component)
- `components/` UI components (includes shadcn/ui generated components)
- `hooks/` Client hooks
- `lib/` Shared utilities (notably `lib/utils.ts` with `cn()`)
- `types/` Ambient type declarations (e.g. `types/gif.d.ts`)
- `public/` Static assets (SVGs, worker scripts)
- `mobile/` Expo-based reference implementation

## TypeScript + Build Notes

- TypeScript is configured as strict: `tsconfig.json` sets `strict: true`.
- Internal path alias is available: `@/*` maps to repo root (`tsconfig.json` `compilerOptions.paths`).
- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.
  - This means `bun run build` may succeed even with TS errors.
  - Use `bun run typecheck` (tsc --noEmit) to catch TS issues.

## Code Style (match repo conventions)

### Formatting

Observed patterns across TS/TSX files:
- Semicolon-free style is common.
- Indentation is 2 spaces.
- Quotes are mixed (some files use single quotes, many use double quotes). Prefer matching the file you are editing.
- No Prettier/Biome config is present; avoid sweeping format-only changes.

### Imports

Common import organization (see `components/ui/button.tsx`, `lib/utils.ts`, `hooks/use-toast.ts`):
- External imports first.
- Then internal imports using `@/` alias.
- Use `import type` for type-only imports where it improves clarity.

Example patterns:
- `lib/utils.ts` imports external modules and exports small named helpers.
- `components/ui/use-toast.ts` uses `import type { ... }` for UI types.

### Naming

- React components: PascalCase (e.g. `ThemeProvider`, `Button`).
- Hooks: `useX` naming (e.g. `hooks/use-toast.ts`).
- Constants: SCREAMING_SNAKE_CASE for fixed limits/delays (e.g. `TOAST_LIMIT`).
- Prefer descriptive names over abbreviations. Short helpers are fine when established (e.g. `cn`).

### React / Next.js

- Client components start with the directive on the first line:
  - `"use client"`
  - See `app/page.tsx`, `hooks/use-toast.ts`, `components/ui/use-toast.ts`.
- Avoid importing server-only modules into client components.
- Prefer `next/image` for images in Next.js code (see `app/page.tsx`).

### Error Handling and Safety

Observed patterns:
- Reducer/state logic tends to guard and early-return rather than throwing (see toast implementations).
- Some code logs errors with `console.error` in client flows (see `app/page.tsx`).

Guidelines for changes:
- Do not add TypeScript suppression (`@ts-ignore`, `@ts-expect-error`) or unsafe casting (`as any`).
- Handle nullable values explicitly (optional chaining, early returns).
- If you add try/catch, log or surface errors; do not use empty catch blocks.

### Styling (Tailwind + CSS)

- Tailwind is enabled via `@import 'tailwindcss';` in `app/globals.css`.
- UI components use Tailwind class strings and `cn()` helper (`lib/utils.ts`).
- Global theme tokens are CSS variables in `app/globals.css`.

## Verification Checklist (before calling work “done”)

```bash
# From repo root
bun run lint
bun run typecheck
bun run build
```

If your change affects runtime behavior (especially `app/page.tsx`):
- Start dev server: `bun run dev`
- Smoke test core flows described in `README.md` (upload, dial interaction, export)

## What NOT to do

- Do not introduce new package managers or lockfiles.
- Do not reformat large files without a functional reason.
- Do not commit unless explicitly requested.
