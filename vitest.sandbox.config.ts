import { defineConfig } from 'vitest/config';

// The sandbox tests (e2e/*.sandbox.test.ts) need .agentflow/sandbox.json from `pnpm af deploy --sandbox`,
// so `pnpm test` never runs them; `pnpm test:sandbox` does.
export default defineConfig({ test: { include: ['e2e/**/*.sandbox.test.ts'], environment: 'node', testTimeout: 180_000 } });
