<script setup lang="ts">
/* eslint-disable vue/html-indent, vue/max-attributes-per-line, vue/singleline-html-element-content-newline */
import { computed, nextTick, onErrorCaptured, ref } from 'vue'
import { useRoute } from 'vue-router'

import GridBackground from '../../src/components/grid-background.vue'
import {
  absoluteStrategy,
  scaledStrategy,
  transformStrategy,
} from '../../src/core/position-strategies'
import { verticalCompactor } from '../../src/core/compactors'
import { GridLayoutValidationError } from '../../src/core/errors'

import type {
  Breakpoints,
  CollisionMode,
  Compactor,
  Layout,
  PositionStrategy,
  ResponsiveLayout,
} from '../../src/helpers/types'

const route = useRoute()

const contractsByPhase = {
  'phase-0': ['E2E-00'],
  'phase-2': [
    'E2E-20',
    'E2E-21',
    'E2E-22',
    'E2E-23',
    'E2E-24',
    'E2E-25',
    'E2E-26',
    'E2E-27',
    'E2E-28',
    'E2E-29',
  ],
  'phase-3': ['E2E-30', 'E2E-31', 'E2E-32', 'E2E-33', 'E2E-34', 'E2E-36'],
  'phase-4': ['E2E-40', 'E2E-41', 'E2E-42', 'E2E-43', 'E2E-44', 'E2E-45', 'E2E-46'],
} as const

const controlsByContract: Record<string, readonly string[]> = {
  'E2E-00': ['fixture-ready'],
  'E2E-20': ['programmatic-move', 'ack-mode'],
  'E2E-21': ['high-frequency-drag', 'ack-mode'],
  'E2E-22': ['change-config-during-interaction'],
  'E2E-23': ['item-slot', 'default-slot'],
  'E2E-24': ['focus-target', 'motion-state'],
  'E2E-25': ['unmount-active-grid'],
  'E2E-26': ['mount-standalone-item'],
  'E2E-27': ['resize-handle'],
  'E2E-28': ['programmatic-move', 'metadata-log'],
  'E2E-29': ['high-frequency-drag', 'terminal-log'],
  'E2E-30': ['observer-gate'],
  'E2E-31': ['toggle-width-zero'],
  'E2E-32': ['change-responsive-width'],
  'E2E-33': ['shrink-responsive-cols'],
  'E2E-34': ['toggle-responsive-mode'],
  'E2E-36': ['invalidate-background-width'],
  'E2E-40': ['scaled-drop-target'],
  'E2E-41': ['rtl-drop-target'],
  'E2E-42': ['reject-drop-callback'],
  'E2E-43': ['drop-proposal-log'],
  'E2E-44': ['dynamic-drop-size'],
  'E2E-45': ['geometry-error-log'],
  'E2E-46': ['invalidate-position-strategy'],
}

type FixturePhase = keyof typeof contractsByPhase
type AckMode = 'none' | 'sync' | 'next-tick' | 'nested-next-tick' | 'rewrite' | 'out-of-order'
interface FixtureGridInstance {
  $el?: HTMLElement
  $?: {
    setupState?: FixtureGridTestAdapter
  }
  root?: HTMLElement | null
  moveItem?: (id: string | number, x: number, y: number) => unknown
  resizeItem?: (id: string | number, w: number, h: number) => unknown
}

interface FixtureGridTestAdapter {
  dragEvent: (
    eventName: string,
    id: string | number,
    x: number,
    y: number,
    h: number,
    w: number,
  ) => void
  cancelInteraction: (token: unknown) => unknown
}

