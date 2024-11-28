import '../src/style.scss'

import { createApp } from 'vue'

import { GridItem, GridLayout } from '../src'
import App from './app.vue'
import { router } from './router'

createApp(App)
  .component('GridLayout', GridLayout)
  .component('GridItem', GridItem)
  .use(router)
  .mount('#app')
