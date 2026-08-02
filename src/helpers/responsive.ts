import { GridLayoutValidationError } from '../core/errors'
import { snapshotStrictLayout } from '../core/layout-engine'
import { normalizeLayout } from '../core/normalize'
import {
  assertNonNegativeSafeInteger,
  assertPositiveSafeInteger,
  readPlainDataObject,
} from '../core/validation'
import { cloneLayout, correctBounds } from './common'

import type {
  Breakpoints,
  CollisionMode,
  Compactor,
  CompleteResponsiveLayouts,
  DefaultBreakpoint,
  Layout,
  ReadonlyLayout,
  ResponsiveLayout,
  ResponsiveLayoutsInput,
} from './types'

const reservedKeys = new Set(['__proto__', 'prototype', 'constructor'])

export interface ResponsiveConfigSnapshot<B extends string = DefaultBreakpoint> {
  readonly breakpoints: Breakpoints<B>
  readonly cols: Readonly<Record<B, number>>
  readonly keys: readonly B[]
  readonly sorted: readonly B[]
}

export interface DormantResponsiveSnapshot<B extends string = DefaultBreakpoint> {
  readonly breakpoints: Breakpoints<B>
  readonly cols: Readonly<Record<B, number>>
  readonly layouts: ResponsiveLayoutsInput<B>
}

