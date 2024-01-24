<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// import 'vexip-ui/es/css/grid'
// import 'vexip-ui/es/css/cell'

const router = useRouter()
const panelShow = ref(false)
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component"></component>
  </RouterView>
  <button
    :class="['dev-setting', panelShow && 'dev-setting--active']"
    type="button"
    tabindex="-1"
    @click="panelShow = !panelShow"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path
        d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"
      />
    </svg>
  </button>
  <Transition name="vxp-fade">
    <div v-show="panelShow" class="dev-panel">
      <div class="dev-panel__container">
        <div class="dev-links">
          <template v-for="route in router.options.routes">
            <RouterLink
              v-if="route.name"
              :key="route.path"
              class="router-link"
              :to="route.path"
              @click="panelShow = false"
            >
              {{ route.name }}
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss">
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  --bg-color: #fff;

  height: 100%;

  &.dark {
    --bg-color: #131719;
  }

  &.rtl {
    direction: rtl;
  }
}

body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  font-family: var(--vxp-font-family-base);
  font-size: var(--vxp-font-size-base);
  font-variant-numeric: tabular-nums;
  line-height: var(--vxp-line-height-base);
  color: var(--vxp-content-color-base);
  background-color: var(--bg-color);
  transition: var(--vxp-transition-background);
}

#app {
  height: 100%;
  overflow: auto;
}

.padding #app {
  padding: 20px;
}

.dev-setting {
  position: absolute;
  inset-inline-end: 20px;
  bottom: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  color: var(--vxp-content-color-base);
  cursor: pointer;
  background-color: var(--vxp-fill-color-background);
  border: 0;
  border-radius: 50%;
  outline: 0;
  box-shadow: var(--vxp-shadow-base);
  transition: var(--vxp-transition-color);

  &--active {
    color: var(--vxp-color-primary-base);
  }

  svg {
    width: 1.3em;
    height: 1.3em;
    line-height: 1;
    vertical-align: -0.125em;
    fill: currentcolor;
  }
}

.dev-panel {
  position: absolute;
  inset-inline-end: 20px;
  bottom: 70px;
  z-index: 9999;
  padding: 4px 0;
  overflow: hidden;
  background-color: var(--vxp-fill-color-background);
  border-radius: var(--vxp-radius-base);

  &__container {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: calc(100vh - 128px);
    padding: 20px;
    overflow: hidden auto;
    scrollbar-width: thin;
    scrollbar-color: var(--vxp-color-primary-opacity-8) transparent;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--vxp-color-primary-opacity-8);
      border-radius: 4px;
    }
  }
}

.dev-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 180px;

  .router-link {
    padding: 7px 10px 8px;
    line-height: 1;
    color: var(--vxp-color-primary-base);
    text-decoration: none;
    background-color: var(--vxp-bg-color-base);
    border: 1px solid var(--vxp-color-primary-opacity-6);
    border-radius: var(--vxp-radius-base);
    transition: var(--vxp-transition-background);

    &:hover {
      background-color: var(--vxp-color-primary-opacity-9);
    }

    &-active,
    &-active:hover {
      background-color: var(--vxp-color-primary-opacity-8);
    }
  }
}
</style>
