import { shallowReadonly, shallowRef, toRaw, toValue, watch } from 'vue'

import { verticalCompactor } from '../core/compactors'
import { GridLayoutExtensionError, GridLayoutValidationError } from '../core/errors'
import { layoutsSemanticallyEqual, snapshotStrictLayout } from '../core/layout-engine'
import { snapshotCompactor } from '../core/validation'
import { cloneLayout } from '../helpers/common'
import {
  cloneResponsiveLayouts,
  createCompleteResponsiveLayouts,
  getBreakpointFromWidth,
  snapshotResponsiveConfig,
  snapshotResponsiveLayouts,
} from '../helpers/responsive'

import type { GridLayoutRuntimeError } from './useGridLayout'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  Breakpoints,
  CollisionMode,
  Compactor,
  CompleteResponsiveLayouts,
  DefaultBreakpoint,
  Layout,
  ReadonlyLayout,
  ResponsiveLayoutsInput,
} from '../helpers/types'
import type { ResponsiveConfigSnapshot } from '../helpers/responsive'

export interface UseResponsiveLayoutOptions<B extends string = DefaultBreakpoint> {
  breakpoints: MaybeRefOrGetter<Breakpoints<B>>
  cols: MaybeRefOrGetter<Readonly<Record<B, number>>>
  width: MaybeRefOrGetter<number | null>
  layout: Ref<Layout>
  layouts: Ref<ResponsiveLayoutsInput<B>>
  initialFallback: ReadonlyLayout
  compactor?: MaybeRefOrGetter<Compactor>
  collisionMode?: MaybeRefOrGetter<CollisionMode>
  maxRows?: MaybeRefOrGetter<number>
  onError?: (error: GridLayoutRuntimeError) => void
}

export interface UseResponsiveLayoutReturn<B extends string = DefaultBreakpoint> {
  state: Readonly<Ref<'unresolved' | 'resolved-zero' | 'resolved'>>
  currentBreakpoint: Readonly<Ref<B | null>>
  currentCols: Readonly<Ref<number | null>>
  currentLayout: Readonly<Ref<ReadonlyLayout>>
  completeLayouts: Readonly<Ref<CompleteResponsiveLayouts<B> | null>>
}

interface ResponsiveEvaluationSnapshot<B extends string> {
  readonly config: ResponsiveConfigSnapshot<B>
  readonly width: number | null
  readonly compactor: Compactor
  readonly collisionMode: CollisionMode
  readonly maxRows: number
}

type ResponsiveState = 'unresolved' | 'resolved-zero' | 'resolved'

function widthState(value: number | null): ResponsiveState {
  return value === null ? 'unresolved' : value === 0 ? 'resolved-zero' : 'resolved'
}

function validateWidth(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new GridLayoutValidationError('Width must be null or a non-negative finite number', {
      code: 'invalid-config',
      path: 'config.width',
      cause: value,
    })
  }
  return Object.is(value, -0) ? 0 : value
}

function validateMaxRows(value: unknown): number {
  if (value === Infinity) return value
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new GridLayoutValidationError('maxRows must be a positive safe integer or Infinity', {
      code: 'invalid-config',
      path: 'config.maxRows',
      cause: value,
    })
  }
  return value as number
}

function validateCollisionMode(value: unknown): CollisionMode {
  if (value !== 'push' && value !== 'prevent' && value !== 'overlap') {
    throw new GridLayoutValidationError('Invalid collision mode', {
      code: 'invalid-config',
      path: 'config.collisionMode',
      cause: value,
    })
  }
  return value
}

function rawIdentity(value: unknown): unknown {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
    ? toRaw(value)
    : value
}

function sameIdentities(first: readonly unknown[], second: readonly unknown[]): boolean {
  return first.every((value, index) => Object.is(rawIdentity(value), rawIdentity(second[index])))
}

function snapshotLayout(
  value: unknown,
  path: 'layout' | 'initialFallback',
  snapshot: ResponsiveEvaluationSnapshot<string>,
  cols: number | null,
): Layout {
  try {
    return snapshotStrictLayout(value as ReadonlyLayout, {
      cols: cols ?? Number.MAX_SAFE_INTEGER,
      rowHeight: 0,
      margin: [0, 0],
      containerPadding: [0, 0],
      maxRows: snapshot.maxRows,
      collisionMode: snapshot.collisionMode,
      compactor: snapshot.compactor,
      isDraggable: true,
      isResizable: true,
      restoreOnDrag: false,
      bringToFrontOnInteract: true,
    })
  } catch (error) {
    if (!(error instanceof GridLayoutValidationError) || path === 'layout') throw error
    throw new GridLayoutValidationError(error.message, {
      code: error.code,
      path: `${path}${error.path.slice('layout'.length)}`,
      cause: error.cause,
    })
  }
}

