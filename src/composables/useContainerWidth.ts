import { onScopeDispose, readonly, ref, toValue, watch } from 'vue'

import { GridLayoutValidationError } from '../core/errors'

import type { GridLayoutRuntimeError } from './useGridLayout'
import type { MaybeRefOrGetter, Ref } from 'vue'

/** Reactive container-width state returned by {@link useContainerWidth}. */
export interface UseContainerWidthReturn {
  /** The resolved content-box width, or `null` before a measurement is available. */
  width: Readonly<Ref<number | null>>
  /** Whether the width is unresolved, zero, or large enough to produce renderable geometry. */
  state: Readonly<Ref<'unresolved' | 'resolved-zero' | 'resolved'>>
}

/** Options accepted by {@link useContainerWidth}. */
export interface UseContainerWidthOptions {
  /** A non-negative width that takes precedence over element observation when defined. */
  explicitWidth?: MaybeRefOrGetter<number | undefined>
  /**
   * Receives validation and observation failures.
   *
   * @param error - The structured runtime error.
   */
  onError?: (error: GridLayoutRuntimeError) => void
}

function validateWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new GridLayoutValidationError('Width must be a non-negative finite number', {
      code: 'invalid-config',
      path: 'config.width',
      cause: value,
    })
  }
  return Object.is(value, -0) ? 0 : value
}

function widthState(value: number | null): 'unresolved' | 'resolved-zero' | 'resolved' {
  return value === null ? 'unresolved' : value === 0 ? 'resolved-zero' : 'resolved'
}

function readEntryWidth(entry: ResizeObserverEntry): number {
  let contentBoxSize: ResizeObserverEntry['contentBoxSize']
  try {
    contentBoxSize = entry.contentBoxSize
  } catch (cause) {
    throw new GridLayoutValidationError('Unable to read ResizeObserver contentBoxSize', {
      code: 'invalid-config',
      path: 'observer.entry.contentBoxSize',
      cause,
    })
  }

  if (contentBoxSize !== undefined) {
    let first: ResizeObserverSize | undefined
    try {
      if (
        typeof contentBoxSize === 'object' &&
        contentBoxSize !== null &&
        'inlineSize' in contentBoxSize
      ) {
        first = contentBoxSize as unknown as ResizeObserverSize
      } else {
        first = (contentBoxSize as unknown as ArrayLike<ResizeObserverSize>)[0]
      }
    } catch (cause) {
      throw new GridLayoutValidationError('Unable to read ResizeObserver content box', {
        code: 'invalid-config',
        path: 'observer.entry.contentBoxSize[0]',
        cause,
      })
    }
    if (!first) {
      throw new GridLayoutValidationError('ResizeObserver contentBoxSize is empty', {
        code: 'invalid-config',
        path: 'observer.entry.contentBoxSize[0]',
        cause: contentBoxSize,
      })
    }
    let inlineSize: unknown
    try {
      inlineSize = first.inlineSize
    } catch (cause) {
      throw new GridLayoutValidationError('Unable to read ResizeObserver inlineSize', {
        code: 'invalid-config',
        path: 'observer.entry.contentBoxSize[0].inlineSize',
        cause,
      })
    }
    if (typeof inlineSize !== 'number' || !Number.isFinite(inlineSize) || inlineSize < 0) {
      throw new GridLayoutValidationError('Invalid ResizeObserver inlineSize', {
        code: 'invalid-config',
        path: 'observer.entry.contentBoxSize[0].inlineSize',
        cause: inlineSize,
      })
    }
    return Object.is(inlineSize, -0) ? 0 : inlineSize
  }

  let width: unknown
  try {
    width = entry.contentRect.width
  } catch (cause) {
    throw new GridLayoutValidationError('Unable to read ResizeObserver contentRect', {
      code: 'invalid-config',
      path: 'observer.entry.contentRect.width',
      cause,
    })
  }
  if (typeof width !== 'number' || !Number.isFinite(width) || width < 0) {
    throw new GridLayoutValidationError('Invalid ResizeObserver contentRect width', {
      code: 'invalid-config',
      path: 'observer.entry.contentRect.width',
      cause: width,
    })
  }
  return Object.is(width, -0) ? 0 : width
}

