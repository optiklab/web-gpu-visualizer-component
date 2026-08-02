import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dts({
    tsconfigPath: './tsconfig.app.json',
    include: ['src/core', 'src/renderers', 'src/index.ts', 'src/react'],
    exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  })],
  build: {
    copyPublicDir: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    environment: 'node',
  },
})
