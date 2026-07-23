import {
  cloneLayout,
  compact,
  getFirstCollision,
  getStatics,
  sortLayoutItemsByColRow,
  sortLayoutItemsByRowCol,
} from '../helpers/common'

import type { Compactor, Layout, LayoutItem } from '../helpers/types'

/**
 * 垂直压缩器 — 委托给现有 compact() 逻辑。
 * 等价于 compact(layout, true)。
 */
export const verticalCompactor: Compactor = {
  type: 'vertical',
  compact(layout: Layout, _cols: number): Layout {
    return compact(cloneLayout(layout), true)
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
  compact(layout: Layout, cols: number): Layout {
    const cloned = cloneLayout(layout)
    const compareWith = getStatics(cloned)
    const sorted = sortLayoutItemsByColRow(cloned)
    const out: Layout = Array(cloned.length)

    for (let i = 0, len = sorted.length; i < len; i++) {
      let l = sorted[i]

      if (!l.static) {
        l = compactItemHorizontally(compareWith, l, cols)
        compareWith.push(l)
      }

      out[cloned.findIndex(item => item.i === l.i)] = l
      l.moved = false
    }

    return out
  },
}

/**
 * 水平压缩单个元素：保持 y 不变，将 x 向左移动至无碰撞的最小位置。
 * 与 compactItem 的垂直逻辑对称：先尽量向左，再处理碰撞向右推移。
 */
function compactItemHorizontally(compareWith: Layout, l: LayoutItem, cols: number): LayoutItem {
  l.x = Math.max(l.x, 0)
  l.y = Math.max(l.y, 0)

  // 向左移动至无碰撞的最小 x
  while (l.x > 0 && !getFirstCollision(compareWith, l)) {
    l.x--
  }

  // 向右推移直到无碰撞（处理初始碰撞或移动过头的情况）
  let collision: LayoutItem | undefined
  while ((collision = getFirstCollision(compareWith, l))) {
    l.x = collision.x + collision.w

    if (l.x + l.w > cols) {
      l.x = cols - l.w
      l.y++

      while (l.x > 0 && !getFirstCollision(compareWith, l)) {
        l.x--
      }
    }
  }

  l.x = Math.max(l.x, 0)
  return l
}

/**
 * 无压缩器 — 返回浅拷贝，不移动任何元素。
 */
export const noCompactor: Compactor = {
  compact(layout: Layout, _cols: number): Layout {
    return cloneLayout(layout)
  },
}

/**
 * 创建带 allowOverlap 选项的压缩器包装。
 * 当 allowOverlap=true 时跳过碰撞推移，仅返回浅拷贝。
 */
export function withOverlap(_compactor: Compactor): Compactor {
  return {
    type: _compactor.type,
    compact(layout: Layout, _cols: number): Layout {
      return cloneLayout(layout)
    },
    allowOverlap: true,
  }
}

// ---------------------------------------------------------------------------
// 增量区间 Treap — 用于 Fast Compactors 的 O(n log n) 碰撞检测加速
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
 * 将碰撞查询从 O(n) 降为 O(log n + k)，整体 O(n log n)。
 *
 * 输出与 verticalCompactor 完全一致。
 */
export const fastVerticalCompactor: Compactor = {
  type: 'vertical',
  compact(layout: Layout, _cols: number): Layout {
    const cloned = cloneLayout(layout)
    const sorted = sortLayoutItemsByRowCol(cloned)
    const indexes = new Map(cloned.map((item, index) => [item.i, index]))
    let tree: IntervalNode | null = null
    let order = 0

    for (let i = 0; i < cloned.length; i++) {
      const item = cloned[i]
      if (item.static) {
        tree = insertInterval(tree, {
          lo: item.x,
          hi: item.x + item.w,
          order: order++,
          item,
        })
      }
    }

    const out: Layout = Array(cloned.length)

    for (let i = 0, len = sorted.length; i < len; i++) {
      let l = sorted[i]

      if (!l.static) {
        l = fastCompactItemVertically(tree, l)
        tree = insertInterval(tree, {
          lo: l.x,
          hi: l.x + l.w,
          order: order++,
          item: l,
        })
      }

      out[indexes.get(l.i)!] = l
      l.moved = false
    }

    return out
  },
}

/**
 * 快速垂直压缩单个元素：使用区间树查询 x 轴重叠的候选元素，
 * 然后在候选集中做 y 轴碰撞检测。
 */
function fastCompactItemVertically(tree: IntervalNode | null, l: LayoutItem): LayoutItem {
  // 查询 x 轴与当前元素重叠的所有已放置元素
  const candidates: IntervalEntry[] = []
  queryIntervalTree(tree, l.x, l.x + l.w, candidates)

  // 向上移动至无碰撞的最小 y
  while (l.y > 0 && !firstCollisionAmong(candidates, l)) {
    l.y--
  }

  // 向下推移直到无碰撞
  let collision: LayoutItem | undefined
  while ((collision = firstCollisionAmong(candidates, l))) {
    l.y = collision.y + collision.h
  }

  return l
}

// ---------------------------------------------------------------------------
// Fast Horizontal Compactor
// ---------------------------------------------------------------------------

/**
 * 快速水平压缩器 — 使用区间树按 y 轴索引已放置元素，
 * 将碰撞查询从 O(n) 降为 O(log n + k)，整体 O(n log n)。
 *
 * 输出与 horizontalCompactor 完全一致。
 */
export const fastHorizontalCompactor: Compactor = {
  type: 'horizontal',
  compact(layout: Layout, cols: number): Layout {
    const cloned = cloneLayout(layout)
    const sorted = sortLayoutItemsByColRow(cloned)
    const indexes = new Map(cloned.map((item, index) => [item.i, index]))
    let tree: IntervalNode | null = null
    let order = 0

    for (let i = 0; i < cloned.length; i++) {
      const item = cloned[i]
      if (item.static) {
        tree = insertInterval(tree, {
          lo: item.y,
          hi: item.y + item.h,
          order: order++,
          item,
        })
      }
    }

    const out: Layout = Array(cloned.length)

    for (let i = 0, len = sorted.length; i < len; i++) {
      let l = sorted[i]

      if (!l.static) {
        l = fastCompactItemHorizontally(tree, l, cols)
        tree = insertInterval(tree, {
          lo: l.y,
          hi: l.y + l.h,
          order: order++,
          item: l,
        })
      }

      out[indexes.get(l.i)!] = l
      l.moved = false
    }

    return out
  },
}

/**
 * 快速水平压缩单个元素：使用区间树查询 y 轴重叠的候选元素，
 * 然后在候选集中做 x 轴碰撞检测。
 */
function fastCompactItemHorizontally(
  tree: IntervalNode | null,
  l: LayoutItem,
  cols: number,
): LayoutItem {
  l.x = Math.max(l.x, 0)
  l.y = Math.max(l.y, 0)

  let candidates: IntervalEntry[] = []
  const refreshCandidates = () => {
    candidates = []
    queryIntervalTree(tree, l.y, l.y + l.h, candidates)
  }
  refreshCandidates()

  // 向左移动至无碰撞的最小 x
  while (l.x > 0 && !firstCollisionAmong(candidates, l)) {
    l.x--
  }

  // 向右推移直到无碰撞
  let collision: LayoutItem | undefined
  while ((collision = firstCollisionAmong(candidates, l))) {
    l.x = collision.x + collision.w

    if (l.x + l.w > cols) {
      l.x = cols - l.w
      l.y++
      refreshCandidates()

      while (l.x > 0 && !firstCollisionAmong(candidates, l)) {
        l.x--
      }
    }
  }

  l.x = Math.max(l.x, 0)
  return l
}
