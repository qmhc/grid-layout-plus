import type {
  GridLayoutExtensionCode,
  GridLayoutExtensionSource,
  GridLayoutValidationCode,
} from '../helpers/types'

/** Indicates that input to the stable Core API, or its configuration, violates the public contract. */
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

/** Indicates that a Core API extension point threw or returned a value outside its contract. */
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
