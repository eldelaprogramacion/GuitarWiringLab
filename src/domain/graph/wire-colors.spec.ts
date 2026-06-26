import type { ElectricalConnection, PinRef } from '@/domain/components/circuit-component'
import {
  getNextWireColor,
  getPinConnectionColor,
  WIRE_COLOR_PALETTE,
} from './wire-colors'

const pin = (componentId: string, pinId: string): PinRef => ({ componentId, pinId })

const wire = (
  id: string,
  color: string,
  from: PinRef,
  to: PinRef,
): ElectricalConnection => ({
  id,
  color,
  from,
  to,
})

describe('wire colors', () => {
  it('exposes a reusable 256-color palette', () => {
    expect(WIRE_COLOR_PALETTE).toHaveLength(256)
    expect(new Set(WIRE_COLOR_PALETTE).size).toBe(256)
  })

  it('returns the next palette color and wraps after 256 wires', () => {
    const existingConnections = WIRE_COLOR_PALETTE.map((color, index) =>
      wire(`wire-${index}`, color, pin('a', String(index)), pin('b', String(index))),
    )

    expect(getNextWireColor([])).toBe(WIRE_COLOR_PALETTE[0])
    expect(getNextWireColor(existingConnections.slice(0, 1))).toBe(WIRE_COLOR_PALETTE[1])
    expect(getNextWireColor(existingConnections)).toBe(WIRE_COLOR_PALETTE[0])
  })

  it('finds the visual color of a connected pin', () => {
    const connections = [
      wire('wire-1', '#ff0000', pin('pickup', 'hot'), pin('volume', 'in')),
      wire('wire-2', '#00ff00', pin('volume', 'out'), pin('jack', 'tip')),
    ]

    expect(getPinConnectionColor(pin('pickup', 'hot'), connections)).toBe('#ff0000')
    expect(getPinConnectionColor(pin('jack', 'tip'), connections)).toBe('#00ff00')
    expect(getPinConnectionColor(pin('ground', 'ground'), connections)).toBeNull()
  })
})
