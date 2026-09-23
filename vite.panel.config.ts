import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import JavaScriptObfuscator from 'javascript-obfuscator';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [react(), {
    name: 'fiveiso-protected-release',
    apply: 'build',
    renderChunk(code) {
      return { code: JavaScriptObfuscator.obfuscate(code, {
        target: 'browser', compact: true, renameGlobals: false, sourceMap: false,
        stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 0.65,
        controlFlowFlattening: false,
      }).getObfuscatedCode(), map: null };
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: { port: 3000, proxy: { '/api': 'http://127.0.0.1:3030' } },
});
