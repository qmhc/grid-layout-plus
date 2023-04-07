import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInject from 'vite-plugin-css-injected-by-js'
import autoprefixer from 'autoprefixer'

export default defineConfig(async () => {
  return {
    resolve: {
      alias: [
        { find: /^@\/(.+)/, replacement: resolve(__dirname, 'src/$1') }
      ]
    },
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
      outDir: 'es',
      sourcemap: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es']
      },
      rollupOptions: {
        input: [resolve(__dirname, 'src/index.ts')],
        external: ['vue'],
        output: [
          {
            format: 'cjs',
            preserveModules: true,
            preserveModulesRoot: resolve(__dirname, 'src'),
            dir: 'lib',
            entryFileNames: '[name].js'
          },
          {
            format: 'es',
            preserveModules: true,
            preserveModulesRoot: resolve(__dirname, 'src'),
            dir: 'es',
            entryFileNames: '[name].mjs'
          }
        ]
      },
      commonjsOptions: {
        sourceMap: false
      }
    },
    plugins: [vue(), cssInject()]
  }
})
