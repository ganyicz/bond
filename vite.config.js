import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'js/vite.js',
      name: 'BondVitePlugin',
      fileName: 'vite-plugin',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'fs',
        'path',
        'typescript'
      ]
    },
    outDir: 'dist',
    target: 'node14',
    minify: false
  }
})
