import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'

import { GridLayout, GridLayoutValidationError } from '../src'

import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import type { Layout } from '../src'

interface TransferGridInstance {
  state: {
    isDragging: boolean
    transferPlaceholder: { x: number; y: number; w: number; h: number } | null
  }
  dragEvent(
    eventName: string,
    id: number | string,
    x: number,
    y: number,
    h: number,
    w: number,
    nativeEvent?: Event,
  ): void
}

async function settle(ticks = 5): Promise<void> {
  for (let index = 0; index < ticks; index += 1) await nextTick()
}

function pointer(type: string, clientX: number, clientY: number): MouseEvent {
  return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true })
}

function mockRect(root: DOMWrapper<Element>, left: number): void {
  Object.defineProperty(root.element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left,
      right: left + 400,
      top: 0,
      bottom: 300,
      width: 400,
      height: 300,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  })
}

async function mountGrid(
  layout: Layout,
  group: string,
  confirm: boolean | ((next: Layout) => Layout),
): Promise<VueWrapper> {
  const wrapper = mount(GridLayout, {
    props: {
      layout,
      width: 400,
      colNum: 4,
      rowHeight: 100,
      gap: [0, 0],
      transferConfig: { group },
      ...(confirm
        ? {
            'onUpdate:layout': (next: Layout) => {
              const confirmed =
                typeof confirm === 'function' ? confirm(next) : next.map(item => ({ ...item }))
              void wrapper.setProps({ layout: confirmed })
            },
          }
        : {}),
    },
    slots: {
      item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
    },
    attachTo: document.body,
  })
  await settle()
  return wrapper
}

async function mountResponsiveGrid(layout: Layout): Promise<VueWrapper> {
  const wrapper = mount(GridLayout, {
    props: {
      layout,
      width: 400,
      responsive: true,
      breakpoints: { mobile: 0 },
      cols: { mobile: 4 },
      responsiveLayouts: { mobile: layout },
      rowHeight: 100,
      gap: [0, 0],
      transferConfig: { group: 'responsive' },
      'onUpdate:layout': (next: Layout) => {
        void wrapper.setProps({ layout: next.map(item => ({ ...item })) })
      },
      'onUpdate:responsiveLayouts': (next: Record<string, Layout>) => {
        void wrapper.setProps({
          responsiveLayouts: Object.fromEntries(
            Object.entries(next).map(([key, value]) => [
              key,
              value.map(item => ({ ...item })),
            ]),
          ),
        })
      },
    },
    slots: {
      item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
    },
    attachTo: document.body,
  })
  await settle(8)
  return wrapper
}

