# Docker Compose Debugger

## Build
npm install && npm run build

## Dev
npm run dev

## Test
npm run test

## Lint
npx tsc --noEmit

## Architecture
Vite + vanilla TypeScript. js-yaml bundled. Single-file output via vite-plugin-singlefile.
All source in src/. Tests in tests/.
Never use innerHTML — always textContent or createElement.
Immutable data patterns — never mutate parsed input, always create new objects.
