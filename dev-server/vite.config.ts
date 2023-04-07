import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'

export default defineConfig(async () => {
  return {
    resolve: {
      alias: [
        { find: /^@\/(.+)/, replacement: resolve(__dirname, '../src/$1') }
      ]
    },
    css: {
      postcss: {
        plugins: [autoprefixer]
      }
    },
    server: {
      port: 7888,
      fs: {
        allow: ['..']
      }
    },
    plugins: [vue()]
  }
})
