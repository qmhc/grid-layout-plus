import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInject from 'vite-plugin-css-injected-by-js'
import autoprefixer from 'autoprefixer'

interface Manifest {
  dependencies?: Record<string, string>,
  peerDependencies?: Record<string, string>,
  version?: string
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as Manifest

const externalPkgs = ['@vue'].concat(
  Object.keys(pkg.dependencies || {}),
  Object.keys(pkg.peerDependencies || {})
)
const external = (id: string) => externalPkgs.some(p => p === id || id.startsWith(`${p}/`))

export default defineConfig(async () => {
  return {
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
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es']
      },
      rollupOptions: {
        input: [resolve(__dirname, 'src/index.ts')],
        external,
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
