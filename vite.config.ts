import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  base: '/village-case/',
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    root: 'src',
  },
});