const phase = computed<FixturePhase>(() => {
  const value = String(route.params.phase)
  return value in contractsByPhase ? (value as FixturePhase) : 'phase-0'
})
const scenario = computed(() => {
  const requested = String(route.query.scenario || contractsByPhase[phase.value][0])
  return (contractsByPhase[phase.value] as readonly string[]).includes(requested)
    ? requested
    : contractsByPhase[phase.value][0]
})
const variant = computed(() => String(route.query.variant || 'default'))
const controls = computed(() => controlsByContract[scenario.value] || [])
const gridMounted = ref(false)
const showGrid = ref(true)
const showStandaloneItem = ref(false)
const showManualOwner = ref(true)
const standaloneError = ref<Record<string, unknown> | null>(null)
const resourceState = ref<Record<string, unknown>>({})
const dropCallbackTrace = ref<Array<{ args: string }>>([])
const compactorCalls = ref(0)
const ackMode = ref<AckMode>(
  (variant.value === 'drop-sync'
    ? 'sync'
    : variant.value === 'drop-responsive-sync'
      ? 'sync'
      : variant.value === 'drop-responsive-nested-next-tick'
        ? 'nested-next-tick'
        : variant.value === 'drop-timeout'
          ? 'none'
          : ['sync', 'next-tick', 'nested-next-tick', 'rewrite', 'out-of-order'].includes(
                variant.value,
              )
            ? variant.value
            : scenario.value === 'E2E-34' && variant.value === 'resolved-no-ack'
              ? 'none'
              : variant.value.startsWith('aspect-') && variant.value.endsWith('no-ack')
                ? 'none'
                : [
                      'metadata-echo',
                      'committed',
                      'resolved-ack',
                      'active',
                      'pending',
                      'legacy',
                      'multi-direction',
                    ].includes(variant.value) ||
                    variant.value.startsWith('aspect') ||
                    scenario.value === 'E2E-33' ||
                    ['E2E-21', 'E2E-26', 'E2E-32', 'E2E-34'].includes(scenario.value) ||
                    ['E2E-40', 'E2E-41', 'E2E-43', 'E2E-44', 'E2E-46'].includes(scenario.value)
                  ? 'sync'
                  : 'none') as AckMode,
)
const rowHeight = ref(40)
const gap = ref<[number, number]>([10, 10])
const containerPadding = ref<[number, number]>([10, 10])
const explicitWidth = ref<number | undefined>(
  [
    'unresolved',
    'observer-gate',
    'prop-add',
    'unresolved-explicit',
    'unresolved-observer',
  ].includes(variant.value) || ['E2E-25', 'E2E-30'].includes(scenario.value)
    ? undefined
    : variant.value === 'resolved-zero' || variant.value === 'zero-positive'
      ? 0
      : scenario.value === 'E2E-33'
        ? 400
        : 800,
)
const isDraggable = ref(true)
const isResizable = ref(true)
const isMirrored = ref(false)
const isBounded = ref(variant.value === 'bounded')
const restoreOnDrag = ref(
  variant.value === 'restore' || variant.value === 'aspect-terminal-extension',
)
const maxRows = ref(
  variant.value === 'no-position' ? 1 : variant.value === 'aspect-limit' ? 2 : Infinity,
)
const responsive = ref(
  ['E2E-32', 'E2E-33'].includes(scenario.value) ||
    variant.value.startsWith('drop-responsive-') ||
    ['responsive', 'toggle-off', 'breakpoint', 'breakpoint-invalidation'].includes(variant.value),
)
const collisionMode = ref<CollisionMode>(
  variant.value === 'collision' || variant.value.includes('prevent')
    ? 'prevent'
    : variant.value.includes('overlap')
      ? 'overlap'
      : 'push',
)
const dropCallbackMode = ref<'accept' | 'reject' | 'resize' | 'throw' | 'mutate'>(
  variant.value === 'callback-rejected'
    ? 'reject'
    : variant.value === 'extension-error'
      ? 'throw'
      : variant.value.startsWith('dynamic-')
        ? 'resize'
        : variant.value === 'listener-mutation'
          ? 'mutate'
          : 'accept',
)
const backgroundWidth = ref(400)
const gridRef = ref<FixtureGridInstance | null>(null)

if (scenario.value === 'E2E-34' && variant.value === 'unresolved') {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: undefined,
  })
}
if (
  scenario.value === 'E2E-36' &&
  ['unresolved-explicit', 'unresolved-observer'].includes(variant.value)
) {
  class SilentResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: SilentResizeObserver,
  })
}

