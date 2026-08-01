import '../src/style.scss'
import 'vexip-ui/css/index.css'
import 'vexip-ui/css/dark/index.css'
import '../docs/demos/shared.css'

import { createApp } from 'vue'

import { install } from 'vexip-ui'

import { GridItem, GridLayout } from '../src'
import App from './app.vue'
import { router } from './router'

createApp(App)
  .component('GridLayout', GridLayout)
  .component('GridItem', GridItem)
  .use(install)
  .use(router)
  .mount('#app')
