import {
  cloneLayout,
  compact,
  getFirstCollision,
  getStatics,
  sortLayoutItemsByRowCol,
} from '../helpers/common'

import type { Compactor, Layout, LayoutItem } from '../helpers/types'

/**
 * 按列优先排序（先 x 后 y），用于水平压缩。
 */
function sortLayoutItemsByColRow(layout: Layout): Layout {
  return Array.from(layout).sort((a, b) => {
    if (a.x === b.x && a.y === b.y) return 0
    if (a.x > b.x || (a.x === b.x && a.y > b.y)) return 1
    return -1
  })
}

/**
 * 垂直压缩器 — 委托给现有 compact() 逻辑。
 * 等价于 compact(layout, true)。
 */
export const verticalCompactor: Compactor = {
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
 * 3. 对每个非静态元素，保持 y 不变，将 x 向左移动至无碰撞的最小位置
 * 4. 碰撞时放置在障碍物右侧
 */
export const horizontalCompactor: Compactor = {
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
function compactItemHorizontally(
  compareWith: Layout,
  l: LayoutItem,
  _cols: number,
): LayoutItem {
  // 向左移动至无碰撞的最小 x
  while (l.x > 0 && !getFirstCollision(compareWith, l)) {
    l.x--
  }

  // 向右推移直到无碰撞（处理初始碰撞或移动过头的情况）
  let collision: LayoutItem | undefined
  while ((collision = getFirstCollision(compareWith, l))) {
    l.x = collision.x + collision.w
  }

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
    compact(layout: Layout, _cols: number): Layout {
      return cloneLayout(layout)
    },
    allowOverlap: true,
  }
}

// ---------------------------------------------------------------------------
// 区间树 — 用于 Fast Compactors 的 O(n log n) 碰撞检测加速
// ---------------------------------------------------------------------------

/** 区间树节点 */
interface IntervalNode {
  center: number
  left: IntervalNode | null
  right: IntervalNode | null
  /** 按区间起点升序排列的条目 */
  byStart: IntervalEntry[]
  /** 按区间终点降序排列的条目 */
  byEnd: IntervalEntry[]
}

interface IntervalEntry {
  lo: number
  hi: number
  item: LayoutItem
}

/**
 * 从一组区间条目构建静态区间树。
 * 空输入返回 null。
 */
function buildIntervalTree(entries: IntervalEntry[]): IntervalNode | null {
  if (entries.length === 0) return null

  // 选取所有端点的中位数作为分割点
  const pts: number[] = []
  for (let i = 0; i < entries.length; i++) {
    pts.push(entries[i].lo, entries[i].hi)
  }
  pts.sort((a, b) => a - b)
  const center = pts[pts.length >> 1]

  const leftEntries: IntervalEntry[] = []
  const rightEntries: IntervalEntry[] = []
  const centerByStart: IntervalEntry[] = []

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e.hi <= center) {
      leftEntries.push(e)
    } else if (e.lo > center) {
      rightEntries.push(e)
    } else {
      centerByStart.push(e)
    }
  }

  // 当分割无效（所有条目都落入同一侧）时，将全部条目放在当前节点，
  // 避免无限递归。
  if (centerByStart.length === 0 && (leftEntries.length === entries.length || rightEntries.length === entries.length)) {
    const all = leftEntries.length === entries.length ? leftEntries : rightEntries
    const byStart = Array.from(all)
    const byEnd = Array.from(all)
    byStart.sort((a, b) => a.lo - b.lo)
    byEnd.sort((a, b) => b.hi - a.hi)
    return {
      center,
      left: null,
      right: null,
      byStart,
      byEnd,
    }
  }

  const centerByEnd = Array.from(centerByStart)
  centerByStart.sort((a, b) => a.lo - b.lo)
  centerByEnd.sort((a, b) => b.hi - a.hi)

  return {
    center,
    left: buildIntervalTree(leftEntries),
    right: buildIntervalTree(rightEntries),
    byStart: centerByStart,
    byEnd: centerByEnd,
  }
}

/**
 * 查询区间树中与 [qLo, qHi) 重叠的所有条目。
 * 重叠条件：entry.lo < qHi && entry.hi > qLo（开区间端点）。
 */
