import type { ElectricalConnection, PinRef } from '@/domain/components/circuit-component'

const WIRE_COLOR_COUNT = 256
const GOLDEN_ANGLE = 137.508

function normalizeHue(hue: number): number {
  return Math.round(hue % 360)
}

export const WIRE_COLOR_PALETTE: string[] = Array.from(
  { length: WIRE_COLOR_COUNT },
  (_, index) => {
    const hue = normalizeHue(index * GOLDEN_ANGLE)
    const lightness = [34, 40, 28, 46][index % 4]

    return `hsl(${hue} 78% ${lightness}%)`
  },
)

function isSamePin(pinA: PinRef, pinB: PinRef): boolean {
  return pinA.componentId === pinB.componentId && pinA.pinId === pinB.pinId
}

export function getNextWireColor(existingConnections: ElectricalConnection[]): string {
  return WIRE_COLOR_PALETTE[existingConnections.length % WIRE_COLOR_PALETTE.length]
}

export function getPinConnectionColor(
  pinRef: PinRef,
  connections: ElectricalConnection[],
): string | null {
  const connection = connections.find(
    (candidate) => isSamePin(candidate.from, pinRef) || isSamePin(candidate.to, pinRef),
  )

  return connection?.color ?? null
}
