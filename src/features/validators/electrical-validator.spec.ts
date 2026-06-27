import type { ElectricalConnection } from '@/domain/components/circuit-component'
import {
  createGround,
  createFivePositionSelector,
  createMonoJack,
  createPickup,
  createPotentiometer,
} from '@/domain/components/component-factories'
import { buildCircuitGraph } from '@/domain/graph/circuit-graph'
import { validateCircuit, validateElectricalGraph } from './electrical-validator'
import type { ValidationContext } from './validation-result'

const connection = (
  id: string,
  fromComponentId: string,
  fromPinId: string,
  toComponentId: string,
  toPinId: string,
): ElectricalConnection => ({
  id,
  color: '#111111',
  from: { componentId: fromComponentId, pinId: fromPinId },
  to: { componentId: toComponentId, pinId: toPinId },
})

const context = (
  components: ValidationContext['components'],
  connections: ElectricalConnection[],
  extra?: Partial<ValidationContext>,
): ValidationContext => ({
  components,
  connections,
  graph: buildCircuitGraph(components, connections),
  ...extra,
})

describe('validateElectricalGraph', () => {
  it('reports helpful issues for an empty workspace', () => {
    const result = validateElectricalGraph([], [])

    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.id)).toContain('empty-workspace')
  })
})

describe('validateCircuit', () => {
  it('accepts a working one-pickup volume jack circuit', () => {
    const pickup = createPickup({ id: 'pickup-neck', label: 'Neck Single Coil' })
    const volume = createPotentiometer({ id: 'volume', label: 'Volume 250k' })
    const jack = createMonoJack({ id: 'jack' })
    const ground = createGround({ id: 'ground' })
    const components = [pickup, volume, jack, ground]
    const connections = [
      connection('w1', 'pickup-neck', 'hot', 'volume', 'in'),
      connection('w2', 'volume', 'out', 'jack', 'tip'),
    ]

    const result = validateCircuit(context(components, connections))

    expect(result.valid).toBe(true)
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(result.issues.map((issue) => issue.code)).not.toContain('jack_tip_no_signal')
  })

  it('detects a shorted jack', () => {
    const pickup = createPickup({ id: 'pickup-neck' })
    const jack = createMonoJack({ id: 'jack' })
    const ground = createGround({ id: 'ground' })
    const components = [pickup, jack, ground]
    const connections = [
      connection('w1', 'jack', 'tip', 'jack', 'sleeve'),
      connection('w2', 'jack', 'sleeve', 'ground', 'ground'),
    ]

    const result = validateCircuit(context(components, connections))

    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('jack_tip_sleeve_short')
    expect(result.issues.map((issue) => issue.message)).toContain(
      'jack.tip y jack.sleeve estan unidos directamente. La salida quedara en corto.',
    )
  })

  it('detects a mono jack sleeve without ground', () => {
    const pickup = createPickup({ id: 'pickup-neck' })
    const jack = createMonoJack({ id: 'jack' })

    const result = validateCircuit(context([pickup, jack], []))

    expect(result.valid).toBe(false)
    expect(result.byComponent.jack.map((issue) => issue.code)).toContain(
      'jack_sleeve_missing_ground',
    )
  })

  it('reports a muted 5-position selector position', () => {
    const pickup = createPickup({ id: 'pickup-neck' })
    const selector = createFivePositionSelector({ id: 'selector' })
    const jack = createMonoJack({ id: 'jack' })
    const ground = createGround({ id: 'ground' })
    const components = [pickup, selector, jack, ground]
    const baseConnections = [
      connection('base-1', 'selector', 'common', 'jack', 'tip'),
      connection('base-2', 'jack', 'sleeve', 'ground', 'ground'),
      connection('base-3', 'pickup-neck', 'ground', 'ground', 'ground'),
      connection('base-4', 'pickup-neck', 'shield', 'ground', 'ground'),
    ]
    const connectedPosition = [
      ...baseConnections,
      connection('pos-1', 'pickup-neck', 'hot', 'selector', 'common'),
    ]
    const mutedPosition = baseConnections
    const switchPositions = [1, 2, 3, 4, 5].map((position) => {
      const positionConnections = position === 3 ? mutedPosition : connectedPosition

      return {
        id: `selector-position-${position}`,
        switchId: 'selector',
        label: `Position ${position}`,
        position,
        graph: buildCircuitGraph(components, positionConnections),
      }
    })

    const result = validateCircuit(context(components, connectedPosition, { switchPositions }))

    expect(result.bySwitchPosition['selector-position-3'].map((issue) => issue.message)).toContain(
      'En la posicion 3 del selector, el jack no recibe señal de ninguna pastilla.',
    )
  })

  it('grounds a humbucker shield through the virtual ground bus', () => {
    const humbucker = createPickup({
      id: 'bridge',
      label: 'Bridge',
      params: { coilCount: 2, conductorMode: '4_conductor', hasShield: true },
    })
    const jack = createMonoJack({ id: 'jack' })
    const ground = createGround({ id: 'ground' })
    const components = [humbucker, jack, ground]
    const connections = [
      connection('w1', 'bridge', 'north_start', 'jack', 'tip'),
      connection('w2', 'bridge', 'north_finish', 'ground', 'ground'),
    ]

    const result = validateCircuit(context(components, connections))

    expect(result.byComponent.bridge?.map((issue) => issue.code) ?? []).not.toContain(
      'humbucker_shield_floating',
    )
  })
})
