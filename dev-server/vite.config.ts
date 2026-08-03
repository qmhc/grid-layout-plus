import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'

import type { Plugin } from 'vite'

function contractSsrFixturePlugin(): Plugin {
  const variants = new Set([
    'unresolved',
    'responsive-explicit',
    'hydration-match',
    'hydration-mismatch',
    'strategy-failure',
  ])

  return {
    name: 'grid-layout-plus-contract-ssr-fixture',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url || '/', 'http://localhost')
        if (requestUrl.pathname !== '/__e2e/contracts/ssr') {
          next()
          return
        }

        try {
          const fixture = (await server.ssrLoadModule('/e2e/ssr-fixture.ts')) as {
            renderSsrFixture(variant: string): Promise<{
              input: Record<string, unknown>
              markup: string
            }>
          }
          const requestedVariant = requestUrl.searchParams.get('variant') || 'unresolved'
          const variant = variants.has(requestedVariant) ? requestedVariant : 'unresolved'
          const { input, markup } = await fixture.renderSsrFixture(variant)
          const serializedInput = JSON.stringify(input).replaceAll('<', '\\u003c')
          const html = await server.transformIndexHtml(
            request.url || requestUrl.pathname,
            `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Grid Layout Plus SSR Contract Fixture</title>
  </head>
  <body>
    <div id="app">${markup}</div>
    <script id="contract-ssr-input" type="application/json">${serializedInput}</script>
    <script type="module" src="/e2e/ssr-client.ts"></script>
  </body>
</html>`,
          )

          response.statusCode = 200
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(html)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

export default defineConfig(async () => {
  return {
    css: {
      postcss: {
        plugins: [autoprefixer],
      },
    },
    server: {
      port: 7888,
      fs: {
        allow: ['..'],
      },
    },
    resolve: {
      alias: {
        'grid-layout-plus': resolve(import.meta.dirname, '../src'),
      },
    },
    plugins: [contractSsrFixturePlugin(), vue()],
  }
})