function createAuthorCandidate<B extends string>(
  author: ResponsiveLayoutsInput<B>,
  evaluation: ResponsiveEvaluationSnapshot<B>,
): ResponsiveLayoutsInput<B> {
  const candidate = Object.create(null) as Partial<Record<B, ReadonlyLayout>>
  for (const key of evaluation.config.keys) {
    if (author[key]) candidate[key] = author[key]
  }
  return snapshotResponsiveLayouts(candidate, evaluation.config, evaluation)
}

function toRuntimeError(error: unknown, evaluationId: number): GridLayoutRuntimeError {
  if (error instanceof GridLayoutExtensionError) {
    return {
      code: error.code,
      source: error.source,
      path: error.path,
      revision: null,
      evaluationId,
      cause: error.cause,
    }
  }
  const validation =
    error instanceof GridLayoutValidationError
      ? error
      : new GridLayoutValidationError('Invalid responsive state', {
          code: 'invalid-config',
          path: 'config',
          cause: error,
        })
  return {
    code: validation.code,
    source:
      validation.code === 'invalid-layout' ||
      validation.path === 'layout' ||
      validation.path.startsWith('layout[') ||
      validation.path.startsWith('responsiveLayouts')
        ? 'layout'
        : 'config',
    path: validation.path,
    revision: null,
    evaluationId,
    cause: validation.cause,
  }
}

