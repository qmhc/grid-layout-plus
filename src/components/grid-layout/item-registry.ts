/**
 * GridLayout 与其直属 GridItem 实例之间的注册表。
 *
 * 职责：维护 id 到实例的映射，并校验重复 id、布局缺项和 DOM containing block 归属关系。
 * 边界：不计算布局几何，也不修改 GridItem 状态；异常只通过注册生命周期和 error 端口上报。
 * 关键约束：外部更新移除活跃元素时，必须先结束对应交互，再从注册表中移除实例。
 */
import type { GridLayoutRuntimeError } from '../../composables/useGridLayout'
import type { GridItemRegistration } from '../../helpers/internal-types'
import type { LayoutItem } from '../../helpers/types'

interface GridItemRegistryOptions {
  itemInstances: Map<LayoutItem['i'], GridItemRegistration>
  registeredItems: Set<GridItemRegistration>
  registrationEpisodes: WeakMap<object, string | null>
  isUnavailable(): boolean
  getRoot(): HTMLElement | null
  hasLayoutItem(id: LayoutItem['i']): boolean
  getActiveInteractionId(): LayoutItem['i'] | null
  prepareActiveForTerminal(): void
  finishActiveForExternalUpdate(): void
  scheduleValidation(callback: () => void): void
  nextEvaluationId(): number
  emitError(error: GridLayoutRuntimeError): void
}

export interface GridItemRegistry {
  increase(item: GridItemRegistration): void
  decrease(item: GridItemRegistration): void
  update(item: GridItemRegistration, previousId: LayoutItem['i']): void
  get(id: LayoutItem['i']): GridItemRegistration | undefined
  validate(): void
}

/** 管理 GridItem 的所属关系与 DOM containing block 校验。 */
export function createGridItemRegistry(options: GridItemRegistryOptions): GridItemRegistry {
  const { itemInstances, registeredItems, registrationEpisodes } = options

  function emitRegistrationError(item: GridItemRegistration, reason: string): void {
    // 同一注册异常只上报一次；恢复正常后 registrationEpisodes 会被重置。
    if (registrationEpisodes.get(item) === reason) return
    registrationEpisodes.set(item, reason)
    const id = item.i
    options.emitError({
      code: 'invalid-registration',
      source: 'grid-item',
      path: `gridItem[${JSON.stringify(String(id))}]`,
      revision: null,
      evaluationId: options.nextEvaluationId(),
      cause: { reason, id },
    })
  }

  function cancelActiveInteraction(): void {
    options.prepareActiveForTerminal()
    options.finishActiveForExternalUpdate()
  }

  function validate(): void {
    if (options.isUnavailable()) return
    const root = options.getRoot()
    if (!root) return
    // 每轮从 registeredItems 重建 id 映射，避免 id 变化或重复项留下过期 owner。
    const previousOwners = new Map(itemInstances)
    itemInstances.clear()
    for (const item of registeredItems) {
      const id = item.i
      const node = item.wrapper
      const wasRegistered = item.state.registered
      let reason: string | null = null

      if (!options.hasLayoutItem(id)) {
        reason = 'missing-id'
      } else if (
        !item.internal &&
        (!node || node.ownerDocument !== root.ownerDocument || !root.contains(node))
      ) {
        reason = 'outside-root'
      } else if (!item.internal && node?.offsetParent !== root) {
        reason = 'invalid-containing-block'
      } else if (itemInstances.has(id)) {
        reason = 'duplicate'
      }

      item.state.registered = reason === null
      if (reason === null) {
        itemInstances.set(id, item)
        registrationEpisodes.set(item, null)
        continue
      }

      item.disableInteractionBinding()
      item.resetInteractionState()
      if (wasRegistered) item.refreshPositionStyle()
      const invalidatesActive =
        previousOwners.get(id) === item && options.getActiveInteractionId() === id
      if (invalidatesActive) options.prepareActiveForTerminal()
      emitRegistrationError(item, reason)
      if (invalidatesActive) options.finishActiveForExternalUpdate()
    }
  }

  function increase(item: GridItemRegistration): void {
    if (options.isUnavailable()) {
      item.state.registered = false
      return
    }
    registeredItems.add(item)
    options.scheduleValidation(validate)
  }

  function decrease(item: GridItemRegistration): void {
    for (const [id, owner] of itemInstances) {
      if (owner === item && options.getActiveInteractionId() === id) {
        cancelActiveInteraction()
        break
      }
    }
    registeredItems.delete(item)
    if (itemInstances.get(item.i) === item) itemInstances.delete(item.i)
    registrationEpisodes.delete(item)
    if (!options.isUnavailable()) options.scheduleValidation(validate)
  }

  function update(item: GridItemRegistration, previousId: LayoutItem['i']): void {
    if (options.isUnavailable()) {
      item.state.registered = false
      return
    }
    if (!Object.is(previousId, item.i) && options.getActiveInteractionId() === previousId) {
      cancelActiveInteraction()
    }
    if (Object.is(previousId, item.i)) {
      validate()
      return
    }
    options.scheduleValidation(validate)
  }

  return {
    increase,
    decrease,
    update,
    get: id => itemInstances.get(id),
    validate,
  }
}
