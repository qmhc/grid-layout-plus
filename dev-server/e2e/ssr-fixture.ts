import { createSSRApp, defineComponent, h, nextTick, onMounted, ref } from 'vue'

import { renderToString } from 'vue/server-renderer'

import GridLayout from '../../src/components/grid-layout.vue'

import type { DefineComponent, PropType } from 'vue'
import type {
  Breakpoints,
  Layout,
  PositionStrategy,
  ReadonlyLayout,
  ResponsiveLayoutsInput,
} from '../../src/helpers/types'
import type { GridLayoutProps } from '../../src/components/types'

type SsrBreakpoint = 'lg' | 'sm' | 'xxs'
type SsrResponsiveLayouts = Partial<Record<SsrBreakpoint, Layout>>

// Vue SFC 导出固定为默认断点；fixture 按公开泛型 props 适配自定义断点。
const SsrGridLayout = GridLayout as unknown as DefineComponent<GridLayoutProps<SsrBreakpoint>>

export interface SsrFixtureInput {
  variant: string
  width?: number
  responsive: boolean
  layout: Layout
  responsiveLayouts: ResponsiveLayoutsInput<SsrBreakpoint>
  breakpoints: Breakpoints<SsrBreakpoint>
  cols: Breakpoints<SsrBreakpoint>
  strategyFailure: boolean
}

const breakpoints: Breakpoints<SsrBreakpoint> = { lg: 1000, sm: 600, xxs: 0 }
const cols: Breakpoints<SsrBreakpoint> = { lg: 12, sm: 6, xxs: 2 }

function item(w: number, x = 0): Layout[number] {
  return { i: 'ssr-item', x, y: 0, w, h: 1 }
}

function completeLayouts(smWidth: number): SsrResponsiveLayouts {
  return {
    lg: [item(2)],
    sm: [item(smWidth)],
    xxs: [item(1)],
  }
}

export function createSsrFixtureInput(variant: string): SsrFixtureInput {
  const base: SsrFixtureInput = {
    variant,
    responsive: false,
    layout: [item(2)],
    responsiveLayouts: {},
    breakpoints,
    cols,
    strategyFailure: false,
  }

  if (variant === 'responsive-explicit') {
    return {
      ...base,
      width: 700,
      responsive: true,
      responsiveLayouts: completeLayouts(1),
    }
  }

  if (variant === 'hydration-match') {
    return {
      ...base,
      width: 700,
      responsive: true,
      layout: [item(1)],
      responsiveLayouts: completeLayouts(1),
    }
  }

  if (variant === 'hydration-mismatch') {
    return {
      ...base,
      width: 700,
      responsive: true,
      layout: [item(2)],
      responsiveLayouts: completeLayouts(1),
    }
  }

  if (variant === 'strategy-failure') {
    return {
      ...base,
      width: 800,
      strategyFailure: true,
    }
  }

  return base
}

function cloneLayout(layout: ReadonlyLayout): Layout {
  return layout.map(entry => ({ ...entry }))
}

function cloneLayouts(layouts: ResponsiveLayoutsInput<SsrBreakpoint>): SsrResponsiveLayouts {
  return Object.fromEntries(
    Object.entries(layouts).map(([key, value]) => [key, value ? cloneLayout(value) : value]),
  ) as SsrResponsiveLayouts
}