function getGridTestAdapter(): FixtureGridTestAdapter | null {
  return (gridRef.value?.$?.setupState as FixtureGridTestAdapter | undefined) ?? null
}
const eventLog = ref<Array<{ name: string; args: string }>>([])
const layout = ref<Layout>([
  {
    i: 'fixture-a',
    x: variant.value === 'multi-direction' ? 4 : 0,
    y: variant.value === 'multi-direction' ? 4 : 0,
    w: variant.value === 'multi-direction' ? 4 : scenario.value === 'E2E-33' ? 1 : 2,
    h: variant.value === 'multi-direction' ? 3 : 1,
    static: variant.value === 'no-position',
    ...(variant.value === 'multi-direction'
      ? { resizeHandles: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const }
      : {}),
    ...(variant.value === 'aspect-limit' ? { minW: 2, minH: 1, maxW: 4, maxH: 4 } : {}),
  },
  {
    i: 'fixture-b',
    x:
      variant.value === 'multi-direction'
        ? 4
        : variant.value === 'aspect-limit'
          ? 6
          : scenario.value === 'E2E-33'
            ? 1
            : scenario.value === 'E2E-41' && variant.value.includes('rtl')
              ? 8
              : 2,
    y: 0,
    w:
      variant.value === 'multi-direction'
        ? 4
        : variant.value === 'no-position'
          ? 10
          : scenario.value === 'E2E-33'
            ? 1
            : 2,
    h: variant.value === 'multi-direction' ? 4 : 1,
    static: variant.value === 'no-position',
  },
])
const breakpoints = ref<Breakpoints>({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 })
const cols = ref<Breakpoints>({ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 })
const responsiveDropLayouts = variant.value.startsWith('drop-responsive-')
  ? (Object.fromEntries(
      Object.entries(cols.value).map(([breakpoint, colNum]) => [
        breakpoint,
        layout.value.map((item, index) => {
          const w = colNum <= 2 ? 1 : Math.min(item.w, 2)
          return { ...item, x: Math.min(index * w, colNum - w), w }
        }),
      ]),
    ) as ResponsiveLayout)
  : null
const responsiveLayouts = ref<Partial<ResponsiveLayout>>(
  responsiveDropLayouts ?? {
    lg:
      variant.value === 'author-generated'
        ? layout.value.map(item => ({ ...item }))
        : layout.value.map((item, index) => ({ ...item, x: index * 2, w: 2 })),
    ...(variant.value === 'author-generated'
      ? {}
      : {
          xxs: layout.value.map((item, index) => ({ ...item, x: index, w: 1 })),
        }),
  },
)
const initialAuthorLayouts = responsiveLayouts.value
const scale = Number(variant.value.match(/(?:^|-)scale-(0\.5|1|2)(?:-|$)/)?.[1] ?? 2)
const positionStrategy = ref<PositionStrategy>(
  scenario.value === 'E2E-40' || variant.value.includes('scale-')
    ? scaledStrategy(scale)
    : transformStrategy,
)
const countingCompactor: Compactor = {
  type: verticalCompactor.type,
  compact(nextLayout, colNum) {
    compactorCalls.value += 1
    return verticalCompactor.compact(nextLayout, colNum)
  },
}
const terminalExtensionCompactor: Compactor = {
  type: 'vertical',
  compact(candidate, colNum) {
    const active = candidate.find(item => item.i === 'fixture-a')
    if (active && active.x > 0 && !active.static) {
      throw new Error('terminal compactor failure')
    }
    return verticalCompactor.compact(candidate, colNum)
  },
}
if (variant.value.includes('rtl')) {
  document.documentElement.dir = 'rtl'
}
const futureProps = computed(() => ({
  width: explicitWidth.value,
  containerPadding: containerPadding.value,
}))
const dropConfig = computed(() => ({
  isDroppable: true,
  dropItem: { w: 1, h: 1 },
  createItem: () => ({ i: 'drop-commit', x: 0, y: 0, w: 1, h: 1 }),
  onDragOver: (...args: unknown[]) => {
    dropCallbackTrace.value.push({ args: serialize(args) })
    record('fixture-drop-callback', ...args)
    if (dropCallbackMode.value === 'reject') return false
    if (dropCallbackMode.value === 'throw') throw new Error('drop callback failure')
    if (dropCallbackMode.value === 'resize') return { w: 2, h: 2 }
    if (dropCallbackMode.value === 'mutate') {
      const input = args[0] as { nativeEvent?: DragEvent } | undefined
      input?.nativeEvent?.preventDefault()
      if (input?.nativeEvent?.dataTransfer) input.nativeEvent.dataTransfer.dropEffect = 'move'
    }
    return {}
  },
}))
const containerStyle = computed(() => {
  return scenario.value === 'E2E-40' || variant.value.includes('scale-')
    ? {
        width: '800px',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }
    : { width: '800px' }
})

