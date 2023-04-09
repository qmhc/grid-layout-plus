import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'

export default defineConfig(async () => {
  return {
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
