/** @internal 返回鼠标事件在其 offset parent 坐标系中的位置。 */
export function getControlPosition(e: MouseEvent) {
  return offsetXYFromParentOf(e)
}

export function offsetXYFromParentOf(evt: MouseEvent) {
  const offsetParent = (evt.target as HTMLElement)?.offsetParent || document.body
  const offsetParentRect =
    (evt as any).offsetParent === document.body
      ? { left: 0, top: 0 }
      : offsetParent.getBoundingClientRect()

  const x = evt.clientX + offsetParent.scrollLeft - offsetParentRect.left
  const y = evt.clientY + offsetParent.scrollTop - offsetParentRect.top

  /* const x = Math.round(evt.clientX + offsetParent.scrollLeft - offsetParentRect.left);
  const y = Math.round(evt.clientY + offsetParent.scrollTop - offsetParentRect.top); */

  return { x, y }
}

/** @internal 构造旧 DraggableCore 事件所需的坐标增量。 */
export function createCoreData(lastX: number, lastY: number, x: number, y: number) {
  // 首次移动没有可靠的上一帧坐标，因此把当前位置同时作为起点，增量归零。
  const isStart = !isNum(lastX)

  if (isStart) {
    return {
      deltaX: 0,
      deltaY: 0,
      lastX: x,
      lastY: y,
      x,
      y,
    }
  } else {
    return {
      deltaX: x - lastX,
      deltaY: y - lastY,
      lastX,
      lastY,
      x,
      y,
    }
  }
}

function isNum(num: unknown): num is number {
  return typeof num === 'number' && !Number.isNaN(num)
}
