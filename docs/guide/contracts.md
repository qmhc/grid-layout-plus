---
title: Operation Contracts
description: Understand Grid Layout Plus operation results, controlled transaction receipts, revisions, rejections, and errors.
---

# Operation Contracts

Grid Layout Plus uses discriminated unions for operations and interactions. Check `status`, `reason`, and structured error fields instead of matching message text.

## LayoutOperationResult

Headless operations and component transaction proposals use this result:

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

Every Layout in the result is an independent readonly snapshot. `accepted` means the headless operation committed. `unchanged` is successful but produced no semantic change. `rejected` leaves the previous Layout committed.

## LayoutTransactionReceipt

Methods on a rendered `GridLayout` return a controlled receipt:

```ts
type LayoutTransactionReceipt =
  | {
      status: 'pending'
      revision: number
      proposal: AcceptedLayoutOperationResult
    }
  | Extract<LayoutOperationResult, { status: 'unchanged' | 'rejected' }>
```

`pending` is not a committed result. It means the component emitted the proposal and is waiting to receive it through `layout` and, in responsive mode, `responsiveLayouts`. Listen to `layout-updated` for the committed notification.

## Rejection reasons

| Reason                     | Meaning                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `item-not-found`           | No item has the requested id.                               |
| `interaction-active`       | Another interaction prevents this operation.                |
| `static-item`              | The target item is static.                                  |
| `disabled`                 | The operation is disabled by the effective configuration.   |
| `collision`                | Collision prevention rejected the candidate.                |
| `out-of-bounds`            | The candidate cannot fit the configured columns.            |
| `max-rows`                 | The candidate exceeds `maxRows`.                            |
| `invalid-input`            | An argument or Layout does not satisfy the public contract. |
| `external-update`          | An external Layout update interrupted an interaction.       |
| `external-not-committed`   | The parent did not write a controlled proposal back.        |
| `superseded`               | A newer proposal replaced the pending one.                  |
| `config-changed`           | A relevant configuration change cancelled the operation.    |
| `cancelled`                | The operation or interaction was cancelled.                 |
| `extension-error`          | A custom extension threw while it was evaluated.            |
| `extension-invalid-result` | A custom extension returned a value outside its contract.   |

Drop evaluation can additionally use `callback-rejected` and `no-position`.

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
}
```

Use `revision` to correlate events from one transaction. In responsive mode, `update:layout` and `update:responsive-layouts` carry the same revision.

## OperationRejectedPayload

```ts
interface OperationRejectedPayload {
  revision: number | null
  evaluationId: number
  operation: LayoutOperationResultBase['operation'] | 'config' | 'drop'
  reason: OperationRejectedReason
  id: LayoutItem['i'] | null
  previousLayout: ReadonlyLayout
  layout: ReadonlyLayout
  candidate: ReadonlyLayoutItem | Readonly<Omit<LayoutItem, 'i' | 'moved'>> | null
  nativeEvent: Event | null
}
```

`operation-rejected` reports rejected component commands, interaction candidates, controlled confirmations, configuration changes, and drop candidates. Receiving this payload does not mean the committed Layout has changed.

## InteractionTerminalPayload

`interaction-end` and `useGridLayout.onInteractionEnd` finish with one of these states:

| Status      | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| `committed` | The final candidate committed with `reason: 'applied'`.      |
| `unchanged` | The interaction ended at the original Layout.                |
| `cancelled` | The interaction was interrupted; inspect the typed `reason`. |

The payload includes `previousLayout`, final `layout`, `oldItem`, final `item`, `revision`, and the last native event when available.

## Errors

Invalid initial Layout or configuration throws synchronously. Stable Core API functions throw one of these classes:

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

After initialization, rendered components and composables report recoverable failures as `GridLayoutRuntimeError` while retaining the last valid state:

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
  path: string | null
  revision: number | null
  evaluationId: number
  cause: unknown
}
```

Use `code`, `source`, `path`, and `revision` for program logic. Treat `cause` and human-readable messages as diagnostic information.
