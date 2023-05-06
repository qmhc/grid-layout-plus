import type { InjectionKey } from 'vue'
import type { EventEmitter } from '@vexip-ui/utils'
import type { LayoutItem, Layout, LayoutInstance } from './types'

export const LAYOUT_KEY = Symbol('LAYOUT_KEY') as InjectionKey<LayoutInstance>
export const EMITTER_KEY = Symbol('EMITTER_KEY') as InjectionKey<EventEmitter>

/**
 * Return the bottom coordinate of the layout.
 *
 * @param layout Layout array.
 * @return Bottom coordinate.
 */
export function bottom(layout: Layout): number {
  let max = 0
  let bottomY
  for (let i = 0, len = layout.length; i < len; i++) {
    bottomY = layout[i].y + layout[i].h
    if (bottomY > max) max = bottomY
  }
  return max
}

export function cloneLayout(layout: Layout): Layout {
  const newLayout = Array(layout.length)
  for (let i = 0, len = layout.length; i < len; i++) {
    newLayout[i] = cloneLayoutItem(layout[i])
  }
  return newLayout
}

// Fast path to cloning, since this is monomorphic
export function cloneLayoutItem(layoutItem: LayoutItem): LayoutItem {
  // return JSON.parse(JSON.stringify(layoutItem))
  return { ...layoutItem }
}

/**
 * Given two layoutitems, check if they collide.
 *
 * @return True if colliding.
 */
export function collides(l1: LayoutItem, l2: LayoutItem): boolean {
  if (l1 === l2) return false // same element
  if (l1.x + l1.w <= l2.x) return false // l1 is left of l2
  if (l1.x >= l2.x + l2.w) return false // l1 is right of l2
  if (l1.y + l1.h <= l2.y) return false // l1 is above l2
  if (l1.y >= l2.y + l2.h) return false // l1 is below l2
  return true // boxes overlap
}

/**
 * Given a layout, compact it. This involves going down each y coordinate and removing gaps
 * between items.
 *
 * @param  layout Layout.
 * @param  verticalCompact Whether or not to compact the layout vertically.
 * @param minPositions
 * @return Compacted Layout.
 */
export function compact(layout: Layout, verticalCompact?: boolean, minPositions?: any): Layout {
  // Statics go in the compareWith array right away so items flow around them.
  const compareWith = getStatics(layout)
  // We go through the items by row and column.
  const sorted = sortLayoutItemsByRowCol(layout)
  // Holding for new items.
  const out: Layout = Array(layout.length)

  for (let i = 0, len = sorted.length; i < len; i++) {
    let l = sorted[i]

    // Don't move static elements
    if (!l.static) {
      l = compactItem(compareWith, l, verticalCompact, minPositions)

      // Add to comparison array. We only collide with items before this one.
      // Statics are already in this array.
      compareWith.push(l)
    }

    // Add to output array to make sure they still come out in the right order.
    out[layout.indexOf(l)] = l

    // Clear moved flag, if it exists.
    l.moved = false
  }

  return out
}

/**
 * Compact an item in the layout.
 */
export function compactItem(
  compareWith: Layout,
  l: LayoutItem,
  verticalCompact?: boolean,
  minPositions?: any
): LayoutItem {
  if (verticalCompact) {
    // Move the element up as far as it can go without colliding.
    while (l.y > 0 && !getFirstCollision(compareWith, l)) {
      l.y--
    }
  } else if (minPositions) {
    const minY = minPositions[l.i].y
    while (l.y > minY && !getFirstCollision(compareWith, l)) {
      l.y--
    }
  }

  // Move it down, and keep moving it down if it's colliding.
  let collides
  while ((collides = getFirstCollision(compareWith, l))) {
    l.y = collides.y + collides.h
  }
  return l
}

/**
 * Given a layout, make sure all elements fit within its bounds.
 *
 * @param  layout Layout array.
 * @param  bounds Number of columns.
 */
export function correctBounds(layout: Layout, bounds: { cols: number }): Layout {
  const collidesWith = getStatics(layout)
  for (let i = 0, len = layout.length; i < len; i++) {
    const l = layout[i]
    // Overflows right
    if (l.x + l.w > bounds.cols) l.x = bounds.cols - l.w
    // Overflows left
    if (l.x < 0) {
      l.x = 0
      l.w = bounds.cols
    }
    if (!l.static) collidesWith.push(l)
    else {
      // If this is static and collides with other statics, we must move it down.
      // We have to do something nicer than just letting them overlap.
      while (getFirstCollision(collidesWith, l)) {
        l.y++
      }
    }
  }
  return layout
}

