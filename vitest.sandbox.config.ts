import { defineConfig } from 'vitest/config';

// The sandbox tests (e2e/*.sandbox.test.ts) need .agentflow/sandbox.json from `pnpm af deploy --sandbox`,
// so `pnpm test` never runs them; `pnpm test:sandbox` does.
// One file at a time: the sandbox's workflow runner takes 7-18 s per run, and files in parallel queue behind each other.
export default defineConfig({ test: { include: ['e2e/**/*.sandbox.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 420_000, hookTimeout: 420_000 } });
