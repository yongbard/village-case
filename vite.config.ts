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
    // 로컬 PC 코어의 절반까지만 쓴다
    poolOptions: {
      threads: { maxThreads: 10, minThreads: 1 },
      forks: { maxForks: 10, minForks: 1 },
    },
  },
});
