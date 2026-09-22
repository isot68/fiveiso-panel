import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({ css: { postcss: { plugins: [tailwindcss()] } }, server: { proxy: { '/api': 'http://127.0.0.1:3030' } }, plugins: [vinext(),sites()] });
