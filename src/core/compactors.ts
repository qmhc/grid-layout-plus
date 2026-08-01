import { cloneLayout, compact } from '../helpers/common'
import { GridLayoutValidationError } from './errors'
import { assertPositiveSafeInteger, snapshotCompactor } from './validation'

import type {
  Compactor,
  Layout,
  LayoutItem,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../helpers/types'

function failLayout(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid layout value at ${path}`, {
    code: 'invalid-layout',
    path,
    cause,
  })
}

function safeEnd(first: number, second: number, path: string): number {
  const result = first + second
  if (!Number.isSafeInteger(result) || result < 0) failLayout(path, result)
  return result
}

function prepareLayout(layout: ReadonlyLayout, cols: number): Layout {
  assertPositiveSafeInteger(cols, 'config.cols')
  const cloned = cloneLayout(layout)
  for (let index = 0; index < cloned.length; index++) {
    safeEnd(cloned[index].x, cloned[index].w, `layout[${index}].w`)
    safeEnd(cloned[index].y, cloned[index].h, `layout[${index}].h`)
  }
  return cloned
}

function collides(first: ReadonlyLayoutItem, second: ReadonlyLayoutItem): boolean {
  if (Object.is(first.i, second.i)) return false
  return !(
    first.x + first.w <= second.x ||
    first.x >= second.x + second.w ||
    first.y + first.h <= second.y ||
    first.y >= second.y + second.h
  )
}

function firstCollision(
  layout: readonly ReadonlyLayoutItem[],
  item: ReadonlyLayoutItem,
): ReadonlyLayoutItem | undefined {
  for (let index = 0; index < layout.length; index++) {
    if (collides(layout[index], item)) return layout[index]
  }
}

function layoutIndexes(layout: ReadonlyLayout): Map<string | number, number> {
  return new Map(layout.map((item, index) => [item.i, index]))
}

function sortByRowCol(layout: Layout): Layout {
  const indexes = layoutIndexes(layout)
  return Array.from(layout).sort(
    (first, second) =>
      first.y - second.y || first.x - second.x || indexes.get(first.i)! - indexes.get(second.i)!,
  )
}

function sortByColRow(layout: Layout): Layout {
  const indexes = layoutIndexes(layout)
  return Array.from(layout).sort(
    (first, second) =>
      first.x - second.x || first.y - second.y || indexes.get(first.i)! - indexes.get(second.i)!,
  )
}

/**
 * 垂直压缩器 — 委托给现有 compact() 逻辑。
 * 等价于 compact(layout, true)。
 */
export const verticalCompactor: Compactor = {
  type: 'vertical',
  compact(layout: ReadonlyLayout, cols: number): Layout {
    prepareLayout(layout, cols)
    return compact(layout, true)
  },
}

/**
 * 水平压缩器 — 按列优先排序后向左压缩。
 *
 * 算法：
 * 1. 按列优先排序（先 x 后 y）
 * 2. 静态元素加入碰撞列表
 * 3. 对每个非静态元素，将 x 向左移动至无碰撞的最小位置
 * 4. 碰撞时放置在障碍物右侧，超出列边界时换到下一行
 */
export const horizontalCompactor: Compactor = {
  type: 'horizontal',
  compact(layout: ReadonlyLayout, cols: number): Layout {
    return compactHorizontally(prepareLayout(layout, cols), cols)
  },
}

function compactHorizontally(layout: Layout, cols: number): Layout {
  const indexes = layoutIndexes(layout)
  const compareWith = layout.filter(item => item.static)
  const sorted = sortByColRow(layout)

  for (const item of sorted) {
    if (item.static) continue
    const itemIndex = indexes.get(item.i)!
    if (item.w > cols) failLayout(`layout[${itemIndex}].w`, item.w)
    item.x = 0

    let collision: ReadonlyLayoutItem | undefined
    while ((collision = firstCollision(compareWith, item))) {
      item.x = safeEnd(collision.x, collision.w, `layout[${itemIndex}].x`)
      if (safeEnd(item.x, item.w, `layout[${itemIndex}].w`) > cols) {
        item.x = 0
        item.y = safeEnd(collision.y, collision.h, `layout[${itemIndex}].y`)
      }
    }
    compareWith.push(item)
  }
  return layout
}

/** 无压缩器 — 返回 detached 布局，不移动任何元素。 */
export const noCompactor: Compactor = {
  type: 'vertical',
  compact(layout: ReadonlyLayout, cols: number): Layout {
    return prepareLayout(layout, cols)
  },
}

/**
 * 创建带 allowOverlap 选项的压缩器包装。
 * allowOverlap 仅供旧配置推导 collisionMode，显式模式仍调用原压缩器。
 *
 * @deprecated 请改用 GridLayout 的 collisionMode="overlap"。
 */
export function withOverlap(input: Compactor): Compactor {
  const compactor = snapshotCompactor(input)
  return {
    ...(compactor.type === undefined ? {} : { type: compactor.type }),
    compact(layout: ReadonlyLayout, cols: number): Layout {
      return compactor.compact(layout, cols)
    },
    allowOverlap: true,
  }
}

// ---------------------------------------------------------------------------
// 增量区间 Treap — 用于减少 Fast Compactors 的碰撞候选集
// ---------------------------------------------------------------------------

/** 区间树节点 */
interface IntervalNode {
  entry: IntervalEntry
  priority: number
  maxHi: number
  left: IntervalNode | null
  right: IntervalNode | null
}

interface IntervalEntry {
  lo: number
  hi: number
  order: number
  item: LayoutItem
}

function intervalPriority(order: number): number {
  let value = (order + 1) * 0x9e3779b1
  value ^= value >>> 16
  value = Math.imul(value, 0x85ebca6b)
  value ^= value >>> 13
  return value >>> 0
}

function updateIntervalNode(node: IntervalNode): void {
  node.maxHi = Math.max(
    node.entry.hi,
    node.left?.maxHi ?? -Infinity,
    node.right?.maxHi ?? -Infinity,
  )
}

function compareIntervalEntries(a: IntervalEntry, b: IntervalEntry): number {
  if (a.lo !== b.lo) return a.lo - b.lo
  if (a.hi !== b.hi) return a.hi - b.hi
  return a.order - b.order
}

function rotateIntervalLeft(node: IntervalNode): IntervalNode {
  const next = node.right!
  node.right = next.left
  next.left = node
  updateIntervalNode(node)
  updateIntervalNode(next)
  return next
}

function rotateIntervalRight(node: IntervalNode): IntervalNode {
  const next = node.left!
  node.left = next.right
  next.right = node
  updateIntervalNode(node)
  updateIntervalNode(next)
  return next
}

/** 插入区间并维持按起点排序、按 priority 平衡的 Treap。 */
function insertInterval(node: IntervalNode | null, entry: IntervalEntry): IntervalNode {
  if (!node) {
    return {
      entry,
      priority: intervalPriority(entry.order),
      maxHi: entry.hi,
      left: null,
      right: null,
    }
  }

  if (compareIntervalEntries(entry, node.entry) < 0) {
    node.left = insertInterval(node.left, entry)
    if (node.left.priority < node.priority) node = rotateIntervalRight(node)
  } else {
    node.right = insertInterval(node.right, entry)
    if (node.right.priority < node.priority) node = rotateIntervalLeft(node)
  }

  updateIntervalNode(node)
  return node
}

/**
 * 查询区间树中与 [qLo, qHi) 重叠的所有条目。
 * 重叠条件：entry.lo < qHi && entry.hi > qLo（开区间端点）。
 */
function queryIntervalTree(
  node: IntervalNode | null,
  qLo: number,
  qHi: number,
  result: IntervalEntry[],
): void {
  if (!node) return

  if (node.left && node.left.maxHi > qLo) {
    queryIntervalTree(node.left, qLo, qHi, result)
  }

  if (node.entry.lo < qHi && node.entry.hi > qLo) {
    result.push(node.entry)
  }

  if (node.entry.lo < qHi) {
    queryIntervalTree(node.right, qLo, qHi, result)
  }
}

/**
 * 在候选列表中查找与 item 碰撞的第一个元素（用于 fast compactors 的逐步压缩）。
 * candidates 应来自区间树查询结果（已按一个轴过滤），此处再验证另一个轴。
 */
function firstCollisionAmong(
  candidates: IntervalEntry[],
  item: LayoutItem,
): LayoutItem | undefined {
  let first: IntervalEntry | undefined

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const c = candidate.item
    if (c === item) continue
    // 完整 2D 碰撞检测
    if (
      item.x < c.x + c.w &&
      item.x + item.w > c.x &&
      item.y < c.y + c.h &&
      item.y + item.h > c.y
    ) {
      if (!first || candidate.order < first.order) first = candidate
    }
  }

  return first?.item
}

// ---------------------------------------------------------------------------
// Fast Vertical Compactor
// ---------------------------------------------------------------------------

/**
 * 快速垂直压缩器 — 使用区间树按 x 轴索引已放置元素，
 * 查询开销取决于区间索引返回的候选数量，不承诺无条件复杂度上界。
 *
 * 输出与 verticalCompactor 完全一致。
 */
export const fastVerticalCompactor: Compactor = {
  type: 'vertical',
  compact(layout: ReadonlyLayout, cols: number): Layout {
    const cloned = prepareLayout(layout, cols)
    const sorted = sortByRowCol(cloned)
    const indexes = layoutIndexes(cloned)
    let tree: IntervalNode | null = null
    let order = 0

    for (let i = 0; i < cloned.length; i++) {
      const item = cloned[i]
      if (item.static) {
        tree = insertInterval(tree, {
          lo: item.x,
          hi: safeEnd(item.x, item.w, `layout[${i}].w`),
          order: order++,
          item,
        })
      }
    }

    for (const item of sorted) {
      if (!item.static) {
        fastCompactItemVertically(tree, item, indexes.get(item.i)!)
        tree = insertInterval(tree, {
          lo: item.x,
          hi: safeEnd(item.x, item.w, `layout[${indexes.get(item.i)!}].w`),
          order: order++,
          item,
        })
      }
    }

    return cloned
  },
}

/**
 * 快速垂直压缩单个元素：使用区间树查询 x 轴重叠的候选元素，
 * 然后在候选集中做 y 轴碰撞检测。
 */
function fastCompactItemVertically(
  tree: IntervalNode | null,
  item: LayoutItem,
  itemIndex: number,
): void {
  const candidates: IntervalEntry[] = []
  queryIntervalTree(tree, item.x, safeEnd(item.x, item.w, `layout[${itemIndex}].w`), candidates)
  item.y = 0

  let collision: LayoutItem | undefined
  while ((collision = firstCollisionAmong(candidates, item))) {
    item.y = safeEnd(collision.y, collision.h, `layout[${itemIndex}].y`)
  }
}

// ---------------------------------------------------------------------------
// Fast Horizontal Compactor
// ---------------------------------------------------------------------------

/**
 * 快速水平压缩器 — 使用区间树按 y 轴索引已放置元素，
 * 查询开销取决于区间索引返回的候选数量，不承诺无条件复杂度上界。
 *
 * 输出与 horizontalCompactor 完全一致。
 */
export const fastHorizontalCompactor: Compactor = {
  type: 'horizontal',
  compact(layout: ReadonlyLayout, cols: number): Layout {
    const cloned = prepareLayout(layout, cols)
    const sorted = sortByColRow(cloned)
    const indexes = layoutIndexes(cloned)
    let tree: IntervalNode | null = null
    let order = 0

    for (let i = 0; i < cloned.length; i++) {
      const item = cloned[i]
      if (item.static) {
        tree = insertInterval(tree, {
          lo: item.y,
          hi: safeEnd(item.y, item.h, `layout[${i}].h`),
          order: order++,
          item,
        })
      }
    }

    for (const item of sorted) {
      const itemIndex = indexes.get(item.i)!
      if (!item.static) {
        if (item.w > cols) failLayout(`layout[${itemIndex}].w`, item.w)
        fastCompactItemHorizontally(tree, item, cols, itemIndex)
        tree = insertInterval(tree, {
          lo: item.y,
          hi: safeEnd(item.y, item.h, `layout[${itemIndex}].h`),
          order: order++,
          item,
        })
      }
    }

    return cloned
  },
}

/**
 * 快速水平压缩单个元素：使用区间树查询 y 轴重叠的候选元素，
 * 然后在候选集中做 x 轴碰撞检测。
 */
function fastCompactItemHorizontally(
  tree: IntervalNode | null,
  item: LayoutItem,
  cols: number,
  itemIndex: number,
): void {
  item.x = 0
  let candidates: IntervalEntry[] = []
  const refreshCandidates = () => {
    candidates = []
    queryIntervalTree(tree, item.y, safeEnd(item.y, item.h, `layout[${itemIndex}].h`), candidates)
  }
  refreshCandidates()

  let collision: LayoutItem | undefined
  while ((collision = firstCollisionAmong(candidates, item))) {
    item.x = safeEnd(collision.x, collision.w, `layout[${itemIndex}].x`)
    if (safeEnd(item.x, item.w, `layout[${itemIndex}].w`) > cols) {
      item.x = 0
      item.y = safeEnd(collision.y, collision.h, `layout[${itemIndex}].y`)
      refreshCandidates()
    }
  }
}