/**
 * Get a layout item by ID. Used so we can override later on if necessary.
 *
 * @param    layout Layout array.
 * @param   id     ID
 * @return     Item at ID.
 */
export function getLayoutItem(layout: Layout, id: number | string): LayoutItem | undefined {
  for (let i = 0, len = layout.length; i < len; i++) {
    if (layout[i].i === id) return layout[i]
  }
}

/**
 * Returns the first item this layout collides with.
 * It doesn't appear to matter which order we approach this from, although
 * perhaps that is the wrong thing to do.
 *
 * @param  {Object} layoutItem Layout item.
 * @return {Object|undefined}  A colliding layout item, or undefined.
 */
export function getFirstCollision(layout: Layout, layoutItem: LayoutItem): LayoutItem | undefined {
  for (let i = 0, len = layout.length; i < len; i++) {
    if (collides(layout[i], layoutItem)) return layout[i]
  }
}

export function getAllCollisions(layout: Layout, layoutItem: LayoutItem): Array<LayoutItem> {
  return layout.filter(l => collides(l, layoutItem))
}

/**
 * Get all static elements.
 * @param layout Array of layout objects.
 * @return  Array of static layout items..
 */
export function getStatics(layout: Layout): Array<LayoutItem> {
  return layout.filter(l => l.static)
}

/**
 * Move an element. Responsible for doing cascading movements of other elements.
 *
 * @param     layout            Full layout to modify.
 * @param     layoutItem        element to move.
 * @param     x                 X position in grid units.
 * @param     y                 Y position in grid units.
 * @param     isUserAction      If true, designates that the item we're moving is
 *                                     being dragged/resized by th euser.
 * @param     preventCollision  If true, collisions will be ignored.
 * @param     isSwappable        If true, the item will be swapped with the colliding item.
 */
export function moveElement(
  layout: Layout,
  layoutItem: LayoutItem,
  x?: number,
  y?: number,
  isUserAction = false,
  preventCollision = false,
  isSwappable = false
): Layout {
  if (layoutItem.static) return layout

  const origLayoutItem = {
    ...layoutItem
  }
  const oldX = layoutItem.x
  const oldY = layoutItem.y

  const movingUp = y && layoutItem.y > y
  // This is quite a bit faster than extending the object
  if (typeof x === 'number') layoutItem.x = x
  if (typeof y === 'number') layoutItem.y = y
  layoutItem.moved = true

  // If this collides with anything, move it.
  // When doing this comparison, we have to sort the items we compare with
  // to ensure, in the case of multiple collisions, that we're getting the
  // nearest collision.
  let sorted = sortLayoutItemsByRowCol(layout)
  if (movingUp) sorted = sorted.reverse()
  const collisions = getAllCollisions(sorted, layoutItem)

  if (preventCollision && collisions.length) {
    layoutItem.x = oldX
    layoutItem.y = oldY
    layoutItem.moved = false
    return layout
  }

  // Move each item that collides away from this element.
  for (let i = 0, len = collisions.length; i < len; i++) {
    const collision = collisions[i]

    // Short circuit so we can't infinite loop
    if (collision.moved) continue

    // This makes it feel a bit more precise by waiting to swap for just a bit when moving up.
    if (layoutItem.y > collision.y && layoutItem.y - collision.y > collision.h / 4) continue

    // Don't move static items - we have to move *this* element away
    if (collision.static) {
      layout = moveElementAwayFromCollision(layout, collision, layoutItem, origLayoutItem, isUserAction, isSwappable)
    } else {
      layout = moveElementAwayFromCollision(layout, layoutItem, collision, origLayoutItem, isUserAction, isSwappable)
    }
  }

  return layout
}

/**
 * This is where the magic needs to happen - given a collision, move an element away from the collision.
 * We attempt to move it up if there's room, otherwise it goes below.
 *
 * @param   layout       Full layout to modify.
 * @param   collidesWith Layout item we're colliding with.
 * @param   itemToMove   Layout item we're moving.
 * @param  isUserAction  If true, designates that the item we're moving is being dragged/resized
 *                                   by the user.
 * @param  isSwappable   If true, the item will be swapped with the colliding item.
 */
