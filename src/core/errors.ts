import type {
  GridLayoutExtensionCode,
  GridLayoutExtensionSource,
  GridLayoutValidationCode,
} from '../helpers/types'

/** 稳定 core 输入或配置不满足公共契约。 */
export class GridLayoutValidationError extends TypeError {
  readonly name = 'GridLayoutValidationError'
  readonly code: GridLayoutValidationCode
  readonly path: string
  readonly cause: unknown

  constructor(
    message: string,
    options: Readonly<{
      code: GridLayoutValidationCode
      path: string
      cause?: unknown
    }>,
  ) {
    super(message)
    this.code = options.code
    this.path = options.path
    this.cause = options.cause
  }
}

/** 稳定 core 调用扩展点时发生执行错误或返回非法结果。 */
export class GridLayoutExtensionError extends Error {
  readonly name = 'GridLayoutExtensionError'
  readonly code: GridLayoutExtensionCode
  readonly source: GridLayoutExtensionSource
  readonly path: string | null
  readonly cause: unknown

  constructor(
    message: string,
    options: Readonly<{
      code: GridLayoutExtensionCode
      source: GridLayoutExtensionSource
      path?: string | null
      cause?: unknown
    }>,
  ) {
    super(message)
    this.code = options.code
    this.source = options.source
    this.path = options.path ?? null
    this.cause = options.cause
  }
}
