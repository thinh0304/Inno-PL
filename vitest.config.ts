import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Node by default; a test that needs a DOM says so with a `// @vitest-environment jsdom` first line.
  test: { include: ['test/**/*.test.{ts,tsx}'], environment: 'node' },
});
