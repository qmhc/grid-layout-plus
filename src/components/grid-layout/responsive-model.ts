/**
 * Responsive composable 使用的纯模型与比较函数。
 *
 * 职责：解析响应式间距、比较配置与 layouts、构造 pending 快照，并识别外部 author 更新。
 * 边界：不保存运行时状态、不触发事件，也不访问 Vue 生命周期；所有输入都通过参数显式传入。
 * 关键约束：返回的模型以不可变快照为准，比较时同时考虑布局几何和调用方提供的元数据。
 */
import { GridLayoutValidationError } from '../../core/errors'
import { layoutsSemanticallyEqual, snapshotStrictLayout } from '../../core/layout-engine'
import { readPlainDataObject } from '../../core/validation'
import { cloneLayout } from '../../helpers/common'
import { cloneResponsiveLayouts, snapshotResponsiveLayouts } from '../../helpers/responsive'

import type { InternalEffectiveConfig } from '../../core/layout-engine'
import type { ResponsiveConfigSnapshot } from '../../helpers/responsive'
import type {
  CompleteResponsiveLayouts,
  LayoutOperationResult,
  ReadonlyLayout,
  ResponsiveLayoutsInput,
} from '../../helpers/types'

/** Responsive 布局更新等待 layout 与 responsiveLayouts 双重确认时的事务附加信息。 */
export interface PendingResponsiveTransaction<B extends string> {
  expectedLayouts: CompleteResponsiveLayouts<B>
  authorLayouts: ResponsiveLayoutsInput<B>
  config: ResponsiveConfigSnapshot<B>
  breakpoint: B
  previousBreakpoint: B | null
  layoutConfirmed: boolean
  layoutsConfirmed: boolean
  readyAfter: boolean
}

export function resolveResponsiveSpacing<B extends string>(
  value: unknown,
  path: 'config.gap' | 'config.containerPadding',
  fallback: readonly [number, number],
  breakpoint: B | null,
  config: ResponsiveConfigSnapshot<B> | null,
  responsive: boolean,
): readonly [number, number] {
  if (value === undefined) return fallback
  const invalid = (invalidPath: string, cause: unknown): never => {
    throw new GridLayoutValidationError(`Invalid responsive spacing at ${path}`, {
      code: 'invalid-config',
      path: invalidPath,
      cause,
    })
  }
  if (Array.isArray(value)) return value as unknown as readonly [number, number]
  if (!responsive || breakpoint === null || !config) return invalid(path, value)
  const resolvedConfig = config
  const resolvedBreakpoint = breakpoint
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path,
  })
  const keys = Object.keys(properties)
  if (
    keys.length !== resolvedConfig.keys.length ||
    resolvedConfig.keys.some(key => !keys.includes(key))
  ) {
    const key =
      resolvedConfig.keys.find(candidate => !keys.includes(candidate)) ??
      keys.find(candidate => !resolvedConfig.keys.includes(candidate as B)) ??
      ''
    invalid(`${path}[${JSON.stringify(key)}]`, key)
  }
  return properties[resolvedBreakpoint] as readonly [number, number]
}

export function responsiveLayoutsEqual<B extends string>(
  first: ResponsiveLayoutsInput<B>,
  second: CompleteResponsiveLayouts<B>,
  config: ResponsiveConfigSnapshot<B>,
): boolean {
  return config.keys.every(
    key => first[key] !== undefined && layoutsSemanticallyEqual(first[key]!, second[key]),
  )
}

export function responsiveConfigsEqual<B extends string>(
  first: ResponsiveConfigSnapshot<B>,
  second: ResponsiveConfigSnapshot<B>,
): boolean {
  return (
    first.keys.length === second.keys.length &&
    first.keys.every(
      key =>
        second.keys.includes(key) &&
        first.breakpoints[key] === second.breakpoints[key] &&
        first.cols[key] === second.cols[key],
    )
  )
}