function serialize(value: unknown): string {
  const seen = new WeakSet<object>()

  return JSON.stringify(value, (_key, current) => {
    if (current instanceof Event) {
      return {
        type: current.type,
        defaultPrevented: current.defaultPrevented,
        clientX: current instanceof MouseEvent ? current.clientX : null,
        clientY: current instanceof MouseEvent ? current.clientY : null,
        dropEffect:
          current instanceof DragEvent && current.dataTransfer
            ? current.dataTransfer.dropEffect
            : null,
      }
    }
    if (typeof current === 'object' && current !== null) {
      const interaction = current as {
        type?: unknown
        clientX?: unknown
        clientY?: unknown
      }
      if (
        typeof interaction.type === 'string' &&
        /^(?:drag|resize)(?:start|move|end)$/.test(interaction.type) &&
        typeof interaction.clientX === 'number' &&
        typeof interaction.clientY === 'number'
      ) {
        return {
          type: interaction.type,
          clientX: interaction.clientX,
          clientY: interaction.clientY,
        }
      }
    }
    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) return '[Circular]'
      seen.add(current)
    }
    return current
  })
}

function record(name: string, ...args: unknown[]) {
  eventLog.value.push({ name, args: serialize(args) })

  if (variant.value === 'payload-mutation') {
    const payload = args[0] as { layout?: Layout; item?: { x?: number } } | undefined
    if (payload?.layout?.[0]) payload.layout[0].x = 99
    if (payload?.item) payload.item.x = 99
  }
}

function recordItemResized(...args: unknown[]) {
  record('item-resized', ...args)
}

function recordItemResize(...args: unknown[]) {
  record('item-resize', ...args)
}

function recordItemMove(...args: unknown[]) {
  record('item-move', ...args)
}

function recordItemMoved(...args: unknown[]) {
  record('item-moved', ...args)
}

const outOfOrderEchoes: Layout[] = []

function applyLayoutUpdate(nextLayout: Layout, ...rest: unknown[]) {
  record('update:layout', nextLayout, ...rest)

  if (scenario.value === 'E2E-33' && variant.value === 'latest-wins' && cols.value.xxs === 1) {
    cols.value = { ...cols.value, xxs: 3 }
  }
  if (variant.value === 'one-sided') return

  const apply = () => {
    if (variant.value === 'invalid') {
      layout.value = nextLayout.map((item, index) => ({
        ...item,
        x: index === 0 ? Number.NaN : item.x,
      }))
      return
    }
    if (variant.value === 'committed-clone') {
      layout.value = layout.value.map(item => ({ ...item }))
      return
    }
    if (variant.value === 'external' || ackMode.value === 'rewrite') {
      layout.value = nextLayout.map((item, index) => ({ ...item, x: index * 4 }))
      return
    }
    layout.value = nextLayout.map(item =>
      variant.value === 'metadata-echo' ? { ...item, fixtureMetadata: 'echo' } : { ...item },
    )
  }

  if (ackMode.value === 'sync') apply()
  if (variant.value === 'drop-responsive-layout-only') apply()
  if (ackMode.value === 'rewrite') apply()
  if (ackMode.value === 'next-tick') void nextTick(apply)
  if (ackMode.value === 'nested-next-tick') {
    void nextTick(() => {
      void nextTick(apply)
    })
  }
  if (ackMode.value === 'out-of-order') {
    outOfOrderEchoes.push(nextLayout.map(item => ({ ...item })))
    if (outOfOrderEchoes.length >= 2) {
      const latest = outOfOrderEchoes.at(-1)!
      const stale = outOfOrderEchoes[0]
      layout.value = stale
      void nextTick(() => {
        layout.value = latest
      })
    }
  }
  if (variant.value === 'independent-metadata') {
    layout.value = layout.value.map(item => ({
      ...item,
      fixtureMetadata: 'independent',
    }))
  }
  if (['committed-clone', 'external', 'invalid'].includes(variant.value)) apply()
}

