/**
 * 布局项定位样式的批量求值与缓存控制器。
 *
 * 职责：调用 position strategy、校验派生几何、生成样式 Map，并同步到已注册 GridItem。
 * 边界：不修改布局模型或引擎事务；调用方决定何时提交、预览或恢复这批样式。
 * 关键约束：样式以整批原子方式求值，任一元素失败时不得留下部分已提交结果。
 */
import { GridLayoutValidationError } from '../../core/errors'
import { validatePositionGeometry, validatePositionStyleResult } from '../../core/position-style'
import { gridToPixelRect, isDerivedGeometryError } from '../../core/utils'
import { getLayoutItem } from '../../helpers/common'

import type { GridLayoutRuntimeError } from '../../composables/useGridLayout'
import type { InternalEffectiveConfig } from '../../core/layout-engine'
import type { GridItemRegistration } from '../../helpers/internal-types'
import type {
  LayoutItem,
  LayoutOperationReason,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../../helpers/types'

export type PositionStyleMap = ReadonlyMap<LayoutItem['i'], Readonly<Record<string, string>>>

export type PositionStyleBatchResult =
  | {
      ok: true
      styles: PositionStyleMap
      ready: boolean
    }
  | {
      ok: false
      cause: unknown
      path: string
      reason: 'invalid-input'
      runtimeCode: Extract<
        GridLayoutRuntimeError['code'],
        'invalid-layout' | 'invalid-config' | 'derived-geometry-overflow'
      >
      source: 'geometry'
    }
  | {
      ok: false
      cause: unknown
      path: string
      reason: Extract<LayoutOperationReason, 'extension-error' | 'extension-invalid-result'>
      runtimeCode: Extract<
        GridLayoutRuntimeError['code'],
        'extension-error' | 'extension-invalid-result'
      >
      source: 'position-strategy'
    }

interface PositionStyleState {
  width: number | null
  positionStyleRevision: number
  positionStyleReady: boolean
}

interface GridPositionStyleControllerOptions {
  state: PositionStyleState
  registeredItems: Iterable<GridItemRegistration>
  getDirection(): 'ltr' | 'rtl'
  getEffectiveScale(): number
}

export interface GridPositionStyleController {
  evaluate(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  commit(styles: PositionStyleMap, ready: boolean, persist: boolean, unblock?: boolean): void
  disableInteractions(): void
  restoreCommitted(): void
  getStyle(id: LayoutItem['i']): Readonly<Record<string, string>>
  getCommitted(): PositionStyleMap
  prime(styles: PositionStyleMap): void
}

const emptyPositionStyle = Object.freeze(Object.create(null)) as Readonly<Record<string, string>>

function calculateZIndexRanks(layout: ReadonlyLayout): Map<LayoutItem['i'], number> {
  const ordered = layout
    .map((item, index) => ({ id: item.i, index, zIndex: item.zIndex ?? 0 }))
    .sort((first, second) => first.zIndex - second.zIndex || first.index - second.index)
  return new Map(ordered.map((item, rank) => [item.id, rank]))
}

/**
 * 管理 GridLayout 的定位样式求值与已提交快照，不负责交互终止或事件派发。
 */
export function createGridPositionStyleController(
  options: GridPositionStyleControllerOptions,
): GridPositionStyleController {
  let currentStyles: PositionStyleMap = new Map()
  let committedStyles: PositionStyleMap = new Map()
  let blocked = false

  function calculateGeometry(
    item: ReadonlyLayoutItem,
    width: number,
    config: InternalEffectiveConfig,
  ) {
    const direction = options.getDirection()
    const rect = gridToPixelRect(item, {
      width,
      cols: config.cols,
      rowHeight: config.rowHeight,
      gap: config.gap,
      containerPadding: config.containerPadding,
      rtl: direction === 'rtl',
      effectiveScale: options.getEffectiveScale(),
    })
    return validatePositionGeometry(rect.top, rect.inlineStart, rect.width, rect.height, direction)
  }

  /** 按 Layout 原顺序求值到 detached map；调用方只在整批成功后提交该 map。 */
  function evaluate(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult {
    if (width === null || width <= 0) return { ok: true, styles: new Map(), ready: false }

    const usesCssTransforms = strategy.usesCssTransforms
    const useRtl = options.getDirection() === 'rtl'
    const ranks = calculateZIndexRanks(layout)
    const styles = new Map<LayoutItem['i'], Readonly<Record<string, string>>>()
    for (const [index, item] of layout.entries()) {
      const basePath = `layout[${index}].style`
      let geometry
      try {
        geometry = calculateGeometry(item, width, config)
      } catch (error) {
        const validation = error instanceof GridLayoutValidationError ? error : null
        return {
          ok: false,
          cause: error,
          path: validation?.path ?? basePath,
          reason: 'invalid-input',
          runtimeCode: isDerivedGeometryError(error)
            ? 'derived-geometry-overflow'
            : (validation?.code ?? 'invalid-config'),
          source: 'geometry',
        }
      }

      let ltrValue: unknown
      try {
        ltrValue = strategy.getStyle(
          geometry.top,
          geometry.inlineStart,
          geometry.width,
          geometry.height,
        )
      } catch (error) {
        return {
          ok: false,
          cause: error,
          path: basePath,
          reason: 'extension-error',
          runtimeCode: 'extension-error',
          source: 'position-strategy',
        }
      }
      const ltr = validatePositionStyleResult(
        ltrValue,
        usesCssTransforms,
        'ltr',
        geometry,
        basePath,
      )
      if (!ltr.ok) {
        return {
          ok: false,
          cause: ltr.cause,
          path: ltr.path,
          reason: 'extension-invalid-result',
          runtimeCode: 'extension-invalid-result',
          source: 'position-strategy',
        }
      }

      let rtlValue: unknown
      try {
        rtlValue = strategy.getRtlStyle(
          geometry.top,
          geometry.inlineStart,
          geometry.width,
          geometry.height,
        )
      } catch (error) {
        return {
          ok: false,
          cause: error,
          path: basePath,
          reason: 'extension-error',
          runtimeCode: 'extension-error',
          source: 'position-strategy',
        }
      }
      const rtl = validatePositionStyleResult(
        rtlValue,
        usesCssTransforms,
        'rtl',
        geometry,
        basePath,
      )
      if (!rtl.ok) {
        return {
          ok: false,
          cause: rtl.cause,
          path: rtl.path,
          reason: 'extension-invalid-result',
          runtimeCode: 'extension-invalid-result',
          source: 'position-strategy',
        }
      }

      styles.set(
        item.i,
        Object.freeze({
          ...(useRtl ? rtl.style : ltr.style),
          '--vgl-item-z-index': String(ranks.get(item.i)),
        }),
      )
    }

    // GridItem 会以最小/最大尺寸初始化 resize 约束，提交宽度前同步覆盖这些可达边界。
    try {
      for (const registeredItem of options.registeredItems) {
        if (!registeredItem.state.registered || !registeredItem.state.resizable) continue
        const item = getLayoutItem(layout, registeredItem.i)
        if (!item || item.static) continue
        const maximumW = Math.min(item.maxW ?? Infinity, config.cols - item.x)
        const maximumH = Math.min(item.maxH ?? Infinity, config.maxRows - item.y)
        for (const [w, h] of [
          [item.minW ?? 1, item.minH ?? 1],
          [maximumW === Infinity ? 1 : maximumW, maximumH === Infinity ? 1 : maximumH],
        ] as const) {
          calculateGeometry({ ...item, x: 0, y: 0, w, h }, width, config)
        }
      }
    } catch (error) {
      const validation = error instanceof GridLayoutValidationError ? error : null
      return {
        ok: false,
        cause: error,
        path: validation?.path ?? 'geometry',
        reason: 'invalid-input',
        runtimeCode: isDerivedGeometryError(error)
          ? 'derived-geometry-overflow'
          : (validation?.code ?? 'invalid-config'),
        source: 'geometry',
      }
    }

    return { ok: true, styles, ready: true }
  }

  function commit(
    styles: PositionStyleMap,
    ready: boolean,
    persist: boolean,
    unblock = true,
  ): void {
    // blocked 表示策略或几何已失败；只有显式 unblock 的成功批次才能重新开放指针交互。
    if (unblock) blocked = false
    currentStyles = new Map(styles)
    options.state.positionStyleReady = ready && !blocked
    options.state.positionStyleRevision += 1
    if (persist) committedStyles = new Map(styles)
  }

  function disableInteractions(): void {
    blocked = true
    options.state.positionStyleReady = false
    for (const item of options.registeredItems) item.disableInteractionBinding()
  }

  function restoreCommitted(): void {
    commit(committedStyles, options.state.width !== null && options.state.width > 0, false, false)
  }

  function getStyle(id: LayoutItem['i']): Readonly<Record<string, string>> {
    return currentStyles.get(id) ?? emptyPositionStyle
  }

  function getCommitted(): PositionStyleMap {
    return committedStyles
  }

  function prime(styles: PositionStyleMap): void {
    currentStyles = new Map(styles)
    committedStyles = new Map(styles)
    options.state.positionStyleRevision += 1
  }

  return {
    evaluate,
    commit,
    disableInteractions,
    restoreCommitted,
    getStyle,
    getCommitted,
    prime,
  }
}