/**
 * Resolves a container width from an explicit value or its observed content box.
 *
 * Observation resumes when `explicitWidth` becomes `undefined` and stops when the current Vue
 * effect scope is disposed.
 *
 * @param el - A ref to the element whose content-box width should be observed.
 * @param options - Explicit-width and error-reporting options.
 * @returns Readonly refs for the resolved width and its resolution state.
 */
export function useContainerWidth(
  el: Readonly<Ref<HTMLElement | null>>,
  options: Readonly<UseContainerWidthOptions> = {},
): UseContainerWidthReturn {
  const initialExplicit = toValue(options.explicitWidth)
  const initialWidth = initialExplicit === undefined ? null : validateWidth(initialExplicit)
  const width = ref<number | null>(initialWidth)
  const state = ref(widthState(initialWidth))
  let observer: ResizeObserver | null = null
  let observerEpoch = 0
  let evaluationId = 0
  let disposed = false

  function nextEvaluationId(): number {
    evaluationId += 1
    return evaluationId
  }

  function nextObserverEpoch(): number {
    observerEpoch += 1
    return observerEpoch
  }

  function commit(value: number | null): void {
    width.value = value
    state.value = widthState(value)
  }

  function report(error: GridLayoutValidationError): void {
    options.onError?.({
      code: error.code,
      source: 'container-width',
      path: error.path,
      revision: null,
      evaluationId: nextEvaluationId(),
      cause: error.cause,
    })
  }

  function cleanup(): void {
    // 推进 epoch 后，即使旧 ResizeObserver 回调已经排队，也无法再提交过期测量。
    observerEpoch += 1
    observer?.disconnect()
    observer = null
  }

  function observe(element: HTMLElement): void {
    const epoch = nextObserverEpoch()
    const Observer = globalThis.ResizeObserver
    if (typeof Observer !== 'function') {
      report(
        new GridLayoutValidationError('ResizeObserver is unavailable', {
          code: 'invalid-config',
          path: 'observer.resizeObserver',
          cause: Observer,
        }),
      )
      return
    }

    try {
      const candidate = new Observer(entries => {
        if (disposed || epoch !== observerEpoch) return
        const entry = entries.find(current => current.target === element) ?? entries[0]
        if (!entry) {
          report(
            new GridLayoutValidationError('ResizeObserver callback has no entry', {
              code: 'invalid-config',
              path: 'observer.entries',
              cause: entries,
            }),
          )
          return
        }
        try {
          commit(readEntryWidth(entry))
        } catch (error) {
          if (!(error instanceof GridLayoutValidationError)) throw error
          report(error)
        }
      })
      candidate.observe(element)
      if (disposed || epoch !== observerEpoch) {
        candidate.disconnect()
        return
      }
      observer = candidate
    } catch (cause) {
      observer = null
      report(
        new GridLayoutValidationError('Unable to create ResizeObserver', {
          code: 'invalid-config',
          path: 'observer.resizeObserver',
          cause,
        }),
      )
    }
  }

  watch(
    [() => el.value, () => toValue(options.explicitWidth)] as const,
    ([element, explicit]) => {
      if (disposed) return

      let explicitSnapshot: number | undefined
      try {
        explicitSnapshot = explicit === undefined ? undefined : validateWidth(explicit)
      } catch (error) {
        if (!(error instanceof GridLayoutValidationError)) throw error
        report(error)
        return
      }

      cleanup()
      if (explicitSnapshot !== undefined) {
        commit(explicitSnapshot)
        return
      }

      commit(null)
      if (!element) return
      observe(element)
    },
    { immediate: true, flush: 'sync' },
  )

  onScopeDispose(() => {
    disposed = true
    cleanup()
  })

  return {
    width: readonly(width),
    state: readonly(state),
  }
}