function applyResponsiveLayouts(nextLayouts: Partial<ResponsiveLayout>, ...rest: unknown[]) {
  record('update:responsive-layouts', nextLayouts, ...rest)
  const apply = () => {
    responsiveLayouts.value = Object.fromEntries(
      Object.entries(nextLayouts).map(([key, value]) => [key, value?.map(item => ({ ...item }))]),
    ) as Partial<ResponsiveLayout>
  }
  if (ackMode.value === 'sync') apply()
  if (variant.value === 'drop-responsive-nested-next-tick') {
    void nextTick(() => {
      void nextTick(apply)
    })
  }
}

const gridListeners = {
  'layout-before-mount': (...args: unknown[]) => record('layout-before-mount', ...args),
  'layout-mounted': (...args: unknown[]) => {
    gridMounted.value = true
    record('layout-mounted', ...args)
  },
  'layout-ready': (...args: unknown[]) => record('layout-ready', ...args),
  'layout-updated': (...args: unknown[]) => record('layout-updated', ...args),
  'breakpoint-changed': (...args: unknown[]) => record('breakpoint-changed', ...args),
  'update:layout': applyLayoutUpdate,
  'update:responsive-layouts': applyResponsiveLayouts,
  'width-changed': (...args: unknown[]) => record('width-changed', ...args),
  'interaction-start': (...args: unknown[]) => record('interaction-start', ...args),
  'interaction-change': (...args: unknown[]) => record('interaction-change', ...args),
  'interaction-end': (...args: unknown[]) => record('interaction-end', ...args),
  'operation-rejected': (...args: unknown[]) => record('operation-rejected', ...args),
  error: (...args: unknown[]) => record('error', ...args),
  'drop-drag-over': (...args: unknown[]) => record('drop-drag-over', ...args),
  drop: (...args: unknown[]) => {
    record('drop', ...args)
    if (variant.value === 'listener-mutation') {
      const nativeEvent = args.at(-1)
      if (nativeEvent instanceof DragEvent) {
        nativeEvent.preventDefault()
        if (nativeEvent.dataTransfer) nativeEvent.dataTransfer.dropEffect = 'link'
      }
    }
  },
  'drop-drag-leave': (...args: unknown[]) => record('drop-drag-leave', ...args),
}

function runLegacyInteraction() {
  const adapter = getGridTestAdapter()
  if (adapter) {
    adapter.dragEvent('dragstart', 'fixture-a', 1, 1, 1, 2)
    for (let index = 0; index < 8; index++) {
      adapter.dragEvent('dragmove', 'fixture-a', 1 + (index % 2), 1, 1, 2)
    }
    adapter.dragEvent('dragend', 'fixture-a', 2, 1, 1, 2)
  }
}

function runProgrammaticMove() {
  eventLog.value = []
  const instance = gridRef.value

  if (instance?.moveItem) {
    instance.moveItem('fixture-a', 4, 0)
  }
}

function startLegacyInteraction() {
  eventLog.value = []
  getGridTestAdapter()?.dragEvent('dragstart', 'fixture-a', 1, 1, 1, 2)
}

function snapshotResources() {
  resourceState.value =
    (
      globalThis as unknown as {
        __GLP_E2E_RESOURCES__?: Record<string, unknown>
      }
    ).__GLP_E2E_RESOURCES__ ?? {}
}

