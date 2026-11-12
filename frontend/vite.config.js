import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true },
  css: { postcss: { plugins: [tailwindcss('./tailwind.config.js'), autoprefixer()] } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
