import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The UI module of the pl, for the package's ui/: one ES entry exporting `mount`, its chunks beside it, the
// stylesheet inside the script and React bundled, since a host shares nothing with a module but plain data and functions.
// `agentflow-app build` writes it into package/ui/. `pnpm demo` serves module.html with this same config.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  // Library mode leaves process.env.NODE_ENV for a consumer's bundler to replace; a browser importing the file has no `process`.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  server: { port: 5174, strictPort: true, host: 'localhost' },
  build: {
    outDir: 'package/ui',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/module/module.tsx', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rolldownOptions: { output: { chunkFileNames: 'chunks/[name]-[hash].js' } },
  },
});