function runControl(control: string) {
  switch (control) {
    case 'ack-mode': {
      const modes: AckMode[] = [
        'none',
        'sync',
        'next-tick',
        'nested-next-tick',
        'rewrite',
        'out-of-order',
      ]
      ackMode.value = modes[(modes.indexOf(ackMode.value) + 1) % modes.length]
      break
    }
    case 'programmatic-move':
      runProgrammaticMove()
      break
    case 'high-frequency-drag':
      eventLog.value = []
      runLegacyInteraction()
      break
    case 'change-config-during-interaction':
      startLegacyInteraction()
      if (variant.value === 'width') explicitWidth.value = 900
      else if (variant.value === 'strategy') positionStrategy.value = absoluteStrategy
      else if (variant.value === 'disabled') {
        isDraggable.value = false
      }
      break
    case 'item-slot':
      break
    case 'default-slot':
      if (variant.value === 'manual-promotion') showManualOwner.value = false
      break
    case 'unmount-active-grid':
      startLegacyInteraction()
      showGrid.value = false
      void nextTick(snapshotResources)
      break
    case 'mount-standalone-item':
      standaloneError.value = null
      showStandaloneItem.value = true
      break
    case 'toggle-width-zero':
      eventLog.value = []
      if (variant.value === 'prop-add') explicitWidth.value = 800
      else if (variant.value === 'prop-remove') explicitWidth.value = undefined
      else if (variant.value === 'zero-positive') {
        explicitWidth.value = explicitWidth.value === 0 ? 800 : 0
      } else {
        explicitWidth.value = 0
      }
      break
    case 'change-responsive-width':
      eventLog.value = []
      if (variant.value === 'programmatic') runProgrammaticMove()
      else explicitWidth.value = explicitWidth.value === 800 ? 1300 : 800
      break
    case 'shrink-responsive-cols':
      eventLog.value = []
      if (['cols-unack', 'latest-wins'].includes(variant.value)) {
        responsiveLayouts.value = Object.fromEntries(
          Object.entries(initialAuthorLayouts).map(([key, value]) => [
            key,
            value?.map(item => ({ ...item })),
          ]),
        ) as Partial<ResponsiveLayout>
        ackMode.value = 'none'
        void nextTick(() => {
          cols.value = { ...cols.value, xxs: 1 }
        })
        break
      }
      if (variant.value === 'author-generated') {
        responsiveLayouts.value = {
          lg: layout.value.map(item => ({ ...item })),
        }
      } else if (variant.value === 'delete-breakpoint') {
        const nextBreakpoints = { ...breakpoints.value }
        const nextCols = { ...cols.value }
        const nextLayouts = { ...responsiveLayouts.value }
        Reflect.deleteProperty(nextBreakpoints, 'xxs')
        Reflect.deleteProperty(nextCols, 'xxs')
        delete nextLayouts.xxs
        nextBreakpoints.xs = 0
        breakpoints.value = nextBreakpoints
        cols.value = nextCols
        responsiveLayouts.value = nextLayouts
      } else {
        cols.value = { ...cols.value, xxs: 1 }
      }
      break
    case 'toggle-responsive-mode':
      eventLog.value = []
      if (variant.value === 'active') startLegacyInteraction()
      if (variant.value === 'pending') runProgrammaticMove()
      responsive.value = !responsive.value
      break
    case 'invalidate-background-width':
      if (variant.value === 'dormant-responsive' && backgroundWidth.value !== Infinity) {
        startLegacyInteraction()
        responsiveLayouts.value = {
          ...responsiveLayouts.value,
          sm: layout.value.map(item => ({ ...item })),
        }
      }
      backgroundWidth.value = backgroundWidth.value === Infinity ? 400 : Infinity
      break
    case 'reject-drop-callback':
      eventLog.value = []
      dropCallbackMode.value = 'reject'
      break
    case 'dynamic-drop-size':
      eventLog.value = []
      dropCallbackMode.value = 'resize'
      break
    case 'drop-proposal-log':
      eventLog.value = []
      if (variant.value === 'breakpoint-invalidation') explicitWidth.value = 1300
      break
    case 'scaled-drop-target':
    case 'rtl-drop-target':
    case 'resize-handle':
    case 'motion-state':
      if (variant.value.includes('placeholder')) startLegacyInteraction()
      break
    case 'focus-target':
    case 'observer-gate':
      break
    case 'terminal-log':
      eventLog.value = []
      if (variant.value === 'committed') {
        runLegacyInteraction()
      } else if (variant.value === 'unchanged') {
        getGridTestAdapter()?.dragEvent('dragstart', 'fixture-a', 0, 0, 1, 2)
        getGridTestAdapter()?.dragEvent('dragend', 'fixture-a', 0, 0, 1, 2)
      } else if (variant.value === 'cancelled') {
        startLegacyInteraction()
        getGridTestAdapter()?.cancelInteraction('fixture-token')
      } else if (variant.value === 'geometry') {
        startLegacyInteraction()
        explicitWidth.value = Number.MAX_VALUE
      } else if (variant.value === 'extension') {
        startLegacyInteraction()
        positionStrategy.value = {
          usesCssTransforms: false,
          getStyle: () => ({ width: 'NaNpx' }),
          getRtlStyle: () => ({ width: 'NaNpx' }),
        }
      }
      break
    case 'metadata-log':
      break
    case 'geometry-error-log': {
      eventLog.value = []
      const root = gridRef.value?.root ?? gridRef.value?.$el
      if (root instanceof HTMLElement) {
        root.getBoundingClientRect = () => {
          const derived = variant.value === 'geometry-derived-pointer'
          return {
            x: derived ? -Number.MAX_VALUE : 0,
            y: 0,
            top: 0,
            left: derived ? -Number.MAX_VALUE : 0,
            right: derived ? 0 : Infinity,
            bottom: 100,
            width: derived ? Number.MAX_VALUE : Infinity,
            height: 100,
            toJSON: () => ({}),
          } as DOMRect
        }
      }
      break
    }
    case 'invalidate-position-strategy':
      eventLog.value = []
      startLegacyInteraction()
      break
  }
}

