---
title: 操作契约
description: 了解 Grid Layout Plus 的操作结果、受控事务回执、revision、拒绝事件和错误对象。
---

# 操作契约

Grid Layout Plus 使用可判别联合类型描述操作和交互。业务逻辑应判断 `status`、`reason` 和结构化错误字段，不要匹配错误消息文本。

## LayoutOperationResult

无头操作和组件事务提案使用以下结果：

```ts
type LayoutOperationResult =
  | (LayoutOperationResultBase & {
      status: 'accepted'
      reason: 'applied'
    })
  | (LayoutOperationResultBase & {
      status: 'unchanged'
      reason: 'same-value'
    })
  | (LayoutOperationResultBase & {
      status: 'rejected'
      reason: LayoutOperationReason
    })

interface LayoutOperationResultBase {
  operation: 'set' | 'move' | 'resize' | 'add' | 'remove' | 'layer'
  id: LayoutItem['i'] | null
  previousLayout: ReadonlyLayout
  layout: ReadonlyLayout
  candidate: ReadonlyLayoutItem | null
}
```

结果中的 Layout 都是相互独立的只读快照。`accepted` 表示无头操作已经提交；`unchanged` 表示操作有效，但没有产生语义变化；`rejected` 表示操作被拒绝，已提交的 Layout 保持不变。

## LayoutTransactionReceipt

`GridLayout` 组件的公开方法返回受控事务回执：

```ts
type LayoutTransactionReceipt =
  | {
      status: 'pending'
      revision: number
      proposal: AcceptedLayoutOperationResult
    }
  | Extract<LayoutOperationResult, { status: 'unchanged' | 'rejected' }>
```

`pending` 不是已提交结果。它表示组件已经发送提案，正在等待通过 `layout` 属性传回；响应式模式下还需要等待 `responsiveLayouts`。需要确认真正提交时，请监听 `layout-updated`。

## 拒绝原因

| 原因                       | 含义                               |
| -------------------------- | ---------------------------------- |
| `item-not-found`           | 找不到指定 id 的栅格项。           |
| `interaction-active`       | 另一个进行中的交互阻止了本次操作。 |
| `static-item`              | 目标栅格项是静态项。               |
| `disabled`                 | 当前有效配置禁用了该操作。         |
| `collision`                | 碰撞阻止规则拒绝了候选位置。       |
| `out-of-bounds`            | 候选项无法放入配置的列范围。       |
| `max-rows`                 | 候选项超出 `maxRows`。             |
| `invalid-input`            | 参数或 Layout 不符合公开契约。     |
| `external-update`          | 外部 Layout 更新中断了交互。       |
| `external-not-committed`   | 父组件没有写回受控提案。           |
| `superseded`               | 较新的提案取代了当前待确认的提案。 |
| `config-changed`           | 相关配置变化取消了操作。           |
| `cancelled`                | 操作或交互被取消。                 |
| `extension-error`          | 自定义扩展求值时抛出异常。         |
| `extension-invalid-result` | 自定义扩展返回了不符合契约的值。   |

拖放计算还可能使用 `callback-rejected` 和 `no-position`。

## LayoutUpdateMeta

```ts
interface LayoutUpdateMeta {
  revision: number
  source:
    | 'interaction'
    | 'programmatic'
    | 'responsive'
    | 'width'
    | 'config'
    | 'external'
    | 'drop-commit'
    | 'transfer'
    | 'auto-height'
}
```

可以用 `revision` 关联同一事务产生的事件。响应式模式下，`update:layout` 和 `update:responsive-layouts` 使用相同的 revision。

## OperationRejectedPayload

```ts
interface OperationRejectedPayload {
  revision: number | null
  evaluationId: number
  operation: LayoutOperationResultBase['operation'] | 'config' | 'drop' | 'transfer'
  reason: OperationRejectedReason
  id: LayoutItem['i'] | null
  previousLayout: ReadonlyLayout
  layout: ReadonlyLayout
  candidate: ReadonlyLayoutItem | Readonly<Omit<LayoutItem, 'i' | 'moved'>> | null
  nativeEvent: Event | null
}
```

`operation-rejected` 会报告被拒绝的组件命令、交互候选位置、受控确认、配置更新、拖放候选项，以及跨网格转移任一端的拒绝。收到该事件并不表示已提交 Layout 发生了变化。

跨网格移动由协调器管理，但仍是两个独立的受控事务。只有两个 revision 都提交后才发送 `transfer`。若一端拒绝，已确认的一端会收到 `source: 'transfer'` 的补偿提案；应用仍需正常写回该提案才能完成回滚。

## InteractionTerminalPayload

`interaction-end` 和 `useGridLayout.onInteractionEnd` 使用以下状态结束：

| 状态        | 含义                                        |
| ----------- | ------------------------------------------- |
| `committed` | 最终候选项已经提交，`reason` 为 `applied`。 |
| `unchanged` | 交互结束时仍是原始 Layout。                 |
| `cancelled` | 交互被中断，具体原因见带类型的 `reason`。   |

事件数据还包含 `previousLayout`、最终 `layout`、`oldItem`、最终 `item`、`revision`，以及可用时的最后一个原生事件。

## 错误

初始 Layout 或配置无效时会同步抛出异常。稳定的 Core API 函数会抛出以下错误类之一：

```ts
class GridLayoutValidationError extends TypeError {
  code: 'invalid-layout' | 'invalid-config'
  path: string
  cause: unknown
}

class GridLayoutExtensionError extends Error {
  code: 'extension-error' | 'extension-invalid-result'
  source: 'compactor' | 'position-strategy' | 'drop-config'
  path: string | null
  cause: unknown
}
```

初始化完成后，渲染组件和组合式函数会把可恢复失败报告为 `GridLayoutRuntimeError`，并保留最后一次有效状态：

```ts
interface GridLayoutRuntimeError {
  code:
    | 'invalid-layout'
    | 'invalid-config'
    | 'partial-responsive-update'
    | 'invalid-registration'
    | 'extension-error'
    | 'extension-invalid-result'
    | 'derived-geometry-overflow'
  source:
    | 'layout'
    | 'config'
    | 'container-width'
    | 'geometry'
    | 'compactor'
    | 'position-strategy'
    | 'drop-config'
    | 'grid-item'
    | 'auto-height'
  path: string | null
  revision: number | null
  evaluationId: number
  cause: unknown
}
```

程序逻辑应使用 `code`、`source`、`path` 和 `revision`。`cause` 和可读错误消息只用于诊断。
