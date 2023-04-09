import { createRouter, createWebHashHistory } from 'vue-router'

document.title = 'dev | Grid Layout Plus'

const demos = import.meta.glob('../docs/demos/*.vue')

export const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    ...Object.keys(demos).map(path => {
      const name = path.split('/').at(-1)!.replace(/.vue$/, '')

      return {
        path: name === 'basic' ? '/' : `/${name}`,
        name,
        component: demos[path]
      }
    }),
    {
      path: '/:catchAll(.*)',
      redirect: '/'
    }
  ]
})

router.afterEach(to => {
  document.title = `select - ${typeof to.name === 'string' ? to.name : 'dev'} | Grid Layout Plus`
})
