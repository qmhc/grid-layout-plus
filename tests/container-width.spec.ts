import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { useContainerWidth } from '../src/composables/useContainerWidth'

class ResizeObserverHarness {
  static instances: ResizeObserverHarness[] = []

  readonly observe = vi.fn()
  readonly disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverHarness.instances.push(this)
  }

  trigger(entry: Partial<ResizeObserverEntry>): void {
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

const nativeResizeObserver = globalThis.ResizeObserver

function installResizeObserver(): void {
  ResizeObserverHarness.instances = []
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverHarness,
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: nativeResizeObserver,
  })
})

describe('useContainerWidth', () => {
  it('初始非法显式 width 同步抛出且不创建 observer', () => {
    installResizeObserver()
    const scope = effectScope()

    expect(() =>
      scope.run(() =>
        useContainerWidth(ref(document.createElement('div')), {
          explicitWidth: Number.NaN,
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.width',
        cause: Number.NaN,
      }),
    )
    expect(ResizeObserverHarness.instances).toHaveLength(0)
    scope.stop()
  })

  it('显式 width 抢占 observer，移除后进入新 epoch 并忽略旧 callback', () => {
    installResizeObserver()
    const element = document.createElement('div')
    const explicitWidth = ref<number | undefined>(100)
    const scope = effectScope()
    const api = scope.run(() =>
      useContainerWidth(ref(element), {
        explicitWidth,
      }),
    )!

    expect(api.width.value).toBe(100)
    expect(api.state.value).toBe('resolved')
    expect(ResizeObserverHarness.instances).toHaveLength(0)

    explicitWidth.value = undefined
    expect(api.width.value).toBeNull()
    expect(api.state.value).toBe('unresolved')
    const observer = ResizeObserverHarness.instances[0]
    observer.trigger({
      target: element,
      contentBoxSize: [{ inlineSize: 320, blockSize: 100 }],
    })
    expect(api.width.value).toBe(320)

    explicitWidth.value = 0
    expect(api.width.value).toBe(0)
    expect(api.state.value).toBe('resolved-zero')
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
    observer.trigger({
      target: element,
      contentBoxSize: [{ inlineSize: 640, blockSize: 100 }],
    })
    expect(api.width.value).toBe(0)
    scope.stop()
  })

  it('读取 contentBoxSize 单对象、array-like 首项和 contentRect fallback', () => {
    installResizeObserver()
    const element = document.createElement('div')
    const elementRef = ref<HTMLElement | null>(element)
    const scope = effectScope()
    const api = scope.run(() => useContainerWidth(elementRef))!
    let observer = ResizeObserverHarness.instances.at(-1)!

    observer.trigger({
      target: element,
      contentBoxSize: { inlineSize: 120, blockSize: 40 } as unknown as ResizeObserverSize[],
    })
    expect(api.width.value).toBe(120)

    elementRef.value = null
    elementRef.value = element
    observer = ResizeObserverHarness.instances.at(-1)!
    observer.trigger({
      target: element,
      contentBoxSize: {
        0: { inlineSize: 240, blockSize: 40 },
        1: { inlineSize: 999, blockSize: 40 },
        length: 2,
      } as unknown as ResizeObserverSize[],
    })
    expect(api.width.value).toBe(240)

    elementRef.value = null
    elementRef.value = element
    observer = ResizeObserverHarness.instances.at(-1)!
    observer.trigger({
      target: element,
      contentBoxSize: undefined,
      contentRect: { width: 360 },
    })
    expect(api.width.value).toBe(360)
    scope.stop()
  })

  it('contentBoxSize 存在但非法时不回退 contentRect', () => {
    installResizeObserver()
    const errors = vi.fn()
    const element = document.createElement('div')
    const scope = effectScope()
    const api = scope.run(() =>
      useContainerWidth(ref(element), {
        onError: errors,
      }),
    )!
    const observer = ResizeObserverHarness.instances[0]

    observer.trigger({
      target: element,
      contentBoxSize: [],
      contentRect: { width: 400 },
    })
    expect(api.width.value).toBeNull()
    expect(errors).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'container-width',
        path: 'observer.entry.contentBoxSize[0]',
      }),
    )

    const failure = new Error('contentBoxSize getter failed')
    const entry = { target: element } as Partial<ResizeObserverEntry>
    Object.defineProperty(entry, 'contentBoxSize', {
      get() {
        throw failure
      },
    })
    observer.trigger(entry)
    expect(errors).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'container-width',
        path: 'observer.entry.contentBoxSize',
        cause: failure,
      }),
    )
    scope.stop()
  })

  it('缺失 ResizeObserver 保持 unresolved，每个 source epoch 报告一次', () => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    })
    const errors = vi.fn()
    const element = ref<HTMLElement | null>(document.createElement('div'))
    const scope = effectScope()
    const api = scope.run(() => useContainerWidth(element, { onError: errors }))!

    expect(api.width.value).toBeNull()
    expect(api.state.value).toBe('unresolved')
    expect(errors).toHaveBeenCalledTimes(1)
    expect(errors).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'container-width',
        path: 'observer.resizeObserver',
      }),
    )

    element.value = null
    element.value = document.createElement('div')
    expect(errors).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('非法显式 width 保留当前 observer source', () => {
    installResizeObserver()
    const errors = vi.fn()
    const element = document.createElement('div')
    const explicitWidth = ref<number | undefined>(undefined)
    const scope = effectScope()
    const api = scope.run(() =>
      useContainerWidth(ref(element), {
        explicitWidth,
        onError: errors,
      }),
    )!
    const observer = ResizeObserverHarness.instances[0]

    explicitWidth.value = Infinity
    expect(errors).toHaveBeenCalledTimes(1)
    expect(observer.disconnect).not.toHaveBeenCalled()

    observer.trigger({
      target: element,
      contentBoxSize: [{ inlineSize: 320, blockSize: 100 }],
    })
    expect(api.width.value).toBe(320)
    expect(api.state.value).toBe('resolved')
    scope.stop()
  })

  it('scope dispose 断开 observer 并忽略迟到 callback', () => {
    installResizeObserver()
    const element = document.createElement('div')
    const scope = effectScope()
    const api = scope.run(() => useContainerWidth(ref(element)))!
    const observer = ResizeObserverHarness.instances[0]

    scope.stop()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
    observer.trigger({
      target: element,
      contentBoxSize: [{ inlineSize: 500, blockSize: 100 }],
    })
    expect(api.width.value).toBeNull()
  })

  it('组件 template ref 挂载时不提前断开 active observer', async () => {
    installResizeObserver()
    const Probe = defineComponent({
      setup() {
        const element = ref<HTMLElement | null>(null)
        useContainerWidth(element)

        return () => h('div', { ref: element })
      },
    })
    const wrapper = mount(Probe)

    await nextTick()
    expect(ResizeObserverHarness.instances).toHaveLength(1)
    expect(ResizeObserverHarness.instances[0].observe).toHaveBeenCalledTimes(1)
    expect(ResizeObserverHarness.instances[0].disconnect).not.toHaveBeenCalled()

    wrapper.unmount()
    expect(ResizeObserverHarness.instances[0].disconnect).toHaveBeenCalledTimes(1)
  })
})