export function moveElementAwayFromCollision(
  layout: Layout,
  collidesWith: LayoutItem,
  itemToMove: LayoutItem,
  collidesWithStart: LayoutItem,
  isUserAction = false,
  isSwappable = false
): Layout {
  const nextMoveIsUserAction = false // The next move is never a user action, since we're moving it
  const preventCollision = false // we're already colliding
  // If there is enough space above the collision to put this element, move it there.
  // We only do this on the main collision as this can get funky in cascades and cause
  // unwanted swapping behavior.
  if (isUserAction) {
    // Make a mock item so we don't modify the item here, only modify in moveElement.
    const fakeItem: LayoutItem = {
      x: itemToMove.x,
      y: itemToMove.y,
      w: itemToMove.w,
      h: itemToMove.h,
      i: '-1'
    }
    fakeItem.y = Math.max(collidesWith.y - itemToMove.h, 0)
    if (!getFirstCollision(layout, fakeItem)) {
      return moveElement(layout, itemToMove, undefined, fakeItem.y, nextMoveIsUserAction, preventCollision, isSwappable)
    }
  }

  // if it's the same row, swap with the item we're colliding with
  if (isSwappable && collidesWithStart.y === itemToMove.y) {
    const direction = collidesWith.x < collidesWithStart.x ? 1 : -1

    // If we're not leaving enough space for the other item to move, forcibly shift the item
    if (collidesWith.w === itemToMove.w && collidesWith.x !== itemToMove.x) {
      return moveElement(layout, collidesWith, itemToMove.x, undefined, nextMoveIsUserAction, preventCollision, isSwappable)
    }

    // We have enough space to move, move to the next slot
    const newX = itemToMove.x + (direction * collidesWith.w)
    if (newX >= 0) {
      return moveElement(layout, itemToMove, newX, undefined, nextMoveIsUserAction, preventCollision, isSwappable)
    }
  }

  // Previously this was optimized to move below the collision directly, but this can cause problems
  // with cascading moves, as an item may actually leapflog a collision and cause a reversal in order.
  return moveElement(layout, itemToMove, undefined, itemToMove.y + 1, nextMoveIsUserAction, preventCollision, isSwappable)
}

/**
 * Helper to convert a number to a percentage string.
 *
 * @param   num Any number
 * @return      That number as a percentage.
 */
export function perc(num: number): string {
  return num * 100 + '%'
}

export function setTransform(top: number, left: number, width: number, height: number) {
  // Replace unitless items with px
  const translate = 'translate3d(' + left + 'px,' + top + 'px, 0)'
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: width + 'px',
    height: height + 'px',
    position: 'absolute'
  }
}
/**
 * Just like the setTransform method, but instead it will return a negative value of right.
 *
 * @param top
 * @param right
 * @param width
 * @param height
 * @returns {{transform: string, WebkitTransform: string, MozTransform: string, msTransform: string, OTransform: string, width: string, height: string, position: string}}
 */
export function setTransformRtl(top: number, right: number, width: number, height: number) {
  // Replace unitless items with px
  const translate = 'translate3d(' + right * -1 + 'px,' + top + 'px, 0)'
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: width + 'px',
    height: height + 'px',
    position: 'absolute'
  }
}

export function setTopLeft(top: number, left: number, width: number, height: number) {
  return {
    top: top + 'px',
    left: left + 'px',
    width: width + 'px',
    height: height + 'px',
    position: 'absolute'
  }
}
/**
 * Just like the setTopLeft method, but instead, it will return a right property instead of left.
 *
 * @param top
 * @param right
 * @param width
 * @param height
 * @returns position style
 */
export function setTopRight(top: number, right: number, width: number, height: number) {
  return {
    top: top + 'px',
    right: right + 'px',
    width: width + 'px',
    height: height + 'px',
    position: 'absolute'
  }
}

/**
 * Get layout items sorted from top left to right and down.
 *
 * @return Layout, sorted static items first.
 */
