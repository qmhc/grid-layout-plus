import type { ReadonlyLayout } from '../helpers/types'

/**
 * 判断布局中是否存在任意两项重叠。按上边缘扫描，只保留在当前行仍然“打开”的项，
 * 因此堆叠（移动端）布局中每项只需与少数几项比较，而非全部。仅边缘相接不算重叠，
 * id 相同的项也不计为重叠，与逐对的 `collides` 检查一致。
 *
 * 只回答“是否存在”：需要报告具体冲突项的调用方在本函数返回 `true` 后再执行逐对循环，
 * 因此报告的索引与路径保持不变。
 */
export function hasAnyCollision(layout: ReadonlyLayout): boolean {
  const order = Array.from(layout.keys()).sort((a, b) => layout[a].y - layout[b].y)
  const active: number[] = []
  for (const index of order) {
    const item = layout[index]
    let kept = 0
    for (const other of active) {
      const candidate = layout[other]
      if (candidate.y + candidate.h <= item.y) continue
      active[kept++] = other
      if (
        !Object.is(candidate.i, item.i) &&
        candidate.x < item.x + item.w &&
        candidate.x + candidate.w > item.x &&
        candidate.y < item.y + item.h
      ) {
        return true
      }
    }
    active.length = kept
    active.push(index)
  }
  return false
}
