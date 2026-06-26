import { createPinia, setActivePinia } from 'pinia'

import type { ElectricalConnection } from '@/domain/components/circuit-component'
import { getNextWireColor, getPinConnectionColor } from '@/domain/graph/wire-colors'
import { useCircuitStore } from './circuit.store'

describe('useCircuitStore wire colors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('assigns an automatic color when adding a Vue Flow connection', () => {
    const store = useCircuitStore()

    store.addConnection({
      source: 'pickup',
      sourceHandle: 'hot',
      target: 'volume',
      targetHandle: 'in',
    })

    expect(store.connections).toHaveLength(1)
    expect(store.connections[0].color).toBe(getNextWireColor([]))
    expect(
      getPinConnectionColor({ componentId: 'pickup', pinId: 'hot' }, store.connections),
    ).toBe(store.connections[0].color)
  })

  it('preserves explicit colors and returns null for a pin after removing its last wire', () => {
    const store = useCircuitStore()
    const connection: ElectricalConnection = {
      id: 'wire-custom',
      color: '#ff3366',
      from: { componentId: 'pickup', pinId: 'hot' },
      to: { componentId: 'jack', pinId: 'tip' },
    }

    store.addConnection(connection)

    expect(store.connections[0].color).toBe('#ff3366')

    store.removeConnection('wire-custom')

    expect(store.connections).toHaveLength(0)
    expect(
      getPinConnectionColor({ componentId: 'pickup', pinId: 'hot' }, store.connections),
    ).toBeNull()
  })

  it('uses connection colors in Vue Flow edges', () => {
    const store = useCircuitStore()

    store.addConnection({
      id: 'wire-colored',
      color: '#3366ff',
      from: { componentId: 'volume', pinId: 'out' },
      to: { componentId: 'jack', pinId: 'tip' },
    })

    expect(store.edges[0].style).toMatchObject({ stroke: '#3366ff' })
    expect(store.edges[0].markerEnd).toMatchObject({ color: '#3366ff' })
  })

  it('selects, updates, and clears editable connections', () => {
    const store = useCircuitStore()

    store.addConnection({
      id: 'wire-editable',
      color: '#3366ff',
      from: { componentId: 'volume', pinId: 'out' },
      to: { componentId: 'jack', pinId: 'tip' },
    })
    store.selectConnection('wire-editable')
    store.updateConnection('wire-editable', {
      source: 'volume',
      sourceHandle: 'in',
      target: 'tone',
      targetHandle: 'out',
    })

    expect(store.selectedConnectionId).toBe('wire-editable')
    expect(store.connections[0]).toMatchObject({
      from: { componentId: 'volume', pinId: 'in' },
      to: { componentId: 'tone', pinId: 'out' },
      color: '#3366ff',
    })

    store.removeConnection('wire-editable')

    expect(store.selectedConnectionId).toBeUndefined()
  })
})