export function useResponsiveLayout<B extends string = DefaultBreakpoint>(
  options: UseResponsiveLayoutOptions<B>,
): UseResponsiveLayoutReturn<B> {
  let evaluationId = 0
  let guardedWrite = false
  let writtenLayoutIdentity: unknown = null
  let writtenLayoutsIdentity: unknown = null
  let writtenInputs: readonly unknown[] | null = null

  function readInputs(): readonly unknown[] {
    return [
      toValue(options.breakpoints),
      toValue(options.cols),
      toValue(options.width),
      toValue(options.compactor ?? verticalCompactor),
      toValue(options.collisionMode ?? 'push'),
      toValue(options.maxRows ?? Infinity),
    ]
  }

  function snapshotInputs(inputs: readonly unknown[]): ResponsiveEvaluationSnapshot<B> {
    return {
      config: snapshotResponsiveConfig<B>(rawIdentity(inputs[0]), rawIdentity(inputs[1])),
      width: validateWidth(inputs[2]),
      compactor: snapshotCompactor(rawIdentity(inputs[3])),
      collisionMode: validateCollisionMode(inputs[4]),
      maxRows: validateMaxRows(inputs[5]),
    }
  }

  const initialInputs = readInputs()
  let committedEvaluation = snapshotInputs(initialInputs)
  let committedInputIdentities = initialInputs.map(rawIdentity)
  const initialBreakpoint =
    committedEvaluation.width === null
      ? null
      : getBreakpointFromWidth(committedEvaluation.config.breakpoints, committedEvaluation.width)
  const initialCols =
    initialBreakpoint === null ? null : committedEvaluation.config.cols[initialBreakpoint]
  const initialFallback = snapshotLayout(
    rawIdentity(options.initialFallback),
    'initialFallback',
    committedEvaluation as ResponsiveEvaluationSnapshot<string>,
    initialCols,
  )
  let committedAuthor = snapshotResponsiveLayouts(
    rawIdentity(options.layouts.value),
    committedEvaluation.config,
    committedEvaluation,
  )
  let committedLayoutModel = snapshotLayout(
    rawIdentity(options.layout.value),
    'layout',
    committedEvaluation as ResponsiveEvaluationSnapshot<string>,
    initialCols,
  )
  let committedLayoutsModel: ResponsiveLayoutsInput<B> = committedAuthor
  let committedComplete: CompleteResponsiveLayouts<B> | null = null

  const state = shallowRef<ResponsiveState>(widthState(committedEvaluation.width))
  const currentBreakpoint = shallowRef<B | null>(null)
  const currentCols = shallowRef<number | null>(null)
  const currentLayout = shallowRef<ReadonlyLayout>(cloneLayout(committedLayoutModel))
  const completeLayouts = shallowRef<CompleteResponsiveLayouts<B> | null>(null)

  function writeModels(
    layout: ReadonlyLayout,
    layouts: ResponsiveLayoutsInput<B> | CompleteResponsiveLayouts<B>,
    inputs: readonly unknown[],
    guard = true,
  ): void {
    const publicLayouts = cloneResponsiveLayouts(layouts) as ResponsiveLayoutsInput<B>
    const publicLayout = cloneLayout(layout)
    options.layouts.value = publicLayouts
    options.layout.value = publicLayout
    writtenLayoutsIdentity = rawIdentity(options.layouts.value)
    writtenLayoutIdentity = rawIdentity(options.layout.value)
    writtenInputs = inputs.map(rawIdentity)
    guardedWrite = guard
    committedLayoutsModel = layouts
    committedLayoutModel = cloneLayout(layout)
  }

  function commitUnresolved(
    evaluation: ResponsiveEvaluationSnapshot<B>,
    author: ResponsiveLayoutsInput<B>,
    layout: ReadonlyLayout,
    inputs: readonly unknown[],
    guard = true,
  ): void {
    committedEvaluation = evaluation
    committedInputIdentities = inputs.map(rawIdentity)
    committedAuthor = author
    committedComplete = null
    state.value = 'unresolved'
    currentBreakpoint.value = null
    currentCols.value = null
    currentLayout.value = cloneLayout(layout)
    completeLayouts.value = null
    writeModels(layout, author, inputs, guard)
  }

  function commitResolved(
    evaluation: ResponsiveEvaluationSnapshot<B>,
    author: ResponsiveLayoutsInput<B>,
    complete: CompleteResponsiveLayouts<B>,
    breakpoint: B,
    inputs: readonly unknown[],
    guard = true,
  ): void {
    const layout = complete[breakpoint]
    committedEvaluation = evaluation
    committedInputIdentities = inputs.map(rawIdentity)
    committedAuthor = author
    committedComplete = complete
    state.value = widthState(evaluation.width)
    currentBreakpoint.value = breakpoint
    currentCols.value = evaluation.config.cols[breakpoint]
    currentLayout.value = cloneLayout(layout)
    completeLayouts.value = cloneResponsiveLayouts(complete)
    writeModels(layout, complete, inputs, guard)
  }

  function evaluateResolved(
    evaluation: ResponsiveEvaluationSnapshot<B>,
    author: ResponsiveLayoutsInput<B>,
  ): { complete: CompleteResponsiveLayouts<B>; breakpoint: B } {
    const complete = createCompleteResponsiveLayouts(
      author,
      initialFallback,
      evaluation.config,
      evaluation,
    )
    return {
      complete,
      breakpoint: getBreakpointFromWidth(evaluation.config.breakpoints, evaluation.width!),
    }
  }

  if (committedEvaluation.width === null) {
    commitUnresolved(
      committedEvaluation,
      committedAuthor,
      committedLayoutModel,
      initialInputs,
      false,
    )
  } else {
    const resolved = evaluateResolved(committedEvaluation, committedAuthor)
    commitResolved(
      committedEvaluation,
      committedAuthor,
      resolved.complete,
      resolved.breakpoint,
      initialInputs,
      false,
    )
  }

  function restoreModels(inputs: readonly unknown[]): void {
    const publicLayouts = cloneResponsiveLayouts(committedLayoutsModel) as ResponsiveLayoutsInput<B>
    const publicLayout = cloneLayout(committedLayoutModel)
    options.layouts.value = publicLayouts
    options.layout.value = publicLayout
    writtenLayoutsIdentity = rawIdentity(options.layouts.value)
    writtenLayoutIdentity = rawIdentity(options.layout.value)
    writtenInputs = inputs.map(rawIdentity)
    guardedWrite = true
  }

  function report(error: unknown, currentEvaluationId: number): void {
    options.onError?.(toRuntimeError(error, currentEvaluationId))
  }

  watch(
    [
      () => toValue(options.breakpoints),
      () => toValue(options.cols),
      () => toValue(options.width),
      () => toValue(options.compactor ?? verticalCompactor),
      () => toValue(options.collisionMode ?? 'push'),
      () => toValue(options.maxRows ?? Infinity),
      () => options.layout.value,
      () => options.layouts.value,
    ],
    values => {
      const inputs = values.slice(0, 6)
      const layoutInput = values[6] as Layout
      const layoutsInput = values[7] as ResponsiveLayoutsInput<B>
      if (
        guardedWrite &&
        writtenInputs &&
        Object.is(rawIdentity(layoutInput), writtenLayoutIdentity) &&
        Object.is(rawIdentity(layoutsInput), writtenLayoutsIdentity) &&
        sameIdentities(inputs, writtenInputs)
      ) {
        guardedWrite = false
        return
      }

      evaluationId += 1
      const currentEvaluationId = evaluationId
      const externalLayout = !Object.is(rawIdentity(layoutInput), writtenLayoutIdentity)
      const externalLayouts = !Object.is(rawIdentity(layoutsInput), writtenLayoutsIdentity)
      const configChanged = [0, 1, 3, 4, 5].some(
        index => !Object.is(rawIdentity(inputs[index]), committedInputIdentities[index]),
      )
      const widthChanged = !Object.is(rawIdentity(inputs[2]), committedInputIdentities[2])
      let evaluation: ResponsiveEvaluationSnapshot<B> | null = null
      let failure: unknown = null

      try {
        evaluation = snapshotInputs(inputs)
        const author =
          externalLayouts || configChanged
            ? externalLayouts
              ? snapshotResponsiveLayouts(rawIdentity(layoutsInput), evaluation.config, evaluation)
              : createAuthorCandidate(committedAuthor, evaluation)
            : committedAuthor
        const breakpoint =
          evaluation.width === null
            ? null
            : getBreakpointFromWidth(evaluation.config.breakpoints, evaluation.width)
        const sampledLayout = snapshotLayout(
          rawIdentity(layoutInput),
          'layout',
          evaluation as ResponsiveEvaluationSnapshot<string>,
          evaluation.width === null || configChanged || widthChanged
            ? null
            : evaluation.config.cols[breakpoint!],
        )

        if (evaluation.width === null) {
          commitUnresolved(evaluation, author, sampledLayout, inputs)
          return
        }
        const activeBreakpoint = breakpoint as B

        if (
          widthChanged &&
          !configChanged &&
          !externalLayout &&
          !externalLayouts &&
          committedComplete &&
          currentBreakpoint.value === activeBreakpoint
        ) {
          committedEvaluation = evaluation
          committedInputIdentities = inputs.map(rawIdentity)
          state.value = widthState(evaluation.width)
          return
        }

        const resolved =
          !configChanged && !externalLayouts && committedComplete
            ? { complete: committedComplete, breakpoint: activeBreakpoint }
            : evaluateResolved(evaluation, author)
        if (
          !configChanged &&
          !widthChanged &&
          (externalLayout || externalLayouts) &&
          !layoutsSemanticallyEqual(sampledLayout, resolved.complete[resolved.breakpoint])
        ) {
          failure = {
            code: 'partial-responsive-update',
            source: 'layout',
            path: 'layout',
            revision: null,
            evaluationId: currentEvaluationId,
            cause: {
              layout: cloneLayout(sampledLayout),
              layouts: cloneResponsiveLayouts(author),
            },
          } satisfies GridLayoutRuntimeError
        } else {
          commitResolved(evaluation, author, resolved.complete, resolved.breakpoint, inputs)
          return
        }
      } catch (error) {
        failure = error
      }

      if (evaluation && committedEvaluation.width === null && evaluation.width !== null) {
        state.value = widthState(evaluation.width)
        currentBreakpoint.value = null
        currentCols.value = null
        completeLayouts.value = null
      }
      restoreModels(inputs)
      if (
        typeof failure === 'object' &&
        failure !== null &&
        'evaluationId' in failure &&
        'revision' in failure
      ) {
        options.onError?.(failure as GridLayoutRuntimeError)
      } else {
        report(failure, currentEvaluationId)
      }
    },
    { flush: 'post' },
  )

  return {
    state: shallowReadonly(state),
    currentBreakpoint: shallowReadonly(currentBreakpoint),
    currentCols: shallowReadonly(currentCols),
    currentLayout: shallowReadonly(currentLayout),
    completeLayouts: shallowReadonly(completeLayouts),
  }
}
