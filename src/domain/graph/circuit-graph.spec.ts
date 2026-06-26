import type { ElectricalConnection, PinRef } from '@/domain/components/circuit-component'
import {
  createPickup,
  createGround,
  createMonoJack,
  createPotentiometer,
} from '@/domain/components/component-factories'
import { buildCircuitGraph } from './circuit-graph'

const pin = (componentId: string, pinId: string): PinRef => ({ componentId, pinId })

describe('buildCircuitGraph', () => {
  const pickup = createPickup({ id: 'pickup-neck' })
  const volume = createPotentiometer({ id: 'volume' })
  const jack = createMonoJack({ id: 'jack' })
  const ground = createGround({ id: 'ground' })

  const connections: ElectricalConnection[] = [
    {
      id: 'wire-1',
      color: '#111111',
      from: pin('pickup-neck', 'hot'),
      to: pin('volume', 'in'),
    },
    {
      id: 'wire-2',
      color: '#222222',
      from: pin('volume', 'out'),
      to: pin('jack', 'tip'),
    },
  ]

  it('groups physically connected pins into electrical nodes', () => {
    const graph = buildCircuitGraph([pickup, volume, jack, ground], connections)

    expect(graph.arePinsConnected(pin('pickup-neck', 'hot'), pin('volume', 'in'))).toBe(true)
    expect(graph.arePinsConnected(pin('volume', 'out'), pin('jack', 'tip'))).toBe(true)
    expect(graph.arePinsConnected(pin('pickup-neck', 'hot'), pin('jack', 'tip'))).toBe(false)
  })

  it('finds connected pins for a pin reference', () => {
    const graph = buildCircuitGraph([pickup, volume, jack, ground], connections)

    expect(graph.findConnectedPins(pin('jack', 'sleeve'))).toEqual(
      expect.arrayContaining([
        pin('pickup-neck', 'ground'),
        pin('pickup-neck', 'shield'),
        pin('volume', 'ground'),
        pin('ground', 'ground'),
      ]),
    )
  })

  it('returns the electrical node of a pin', () => {
    const graph = buildCircuitGraph([pickup, volume, jack, ground], connections)
    const node = graph.getElectricalNodeOfPin(pin('volume', 'out'))

    expect(node?.pins).toEqual([pin('volume', 'out'), pin('jack', 'tip')])
  })

  it('detects floating pins', () => {
    const graph = buildCircuitGraph([pickup, volume, jack, ground], connections)

    expect(graph.getFloatingPins()).toEqual([])
  })

  it('returns components connected by at least one direct electrical node', () => {
    const graph = buildCircuitGraph([pickup, volume, jack, ground], connections)

    expect(graph.getConnectedComponents('jack').map((component) => String(component.id))).toEqual([
      'volume',
      'pickup-neck',
      'ground',
    ])
  })

  it('uses physical continuity for path checks and exposes debug info', () => {
    const graph = buildCircuitGraph([pickup, volume, jack, ground], connections)

    expect(graph.hasPathBetweenPins(pin('ground', 'ground'), pin('jack', 'sleeve'))).toBe(true)
    expect(graph.debugGraph()).toMatchObject({
      componentCount: 4,
      pinCount: 9,
      connectionCount: 2,
      electricalNodeCount: 3,
    })
  })
})
