/**
 * 比较两个内联样式映射是否相同：键集合相同且逐键字符串值相等（未设置的值为 `undefined`）。
 * 用于在内容未变时保留原样式对象，避免响应式触发无意义的重新渲染。
 */
export function sameStyle(
  a: Readonly<Record<string, string | undefined>>,
  b: Readonly<Record<string, string | undefined>>,
): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  for (const key of keys) {
    if (!Object.hasOwn(b, key) || a[key] !== b[key]) return false
  }
  return true
}