export function sortLayoutItemsByRowCol(layout: Layout): Layout {
  return Array.from(layout).sort(function (a, b) {
    if (a.y === b.y && a.x === b.x) {
      return 0
    }

    if (a.y > b.y || (a.y === b.y && a.x > b.x)) {
      return 1
    }

    return -1
  })
}

/**
 * Validate a layout. Throws errors.
 *
 * @param layout Array of layout items.
 * @param contextName Context name for errors.
 * @throw Validation error.
 */
export function validateLayout(layout: Layout, contextName?: string): void {
  contextName = contextName || 'Layout'
  const subProps = ['x', 'y', 'w', 'h']
  const keyArr = []
  if (!Array.isArray(layout)) throw new Error(contextName + ' must be an array!')
  for (let i = 0, len = layout.length; i < len; i++) {
    const item = layout[i]
    for (let j = 0; j < subProps.length; j++) {
      if (typeof (item as any)[subProps[j]] !== 'number') {
        throw new Error(
          'VueGridLayout: ' + contextName + '[' + i + '].' + subProps[j] + ' must be a number!'
        )
      }
    }

    if (item.i === undefined || item.i === null) {
      throw new Error('VueGridLayout: ' + contextName + '[' + i + '].i cannot be null!')
    }

    if (typeof item.i !== 'number' && typeof item.i !== 'string') {
      throw new Error('VueGridLayout: ' + contextName + '[' + i + '].i must be a string or number!')
    }

    if (keyArr.indexOf(item.i) >= 0) {
      throw new Error('VueGridLayout: ' + contextName + '[' + i + '].i must be unique!')
    }
    keyArr.push(item.i)

    if (item.static !== undefined && typeof item.static !== 'boolean') {
      throw new Error('VueGridLayout: ' + contextName + '[' + i + '].static must be a boolean!')
    }
  }
}

// Flow can't really figure this out, so we just use Object
export function autoBindHandlers(
  el: Record<string, (...args: any[]) => any>,
  fns: Array<string>
): void {
  fns.forEach(key => (el[key] = el[key].bind(el)))
}

/**
 * Convert a JS object to CSS string. Similar to React's output of CSS.
 * @param obj
 * @returns
 */
export function createMarkup(obj: Record<string, any>) {
  const keys = Object.keys(obj)
  if (!keys.length) return ''
  let i
  const len = keys.length
  let result = ''

  for (i = 0; i < len; i++) {
    const key = keys[i]
    const val = obj[key]
    result += hyphenate(key) + ':' + addPx(key, val) + ';'
  }

  return result
}

/* The following list is defined in React's core */
export const IS_UNITLESS: Record<string, boolean> = {
  animationIterationCount: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridRow: true,
  gridColumn: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true
}

/**
 * Will add px to the end of style values which are Numbers.
 * @param name
 * @param value
 * @returns {*}
 */
export function addPx(name: string, value: number | string) {
  if (typeof value === 'number' && !IS_UNITLESS[name]) {
    return value + 'px'
  } else {
    return value
  }
}

export const hyphenateRE = /([a-z\d])([A-Z])/g

/**
 * Hyphenate a camelCase string.
 *
 * @param  str
 * @return
 */
export function hyphenate(str: string) {
  return str.replace(hyphenateRE, '$1-$2').toLowerCase()
}

export function findItemInArray(array: any[], property: string, value: any) {
  for (let i = 0; i < array.length; i++) {
    if (array[i][property] === value) {
      return true
    }
  }

  return false
}

export function findAndRemove(array: any[], property: string, value: any) {
  array.forEach(function (result, index) {
    if (result[property] === value) {
      // Remove from array
      array.splice(index, 1)
    }
  })
}

export function useNameHelper(block: string, namespace = 'vgl') {
  /**
   * @returns `${namespace}-${block}`
   */
  const b = () => `${namespace}-${block}`
  /**
   * @returns `${namespace}-${block}__${element}`
   */
  const be = (element: string) => `${b()}__${element}`
  /**
   * @returns `${namespace}-${block}--${modifier}`
   */
  const bm = (modifier: string | number) => `${b()}--${modifier}`
  /**
   * @returns `${namespace}-${block}__${element}--${modifier}`
   */
  const bem = (element: string, modifier: string | number) => `${b()}__${element}--${modifier}`

  return {
    b,
    be,
    bm,
    bem
  }
}