onErrorCaptured(error => {
  if (standaloneError.value === null || error instanceof GridLayoutValidationError) {
    standaloneError.value = {
      name: error instanceof Error ? error.name : typeof error,
      code: (error as { code?: unknown })?.code,
      path: (error as { path?: unknown })?.path,
      message: error instanceof Error ? error.message : String(error),
    }
  }
  return false
})
</script>

<template>
  <main
    data-contract-e2e-fixture="ready"
    :data-fixture-phase="phase"
    :data-fixture-scenario="scenario"
    :data-fixture-variant="variant"
    :data-grid-mounted="String(gridMounted)"
    :data-layout-state="serialize(layout)"
    :data-breakpoints="serialize(breakpoints)"
    :data-cols="serialize(cols)"
    :data-responsive-layouts="serialize(responsiveLayouts)"
    :data-initial-author-layouts="serialize(initialAuthorLayouts)"
    :data-event-log="serialize(eventLog)"
    :data-drop-callback-trace="serialize(dropCallbackTrace)"
    :data-compactor-calls="String(compactorCalls)"
    :data-resource-state="serialize(resourceState)"
    :data-standalone-error="serialize(standaloneError)"
  >
    <div data-fixture-sentinel="grid-layout-plus-contract"></div>
    <button
      v-for="control in controls"
      :key="control"
      type="button"
      :data-e2e-control="control"
      @click="runControl(control)"
    >
      {{ control }}
    </button>
    <div :style="containerStyle">
      <GridLayout
        v-if="showGrid"
        ref="gridRef"
        v-bind="futureProps"
        :layout="layout"
        :col-num="12"
        :row-height="rowHeight"
        :max-rows="maxRows"
        :gap="gap"
        :is-draggable="isDraggable"
        :is-resizable="isResizable"
        :is-mirrored="isMirrored"
        :is-bounded="isBounded"
        :restore-on-drag="restoreOnDrag"
        :responsive="responsive"
        :responsive-layouts="responsiveLayouts"
        :breakpoints="breakpoints"
        :cols="cols"
        :collision-mode="collisionMode"
        :is-droppable="phase === 'phase-4'"
        :drop-config="dropConfig"
        :compactor="
          variant === 'aspect-terminal-extension'
            ? terminalExtensionCompactor
            : scenario === 'E2E-43'
              ? countingCompactor
              : undefined
        "
        :position-strategy="positionStrategy"
        v-on="gridListeners"
      >
        <template
          v-if="
            (scenario !== 'E2E-23' || variant === 'item-slot') &&
            !(
              scenario === 'E2E-27' &&
              (['teleport', 'containing-block', 'selector'].includes(variant) ||
                variant.startsWith('aspect'))
            )
          "
          #item="{ item }"
        >
          <span data-item-slot :data-grid-item="item.i">
            {{ item.i }}
            <GridBackground
              v-if="scenario === 'E2E-36' && item.i === 'fixture-a'"
              :width="backgroundWidth"
              :rows="3"
              data-background-fixture
            ></GridBackground>
            <input
              v-if="scenario === 'E2E-24' && item.i === 'fixture-a'"
              data-focus-target
              value="focus-stable"
            />
            <button
              v-if="scenario === 'E2E-27' && variant === 'selector'"
              data-selector-ignore
              type="button"
            >
              ignored drag source
            </button>
          </span>
        </template>
        <template
          v-if="
            (scenario === 'E2E-23' && variant !== 'item-slot') ||
            (scenario === 'E2E-27' &&
              (['teleport', 'containing-block', 'selector'].includes(variant) ||
                variant.startsWith('aspect')))
          "
          #default
        >
          <template v-if="scenario === 'E2E-23'">
            <GridItem
              v-if="variant === 'manual-missing'"
              data-manual-missing
              i="missing"
              v-bind="{ x: 0, y: 0, w: 1, h: 1 }"
            >
              missing
            </GridItem>
            <GridItem
              v-if="
                (variant === 'manual-duplicate' || variant === 'manual-promotion') &&
                showManualOwner
              "
              data-manual-owner
              i="fixture-a"
              v-bind="{ x: 0, y: 0, w: 2, h: 1 }"
            >
              owner
            </GridItem>
            <GridItem
              v-if="variant === 'manual-duplicate' || variant === 'manual-promotion'"
              data-manual-duplicate
              i="fixture-a"
              v-bind="{ x: 0, y: 0, w: 2, h: 1 }"
            >
              duplicate
            </GridItem>
          </template>
          <template v-else>
            <Teleport v-if="variant === 'teleport'" to="body">
              <GridItem
                data-teleported-item
                i="fixture-a"
                v-bind="{ x: 0, y: 0, w: 2, h: 1 }"
              ></GridItem>
            </Teleport>
            <div v-else-if="variant === 'containing-block'" style="position: relative">
              <GridItem
                data-containing-block-item
                i="fixture-a"
                v-bind="{ x: 0, y: 0, w: 2, h: 1 }"
              ></GridItem>
            </div>
            <GridItem
              v-else-if="variant.startsWith('aspect')"
              data-aspect-item
              i="fixture-a"
              v-bind="{ x: 0, y: 0, w: 2, h: 1 }"
              preserve-aspect-ratio
              @move="recordItemMove"
              @moved="recordItemMoved"
              @resize="recordItemResize"
              @resized="recordItemResized"
            ></GridItem>
            <GridItem v-else data-selector-item i="fixture-a" v-bind="{ x: 0, y: 0, w: 2, h: 1 }">
              <button data-selector-ignore type="button">ignored drag source</button>
            </GridItem>
          </template>
        </template>
      </GridLayout>
    </div>

    <GridItem
      v-if="showStandaloneItem"
      data-standalone-item
      i="standalone"
      :x="0"
      :y="0"
      :w="1"
      :h="1"
    ></GridItem>
  </main>
</template>
