import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'

interface Manifest {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  version?: string
}

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8'),
) as Manifest

const externalPkgs = ['@vue'].concat(
  Object.keys(pkg.dependencies || {}),
  Object.keys(pkg.peerDependencies || {}),
)
const external = (id: string) => externalPkgs.some(p => p === id || id.startsWith(`${p}/`))

export default defineConfig({
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log'],
  },
  css: {
    postcss: {
      plugins: [autoprefixer],
    },
  },
  build: {
    outDir: 'es',
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      cssFileName: 'style',
    },
    rollupOptions: {
      input: [
        resolve(import.meta.dirname, 'src/index.ts'),
        resolve(import.meta.dirname, 'src/core.ts'),
      ],
      external,
      output: [
        {
          format: 'cjs',
          preserveModules: true,
          preserveModulesRoot: resolve(import.meta.dirname, 'src'),
          dir: 'lib',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs',
        },
        {
          format: 'es',
          preserveModules: true,
          preserveModulesRoot: resolve(import.meta.dirname, 'src'),
          dir: 'es',
          entryFileNames: '[name].mjs',
        },
      ],
    },
    commonjsOptions: {
      sourceMap: false,
    },
  },
  plugins: [vue()],
})
