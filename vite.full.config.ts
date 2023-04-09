import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import cssInject from 'vite-plugin-css-injected-by-js'
import autoprefixer from 'autoprefixer'

export default defineConfig(async () => {
  return {
    publicDir: false,
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log']
    },
    css: {
      postcss: {
        plugins: [autoprefixer]
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es', 'cjs', 'iife'],
        name: 'GridLayoutPlus',
        fileName: format => `grid-layout-plus.${format === 'es' ? 'mjs' : format === 'cjs' ? 'cjs' : 'js'}`
      },
      rollupOptions: {
        external: ['vue'],
        output: {
          globals: {
            vue: 'Vue'
          }
        }
      },
      commonjsOptions: {
        sourceMap: false
      },
      chunkSizeWarningLimit: 10000
    },
    plugins: [
      vue(),
      cssInject(),
      dts({
        exclude: ['node_modules', 'dev-server', 'scripts']
      })
    ]
  }
})
