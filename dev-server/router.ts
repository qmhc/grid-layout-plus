import { createRouter, createWebHashHistory } from 'vue-router'

document.title = 'dev | Grip Layout Plus'

export const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      name: 'basic',
      component: () => import('../docs/demos/basic.vue')
    }
  ]
})

router.afterEach(to => {
  document.title = `select - ${typeof to.name === 'string' ? to.name : 'dev'} | Grip Layout Plus`
})