export const SsrFixture = defineComponent({
  name: 'SsrContractFixture',
  props: {
    input: {
      type: Object as PropType<SsrFixtureInput>,
      required: true,
    },
  },
  setup(props) {
    const hydrated = ref(false)
    const eventOrder = ref<string[]>([])
    const model = ref(cloneLayout(props.input.layout))
    const responsiveModels = ref(cloneLayouts(props.input.responsiveLayouts))
    const activeBreakpoint = ref<string | null>(null)
    const itemIdentityPreserved = ref(false)
    const hydrationInitialState = ref<{
      rootHeight: string
      itemGeometry: Record<string, string>
    } | null>(null)
    const hydrationErrors = ref<string[]>([])
    const runtimeErrors = ref<unknown[]>([])
    const invalidStrategy: PositionStrategy = {
      usesCssTransforms: false,
      getStyle: (top, left, _width, height) => ({
        top: `${top}px`,
        left: `${left}px`,
        width: 'NaNpx',
        height: `${height}px`,
      }),
      getRtlStyle: (top, right, _width, height) => ({
        top: `${top}px`,
        right: `${right}px`,
        width: 'NaNpx',
        height: `${height}px`,
      }),
    }

    function record(name: string) {
      eventOrder.value.push(name)
    }

    function applyLayout(nextLayout: ReadonlyLayout) {
      record('update:layout')
      model.value = cloneLayout(nextLayout)
    }

    function applyResponsiveLayouts(nextLayouts: ResponsiveLayoutsInput<SsrBreakpoint>) {
      record('update:responsive-layouts')
      responsiveModels.value = cloneLayouts(nextLayouts)
    }

    onMounted(async () => {
      for (let index = 0; index < 6; index++) await nextTick()

      const previousItem = (
        globalThis as typeof globalThis & {
          __GLP_SSR_ITEM__?: Element | null
        }
      ).__GLP_SSR_ITEM__
      itemIdentityPreserved.value =
        previousItem != null && previousItem === document.querySelector('.vgl-item')
      hydrationInitialState.value =
        (
          globalThis as typeof globalThis & {
            __GLP_SSR_INITIAL_STATE__?: {
              rootHeight: string
              itemGeometry: Record<string, string>
            }
          }
        ).__GLP_SSR_INITIAL_STATE__ ?? null
      hydrationErrors.value = [
        ...(
          globalThis as typeof globalThis & {
            __GLP_SSR_HYDRATION_ERRORS__?: string[]
          }
        ).__GLP_SSR_HYDRATION_ERRORS__!,
      ]
      hydrated.value = true
    })

    return () =>
      h(
        'main',
        {
          'data-contract-ssr-fixture': '',
          'data-ssr-variant': props.input.variant,
          'data-hydrated': String(hydrated.value),
          'data-event-order': JSON.stringify(eventOrder.value),
          'data-layout-state': JSON.stringify(model.value),
          'data-responsive-layouts-state': JSON.stringify(responsiveModels.value),
          'data-active-breakpoint': activeBreakpoint.value,
          'data-runtime-errors': JSON.stringify(runtimeErrors.value),
          'data-hydration-initial-state': JSON.stringify(hydrationInitialState.value),
          'data-hydration-errors': JSON.stringify(hydrationErrors.value),
          'data-item-identity-preserved': String(itemIdentityPreserved.value),
          style: { width: '800px' },
        },
        [
          h(
            SsrGridLayout,
            {
              layout: model.value,
              width: props.input.width,
              responsive: props.input.responsive,
              responsiveLayouts: responsiveModels.value,
              breakpoints: props.input.breakpoints,
              cols: props.input.cols,
              rowHeight: 40,
              gap: [10, 10],
              containerPadding: [10, 10],
              positionStrategy: props.input.strategyFailure ? invalidStrategy : undefined,
              onLayoutMounted: () => record('layout-mounted'),
              onLayoutReady: () => record('layout-ready'),
              onLayoutUpdated: () => record('layout-updated'),
              onWidthChanged: () => record('width-changed'),
              onBreakpointChanged: (breakpoint: string | null) => {
                activeBreakpoint.value = breakpoint
                record('breakpoint-changed')
              },
              'onUpdate:layout': applyLayout,
              'onUpdate:responsive-layouts': applyResponsiveLayouts,
              onError: (error: unknown) => {
                runtimeErrors.value.push(error)
                record('error')
              },
            },
            {
              item: ({ item: slotItem }: { item: Layout[number] }) =>
                h(
                  'span',
                  {
                    'data-ssr-item': slotItem.i,
                    'data-item-snapshot': JSON.stringify(slotItem),
                  },
                  `${slotItem.i}:${slotItem.w}`,
                ),
            },
          ),
        ],
      )
  },
})

export async function renderSsrFixture(variant: string) {
  const input = createSsrFixtureInput(variant)
  const markup = await renderToString(createSSRApp(SsrFixture, { input }))
  return { input, markup }
}