export function createCurrentResponsiveTransaction<B extends string>(options: {
  result: LayoutOperationResult
  responsive: boolean
  breakpoint: B | null
  completeLayouts: CompleteResponsiveLayouts<B> | null
  config: ResponsiveConfigSnapshot<B> | null
}): PendingResponsiveTransaction<B> | null {
  const { result, responsive, breakpoint, completeLayouts, config } = options
  if (!responsive || breakpoint === null || !completeLayouts || !config) return null
  const expectedLayouts = cloneResponsiveLayouts(completeLayouts)
  expectedLayouts[breakpoint] = cloneLayout(result.layout)
  return {
    expectedLayouts,
    authorLayouts: expectedLayouts,
    config,
    breakpoint,
    previousBreakpoint: breakpoint,
    layoutConfirmed: false,
    layoutsConfirmed: false,
    readyAfter: false,
  }
}

export function hasExternalResponsiveAuthor<B extends string>(options: {
  observedInput: ResponsiveLayoutsInput<B>
  committedInputIdentity: unknown
  committedConfig: ResponsiveConfigSnapshot<B> | null
  committedCompleteLayouts: CompleteResponsiveLayouts<B> | null
  engineConfig: InternalEffectiveConfig
}): boolean {
  const {
    observedInput,
    committedInputIdentity,
    committedConfig,
    committedCompleteLayouts,
    engineConfig,
  } = options
  if (Object.is(observedInput, committedInputIdentity)) return false
  if (!committedConfig || !committedCompleteLayouts) return true
  try {
    const observed = snapshotResponsiveLayouts(observedInput, committedConfig, engineConfig)
    return !responsiveLayoutsEqual(observed, committedCompleteLayouts, committedConfig)
  } catch {
    return true
  }
}

export function snapshotCommittedResponsiveAuthor<B extends string>(options: {
  observedInput: ResponsiveLayoutsInput<B>
  committedInputIdentity: unknown
  committedAuthorLayouts: ResponsiveLayoutsInput<B>
  committedConfig: ResponsiveConfigSnapshot<B> | null
  committedCompleteLayouts: CompleteResponsiveLayouts<B> | null
  config: ResponsiveConfigSnapshot<B>
  engineConfig: InternalEffectiveConfig
}): ResponsiveLayoutsInput<B> {
  const { observedInput, committedAuthorLayouts, config, engineConfig } = options
  if (
    hasExternalResponsiveAuthor({
      observedInput,
      committedInputIdentity: options.committedInputIdentity,
      committedConfig: options.committedConfig,
      committedCompleteLayouts: options.committedCompleteLayouts,
      engineConfig,
    })
  ) {
    return snapshotResponsiveLayouts(observedInput, config, engineConfig)
  }
  const candidate = Object.create(null) as Partial<Record<B, ReadonlyLayout>>
  for (const key of config.keys) {
    const layout = committedAuthorLayouts[key]
    if (!layout) continue
    try {
      snapshotResponsiveLayouts({ [key]: layout }, config, engineConfig)
      candidate[key] = layout
    } catch (error) {
      if (!(error instanceof GridLayoutValidationError) || error.code !== 'invalid-layout') {
        throw error
      }
    }
  }
  return snapshotResponsiveLayouts(candidate, config, engineConfig)
}

export function responsiveModelsMatch<B extends string>(options: {
  layoutInput: ReadonlyLayout
  responsiveLayoutsInput: ResponsiveLayoutsInput<B>
  complete: CompleteResponsiveLayouts<B>
  breakpoint: B
  config: ResponsiveConfigSnapshot<B>
  engineConfig: InternalEffectiveConfig
}): boolean {
  try {
    const observedLayout = snapshotStrictLayout(options.layoutInput, options.engineConfig)
    const observedLayouts = snapshotResponsiveLayouts(
      options.responsiveLayoutsInput,
      options.config,
      options.engineConfig,
    )
    return (
      layoutsSemanticallyEqual(observedLayout, options.complete[options.breakpoint]) &&
      responsiveLayoutsEqual(observedLayouts, options.complete, options.config)
    )
  } catch {
    return false
  }
}