describe('跨网格拖拽', () => {
  it('拒绝空 transfer group', () => {
    expect(() =>
      mount(GridLayout, {
        props: {
          layout: [],
          width: 400,
          transferConfig: { group: '' },
        },
      }),
    ).toThrowError(GridLayoutValidationError)
  })

  it('同组网格先预览，双端受控确认后移动完整业务 item', async () => {
    const source = await mountGrid(
      [{ i: 'card', x: 0, y: 0, w: 1, h: 1, metadata: { label: 'Card' } }],
      'dashboard',
      true,
    )
    const target = await mountGrid([{ i: 'target', x: 2, y: 0, w: 1, h: 1 }], 'dashboard', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    await settle()

    expect((target.vm as unknown as TransferGridInstance).state.transferPlaceholder).toMatchObject({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    })
    expect(target.emitted('update:layout')).toBeUndefined()

    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(8)

    expect(source.props('layout')).toEqual([])
    expect(target.props('layout')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          i: 'card',
          x: 0,
          y: 0,
          metadata: { label: 'Card' },
        }),
      ]),
    )
    expect(source.emitted('transfer')).toHaveLength(1)
    expect(target.emitted('transfer')).toHaveLength(1)
    expect(source.emitted('transfer')?.[0]?.[0]).toMatchObject({
      status: 'committed',
      item: { i: 'card' },
    })
    expect((target.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()

    source.unmount()
    target.unmount()
  })

  it('transfer 结果使用目标父组件实际确认的业务 metadata', async () => {
    const source = await mountGrid(
      [{ i: 'card', x: 0, y: 0, w: 1, h: 1, metadata: { label: 'Draft' } }],
      'dashboard',
      true,
    )
    const target = await mountGrid([], 'dashboard', next =>
      next.map(item =>
        item.i === 'card' ? { ...item, metadata: { label: 'Confirmed' } } : { ...item },
      ),
    )
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(8)

    expect(target.props('layout')).toEqual([
      expect.objectContaining({ i: 'card', metadata: { label: 'Confirmed' } }),
    ])
    expect(source.emitted('transfer')?.[0]?.[0]).toMatchObject({
      item: { i: 'card', metadata: { label: 'Confirmed' } },
    })

    source.unmount()
    target.unmount()
  })

  it('快速切换目标并离开时只保留当前目标预览', async () => {
    const source = await mountGrid([{ i: 'card', x: 0, y: 0, w: 1, h: 1 }], 'group', true)
    const first = await mountGrid([], 'group', true)
    const second = await mountGrid([], 'group', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(first.find('.vgl-layout'), 500)
    mockRect(second.find('.vgl-layout'), 1000)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    await settle()
    expect((first.vm as unknown as TransferGridInstance).state.transferPlaceholder).not.toBeNull()

    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 1050, 50))
    await settle()
    expect((first.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()
    expect((second.vm as unknown as TransferGridInstance).state.transferPlaceholder).not.toBeNull()

    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 450, 350))
    await settle()
    expect((second.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()

    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 50, 50))
    await settle()
    expect(source.props('layout')).toHaveLength(1)
    expect(first.props('layout')).toEqual([])
    expect(second.props('layout')).toEqual([])

    source.unmount()
    first.unmount()
    second.unmount()
  })

  it('Escape 清理目标预览并回滚源网格', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    const source = await mountGrid(original, 'group', true)
    const target = await mountGrid([], 'group', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    await settle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(8)

    expect(source.props('layout')).toEqual(original)
    expect(target.props('layout')).toEqual([])
    expect((target.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()
    expect(source.emitted('transfer')).toBeUndefined()

    source.unmount()
    target.unmount()
  })

  it('拖拽期间改变 transferConfig 会取消会话并恢复源布局', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    const source = await mountGrid(original, 'group', true)
    const target = await mountGrid([], 'group', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 1, 0, 1, 1, pointer('dragmove', 150, 50))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await settle(8)
    expect(source.props('layout')).toEqual([{ ...original[0], x: 1 }])

    vm.dragEvent('dragmove', 'card', 1, 0, 1, 1, pointer('dragmove', 550, 50))
    await settle()
    expect((target.vm as unknown as TransferGridInstance).state.transferPlaceholder).not.toBeNull()

    await source.setProps({ transferConfig: { group: 'next-group' } })
    await settle(8)

    expect(source.props('layout')).toEqual(original)
    expect(target.props('layout')).toEqual([])
    expect((target.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()
    expect(source.emitted('transfer')).toBeUndefined()

    source.unmount()
    target.unmount()
  })

  it('任一父组件拒绝时补偿已确认的一端，不产生单边移动', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    const source = await mountGrid(original, 'group', false)
    const target = await mountGrid([], 'group', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(12)

    expect(source.props('layout')).toEqual(original)
    expect(target.props('layout')).toEqual([])
    expect(source.emitted('transfer')).toBeUndefined()
    expect(source.emitted('operation-rejected')?.at(-1)?.[0]).toMatchObject({
      operation: 'transfer',
      reason: 'external-not-committed',
    })

    source.unmount()
    target.unmount()
  })

  it('目标父组件拒绝时补偿已确认的源端', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    const source = await mountGrid(original, 'group', true)
    const target = await mountGrid([], 'group', false)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(12)

    expect(source.props('layout')).toEqual(original)
    expect(target.props('layout')).toEqual([])
    expect(source.emitted('transfer')).toBeUndefined()

    source.unmount()
    target.unmount()
  })

  it('源端因外部更新拒绝时不覆盖父组件的新布局', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    const external = [
      { i: 'card', x: 2, y: 0, w: 1, h: 1 },
      { i: 'live', x: 0, y: 1, w: 1, h: 1 },
    ]
    const source = await mountGrid(original, 'group', () => external.map(item => ({ ...item })))
    const target = await mountGrid([], 'group', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(12)

    expect(source.props('layout')).toEqual(external)
    expect(target.props('layout')).toEqual([])
    expect(source.emitted('transfer')).toBeUndefined()

    source.unmount()
    target.unmount()
  })

  it('提交期间卸载已确认的目标端会先提出补偿', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    const source = await mountGrid(original, 'group', false)
    const target = await mountGrid([], 'group', false)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))

    const addProposal = (target.emitted('update:layout') ?? [])
      .map(([layout]) => layout as Layout)
      .find(layout => layout.some(item => Object.is(item.i, 'card')))
    expect(addProposal).toBeDefined()
    await target.setProps({ layout: addProposal!.map(item => ({ ...item })) })
    target.unmount()
    await settle(12)

    const targetProposals = target.emitted('update:layout') ?? []
    expect(targetProposals.at(-1)?.[0]).toEqual([])
    expect(source.props('layout')).toEqual(original)
    expect(source.emitted('transfer')).toBeUndefined()

    source.unmount()
  })

  it('补偿被父组件拒绝时明确报告 transfer 拒绝', async () => {
    const original = [{ i: 'card', x: 0, y: 0, w: 1, h: 1 }]
    let sourceProposalCount = 0
    const source = await mountGrid(original, 'group', next => {
      sourceProposalCount += 1
      return sourceProposalCount === 1 ? next.map(item => ({ ...item })) : []
    })
    const target = await mountGrid([], 'group', false)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(16)

    expect(source.props('layout')).toEqual([])
    expect(source.emitted('operation-rejected')?.at(-1)?.[0]).toMatchObject({
      operation: 'transfer',
      reason: 'external-update',
    })
    expect(source.emitted('transfer')).toBeUndefined()

    source.unmount()
    target.unmount()
  })

  it('端点参与未完成 transfer 时不能开始下一笔跨网格拖拽', async () => {
    const source = await mountGrid([{ i: 'card', x: 0, y: 0, w: 1, h: 1 }], 'group', false)
    const target = await mountGrid([], 'group', false)
    const third = await mountGrid([], 'group', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)
    mockRect(third.find('.vgl-layout'), 1000)

    const sourceVm = source.vm as unknown as TransferGridInstance
    sourceVm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    sourceVm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    sourceVm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))

    const addProposal = (target.emitted('update:layout') ?? [])
      .map(([layout]) => layout as Layout)
      .find(layout => layout.some(item => Object.is(item.i, 'card')))
    expect(addProposal).toBeDefined()
    await target.setProps({
      layout: addProposal!.map(item => ({ ...item })),
      'onUpdate:layout': (next: Layout) => {
        void target.setProps({ layout: next.map(item => ({ ...item })) })
      },
    })

    const targetVm = target.vm as unknown as TransferGridInstance
    targetVm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 550, 50))
    expect(targetVm.state.isDragging).toBe(false)
    targetVm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 1050, 50))
    expect((third.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()
    targetVm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 1050, 50))
    await settle(12)

    expect(source.props('layout')).toEqual([expect.objectContaining({ i: 'card' })])
    expect(target.props('layout')).toEqual([])
    expect(third.props('layout')).toEqual([])
    expect(third.emitted('update:layout')).toBeUndefined()

    source.unmount()
    target.unmount()
    third.unmount()
  })

  it('不同 group 不接收跨网格拖入', async () => {
    const source = await mountGrid([{ i: 'card', x: 0, y: 0, w: 1, h: 1 }], 'source', true)
    const target = await mountGrid([], 'target', true)
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    await settle()

    expect((target.vm as unknown as TransferGridInstance).state.transferPlaceholder).toBeNull()
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle()
    expect(target.props('layout')).toEqual([])

    source.unmount()
    target.unmount()
  })

  it('响应式网格只更新当前 breakpoint，并在双模型确认后提交', async () => {
    const source = await mountResponsiveGrid([{ i: 'card', x: 0, y: 0, w: 1, h: 1 }])
    const target = await mountResponsiveGrid([])
    mockRect(source.find('.vgl-layout'), 0)
    mockRect(target.find('.vgl-layout'), 500)

    const vm = source.vm as unknown as TransferGridInstance
    vm.dragEvent('dragstart', 'card', 0, 0, 1, 1, pointer('dragstart', 50, 50))
    vm.dragEvent('dragmove', 'card', 0, 0, 1, 1, pointer('dragmove', 550, 50))
    vm.dragEvent('dragend', 'card', 0, 0, 1, 1, pointer('dragend', 550, 50))
    await settle(12)

    expect(source.props('layout')).toEqual([])
    expect(source.props('responsiveLayouts')).toMatchObject({ mobile: [] })
    expect(target.props('layout')).toEqual([expect.objectContaining({ i: 'card' })])
    expect(target.props('responsiveLayouts')).toMatchObject({
      mobile: [expect.objectContaining({ i: 'card' })],
    })
    expect(source.emitted('transfer')?.[0]?.[0]).toMatchObject({
      sourceBreakpoint: 'mobile',
      targetBreakpoint: 'mobile',
    })

    source.unmount()
    target.unmount()
  })
})