function invalid(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid responsive value at ${path}`, {
    code: 'invalid-config',
    path,
    cause,
  })
}

function createRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>
}

function keyPath(parent: string, key: string): string {
  return `${parent}[${JSON.stringify(key)}]`
}

function validateKey(key: string, path: string): void {
  if (key.length === 0 || reservedKeys.has(key)) invalid(keyPath(path, key), key)
}

function sameKeys(first: readonly string[], second: readonly string[]): boolean {
  return (
    first.length === second.length &&
    first.every(key => second.includes(key)) &&
    second.every(key => first.includes(key))
  )
}

function freezeRecord<T>(record: Record<string, T>): Readonly<Record<string, T>> {
  return Object.freeze(record)
}

export function snapshotResponsiveConfig<B extends string>(
  breakpointsValue: unknown,
  colsValue: unknown,
): ResponsiveConfigSnapshot<B> {
  const breakpointProperties = readPlainDataObject(breakpointsValue, {
    code: 'invalid-config',
    path: 'config.breakpoints',
  })
  const colsProperties = readPlainDataObject(colsValue, {
    code: 'invalid-config',
    path: 'config.cols',
  })
  const keys = Object.keys(breakpointProperties)
  const colKeys = Object.keys(colsProperties)
  if (keys.length === 0) invalid('config.breakpoints', breakpointsValue)
  if (!sameKeys(keys, colKeys)) {
    const missingInCols = keys.find(key => !colKeys.includes(key))
    const extraInCols = colKeys.find(key => !keys.includes(key))
    const key = missingInCols ?? extraInCols!
    invalid(keyPath(missingInCols ? 'config.cols' : 'config.breakpoints', key), key)
  }

  const breakpoints = createRecord<number>()
  const cols = createRecord<number>()
  const thresholds = new Set<number>()
  for (const key of keys) {
    validateKey(key, 'config.breakpoints')
    const threshold = breakpointProperties[key]
    assertNonNegativeSafeInteger(threshold, keyPath('config.breakpoints', key))
    if (thresholds.has(threshold)) {
      invalid(keyPath('config.breakpoints', key), threshold)
    }
    thresholds.add(threshold)
    breakpoints[key] = Object.is(threshold, -0) ? 0 : threshold

    validateKey(key, 'config.cols')
    const count = colsProperties[key]
    assertPositiveSafeInteger(count, keyPath('config.cols', key))
    cols[key] = count
  }
  if (!thresholds.has(0)) invalid('config.breakpoints', breakpointsValue)

  const sorted = [...keys].sort((first, second) => breakpoints[first] - breakpoints[second])
  return Object.freeze({
    breakpoints: freezeRecord(breakpoints) as Breakpoints<B>,
    cols: freezeRecord(cols) as Readonly<Record<B, number>>,
    keys: Object.freeze([...keys]) as readonly B[],
    sorted: Object.freeze(sorted) as readonly B[],
  })
}

export function snapshotResponsiveLayouts<B extends string>(
  value: unknown,
  config: ResponsiveConfigSnapshot<B>,
  options: Readonly<{
    maxRows: number
    collisionMode: CollisionMode
    compactor: Compactor
  }>,
): ResponsiveLayoutsInput<B> {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path: 'responsiveLayouts',
  })
  const layouts = createRecord<ReadonlyLayout>()
  for (const key of Object.keys(properties)) {
    validateKey(key, 'responsiveLayouts')
    if (!config.keys.includes(key as B)) {
      invalid(keyPath('responsiveLayouts', key), key)
    }
    try {
      layouts[key] = Object.freeze(
        snapshotStrictLayout(properties[key] as ReadonlyLayout, {
          cols: config.cols[key as B],
          maxRows: options.maxRows,
          collisionMode: options.collisionMode,
          compactor: options.compactor,
          rowHeight: 0,
          gap: [0, 0],
          containerPadding: [0, 0],
          isDraggable: true,
          isResizable: true,
          restoreOnDrag: false,
          bringToFrontOnInteract: true,
        }),
      )
    } catch (error) {
      if (!(error instanceof GridLayoutValidationError) || !error.path.startsWith('layout')) {
        throw error
      }
      throw new GridLayoutValidationError(error.message, {
        code: error.code,
        path: `${keyPath('responsiveLayouts', key)}${error.path.slice('layout'.length)}`,
        cause: error.cause,
      })
    }
  }
  return freezeRecord(layouts) as ResponsiveLayoutsInput<B>
}

export function snapshotDormantResponsiveInputs<B extends string>(
  breakpointsValue: unknown,
  colsValue: unknown,
  layoutsValue: unknown,
): DormantResponsiveSnapshot<B> {
  const breakpointProperties = readPlainDataObject(breakpointsValue, {
    code: 'invalid-config',
    path: 'config.breakpoints',
  })
  const colsProperties = readPlainDataObject(colsValue, {
    code: 'invalid-config',
    path: 'config.cols',
  })
  const layoutProperties = readPlainDataObject(layoutsValue, {
    code: 'invalid-config',
    path: 'responsiveLayouts',
  })
  const breakpoints = createRecord<number>()
  const cols = createRecord<number>()
  const layouts = createRecord<ReadonlyLayout>()

  for (const key of Object.keys(breakpointProperties)) {
    validateKey(key, 'config.breakpoints')
    const threshold = breakpointProperties[key]
    assertNonNegativeSafeInteger(threshold, keyPath('config.breakpoints', key))
    breakpoints[key] = Object.is(threshold, -0) ? 0 : threshold
  }
  for (const key of Object.keys(colsProperties)) {
    validateKey(key, 'config.cols')
    const count = colsProperties[key]
    assertPositiveSafeInteger(count, keyPath('config.cols', key))
    cols[key] = count
  }
  for (const key of Object.keys(layoutProperties)) {
    validateKey(key, 'responsiveLayouts')
    try {
      layouts[key] = Object.freeze(cloneLayout(layoutProperties[key] as ReadonlyLayout))
    } catch (error) {
      if (!(error instanceof GridLayoutValidationError) || !error.path.startsWith('layout')) {
        throw error
      }
      throw new GridLayoutValidationError(error.message, {
        code: error.code,
        path: `${keyPath('responsiveLayouts', key)}${error.path.slice('layout'.length)}`,
        cause: error.cause,
      })
    }
  }

  return Object.freeze({
    breakpoints: freezeRecord(breakpoints) as Breakpoints<B>,
    cols: freezeRecord(cols) as Readonly<Record<B, number>>,
    layouts: freezeRecord(layouts) as ResponsiveLayoutsInput<B>,
  })
}

export function cloneResponsiveLayouts<B extends string>(
  layouts: ResponsiveLayoutsInput<B> | CompleteResponsiveLayouts<B>,
): Record<B, Layout> {
  const output = createRecord<Layout>()
  for (const key of Object.keys(layouts) as B[]) {
    const layout = layouts[key]
    if (layout) output[key] = cloneLayout(layout)
  }
  return output as Record<B, Layout>
}

function findAuthorSource<B extends string>(
  target: B,
  author: ResponsiveLayoutsInput<B>,
  config: ResponsiveConfigSnapshot<B>,
): Readonly<{ key: B; layout: ReadonlyLayout }> | null {
  const targetIndex = config.sorted.indexOf(target)
  for (let index = targetIndex + 1; index < config.sorted.length; index++) {
    const key = config.sorted[index]
    const wider = author[key]
    if (wider) return { key, layout: wider }
  }
  for (let index = targetIndex - 1; index >= 0; index--) {
    const key = config.sorted[index]
    const narrower = author[key]
    if (narrower) return { key, layout: narrower }
  }
  return null
}

function normalizeResponsiveSource<B extends string>(
  source: ReadonlyLayout,
  sourcePath: string,
  target: B,
  config: ResponsiveConfigSnapshot<B>,
  options: Readonly<{
    maxRows: number
    collisionMode: CollisionMode
    compactor: Compactor
  }>,
): Layout {
  try {
    return normalizeLayout(source, {
      cols: config.cols[target],
      maxRows: options.maxRows,
      collisionMode: options.collisionMode,
      compactor: options.compactor,
    })
  } catch (error) {
    if (!(error instanceof GridLayoutValidationError) || !error.path.startsWith('layout')) {
      throw error
    }

    const indexMatch = /^layout\[(\d+)\]/.exec(error.path)
    if (error.path.endsWith('.minW') && indexMatch) {
      throw new GridLayoutValidationError(error.message, {
        code: 'invalid-config',
        path: keyPath('config.cols', target),
        cause: cloneLayout([source[Number(indexMatch[1])]])[0],
      })
    }
    throw new GridLayoutValidationError(error.message, {
      code: error.code,
      path: `${sourcePath}${error.path.slice('layout'.length)}`,
      cause: error.cause,
    })
  }
}

export function createCompleteResponsiveLayouts<B extends string>(
  author: ResponsiveLayoutsInput<B>,
  initialFallback: ReadonlyLayout,
  config: ResponsiveConfigSnapshot<B>,
  options: Readonly<{
    maxRows: number
    collisionMode: CollisionMode
    compactor: Compactor
  }>,
  initialFallbackPath = 'initialFallback',
): CompleteResponsiveLayouts<B> {
  const complete = createRecord<ReadonlyLayout>()
  for (const key of config.keys) {
    const existing = author[key]
    if (existing) {
      complete[key] = Object.freeze(cloneLayout(existing))
      continue
    }
    const authorSource = findAuthorSource(key, author, config)
    const source = authorSource?.layout ?? initialFallback
    const sourcePath = authorSource
      ? keyPath('responsiveLayouts', authorSource.key)
      : initialFallbackPath
    complete[key] = Object.freeze(
      normalizeResponsiveSource(source, sourcePath, key, config, options),
    )
  }
  return freezeRecord(complete) as CompleteResponsiveLayouts<B>
}

export function getBreakpointFromWidth<B extends string>(
  breakpoints: Breakpoints<B>,
  width: number,
): B {
  const sorted = sortBreakpoints(breakpoints)
  let matching = sorted[0]
  for (let index = 1; index < sorted.length; index++) {
    const breakpoint = sorted[index]
    if (width >= breakpoints[breakpoint]) matching = breakpoint
  }
  return matching
}

export function getColsFromBreakpoint<B extends string>(
  breakpoint: B,
  cols: Readonly<Record<B, number>>,
): number {
  const value = cols[breakpoint]
  if (!value) invalid(keyPath('config.cols', breakpoint), value)
  return value
}

/** @deprecated 仅供旧内部调用；新响应式状态机使用 createCompleteResponsiveLayouts。 */
export function findOrGenerateResponsiveLayout(
  orgLayout: Layout,
  layouts: ResponsiveLayout,
  breakpoints: Breakpoints,
  breakpoint: DefaultBreakpoint,
  _lastBreakpoint: DefaultBreakpoint,
  cols: number,
  compactor: Compactor,
  allowOverlap = false,
): Layout {
  if (layouts[breakpoint]) {
    const layout = correctBounds(cloneLayout(layouts[breakpoint]), { cols }, allowOverlap)
    return allowOverlap ? layout : compactor.compact(layout, cols)
  }
  let layout: ReadonlyLayout = orgLayout
  const breakpointsAbove = sortBreakpoints(breakpoints).slice(
    sortBreakpoints(breakpoints).indexOf(breakpoint),
  )
  for (const candidate of breakpointsAbove) {
    if (layouts[candidate]) {
      layout = layouts[candidate]
      break
    }
  }
  const bounded = correctBounds(cloneLayout(layout), { cols }, allowOverlap)
  return allowOverlap ? bounded : compactor.compact(bounded, cols)
}

/** @deprecated 仅供旧内部调用。 */
export function generateResponsiveLayout(
  layout: Layout,
  _breakpoints: Breakpoints,
  _breakpoint: DefaultBreakpoint,
  _lastBreakpoint: DefaultBreakpoint,
  cols: number,
  compactor: Compactor,
  allowOverlap = false,
): Layout {
  const bounded = correctBounds(cloneLayout(layout), { cols }, allowOverlap)
  return allowOverlap ? bounded : compactor.compact(bounded, cols)
}

export function sortBreakpoints<B extends string>(breakpoints: Breakpoints<B>): B[] {
  return (Object.keys(breakpoints) as B[]).sort(
    (first, second) => breakpoints[first] - breakpoints[second],
  )
}