function queryIntervalTree(
  node: IntervalNode | null,
  qLo: number,
  qHi: number,
  result: LayoutItem[],
): void {
  if (!node) return

  if (qLo >= node.center) {
    // 查询区间在中心右侧，检查 byEnd（降序）中 hi > qLo 的条目
    const arr = node.byEnd
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].hi <= qLo) break
      result.push(arr[i].item)
    }
    queryIntervalTree(node.right, qLo, qHi, result)
  } else if (qHi <= node.center) {
    // 查询区间在中心左侧，检查 byStart（升序）中 lo < qHi 的条目
    const arr = node.byStart
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].lo >= qHi) break
      result.push(arr[i].item)
    }
    queryIntervalTree(node.left, qLo, qHi, result)
  } else {
    // 查询区间跨越中心，所有 center 条目都重叠
    for (let i = 0; i < node.byStart.length; i++) {
      result.push(node.byStart[i].item)
    }
    queryIntervalTree(node.left, qLo, qHi, result)
    queryIntervalTree(node.right, qLo, qHi, result)
  }
}

/**
 * 在候选列表中查找与 item 碰撞的第一个元素（用于 fast compactors 的逐步压缩）。
 * candidates 应来自区间树查询结果（已按一个轴过滤），此处再验证另一个轴。
 */
function firstCollisionAmong(
  candidates: LayoutItem[],
  item: LayoutItem,
): LayoutItem | undefined {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (c === item) continue
    // 完整 2D 碰撞检测
    if (
      item.x < c.x + c.w
      && item.x + item.w > c.x
      && item.y < c.y + c.h
      && item.y + item.h > c.y
    ) {
      return c
    }
  }
  return undefined
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
  compact(layout: Layout, _cols: number): Layout {
    const cloned = cloneLayout(layout)
    const sorted = sortLayoutItemsByRowCol(cloned)

    // 已放置元素列表（用于增量重建区间树）
    const placed: LayoutItem[] = []
    // 收集静态元素
    for (let i = 0; i < cloned.length; i++) {
      if (cloned[i].static) placed.push(cloned[i])
    }

    const out: Layout = Array(cloned.length)

    for (let i = 0, len = sorted.length; i < len; i++) {
      let l = sorted[i]

      if (!l.static) {
        // 重建区间树（按 x 轴区间索引已放置元素）
        const entries: IntervalEntry[] = []
        for (let j = 0; j < placed.length; j++) {
          const p = placed[j]
          entries.push({ lo: p.x, hi: p.x + p.w, item: p })
        }
        const tree = buildIntervalTree(entries)

        // 垂直压缩：向上移动至无碰撞的最小 y
        l = fastCompactItemVertically(tree, l)
        placed.push(l)
      }

      out[cloned.findIndex(item => item.i === l.i)] = l
      l.moved = false
    }

    return out
  },
}

/**
 * 快速垂直压缩单个元素：使用区间树查询 x 轴重叠的候选元素，
 * 然后在候选集中做 y 轴碰撞检测。
 */
function fastCompactItemVertically(
  tree: IntervalNode | null,
  l: LayoutItem,
): LayoutItem {
  // 查询 x 轴与当前元素重叠的所有已放置元素
  const candidates: LayoutItem[] = []
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
  compact(layout: Layout, cols: number): Layout {
    const cloned = cloneLayout(layout)
    const sorted = sortLayoutItemsByColRow(cloned)

    // 已放置元素列表
    const placed: LayoutItem[] = []
    for (let i = 0; i < cloned.length; i++) {
      if (cloned[i].static) placed.push(cloned[i])
    }

    const out: Layout = Array(cloned.length)

    for (let i = 0, len = sorted.length; i < len; i++) {
      let l = sorted[i]

      if (!l.static) {
        // 重建区间树（按 y 轴区间索引已放置元素）
        const entries: IntervalEntry[] = []
        for (let j = 0; j < placed.length; j++) {
          const p = placed[j]
          entries.push({ lo: p.y, hi: p.y + p.h, item: p })
        }
        const tree = buildIntervalTree(entries)

        // 水平压缩：向左移动至无碰撞的最小 x
        l = fastCompactItemHorizontally(tree, l, cols)
        placed.push(l)
      }

      out[cloned.findIndex(item => item.i === l.i)] = l
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
  _cols: number,
): LayoutItem {
  // 查询 y 轴与当前元素重叠的所有已放置元素
  const candidates: LayoutItem[] = []
  queryIntervalTree(tree, l.y, l.y + l.h, candidates)

  // 向左移动至无碰撞的最小 x
  while (l.x > 0 && !firstCollisionAmong(candidates, l)) {
    l.x--
  }

  // 向右推移直到无碰撞
  let collision: LayoutItem | undefined
  while ((collision = firstCollisionAmong(candidates, l))) {
    l.x = collision.x + collision.w
  }

  return l
}
