import type {
  CapacitorParams,
  CircuitComponent,
  CircuitComponentId,
  ComponentCategory,
  ComponentParams,
  ComponentType,
  GroundParams,
  MonoJackParams,
  OscilloscopeProbeParams,
  PickupParams,
  PotentiometerParams,
  ResistorParams,
  SelectorParams,
  SignalGeneratorParams,
  StringExciterParams,
  SwitchParams,
  VisualPosition,
} from './circuit-component'
import type { CircuitPin, ElectricalType, PinId, PinRole } from './component-terminal'
import { assertValidCircuitComponent } from './component-validation'

interface ComponentFactoryOptions<T extends ComponentType> {
  id: string
  label?: string
  position?: VisualPosition
  params?: Partial<ComponentParams<T>>
  metadata?: CircuitComponent<T>['metadata']
}

const defaultPosition = (): VisualPosition => ({ x: 0, y: 0 })

const pin = (
  id: string,
  name: string,
  role: PinRole,
  electricalType: ElectricalType,
  direction: CircuitPin['direction'] = 'bidirectional',
): CircuitPin => ({
  id: id as PinId,
  name,
  role,
  electricalType,
  direction,
})

export function buildPickupPins(params: PickupParams): CircuitPin[] {
  const pins: CircuitPin[] =
    params.coilCount === 1 || params.conductorMode === '2_conductor'
      ? [
          pin('hot', 'signal', 'pickup_coil_start', 'passive_signal', 'output'),
          pin('ground', 'ground', 'pickup_coil_finish', 'passive_signal', 'output'),
        ]
      : [
          pin('north_start', 'N+', 'pickup_coil_start', 'passive_signal', 'output'),
          pin('north_finish', 'N-', 'pickup_coil_finish', 'passive_signal', 'output'),
          pin('south_start', 'S+', 'pickup_coil_start', 'passive_signal', 'output'),
          pin('south_finish', 'S-', 'pickup_coil_finish', 'passive_signal', 'output'),
        ]

  if (params.hasShield) {
    pins.push(pin('shield', 'shield', 'shield', 'shield_drain', 'reference'))
  }

  return pins
}

function createComponent<T extends ComponentType>(
  options: ComponentFactoryOptions<T> & {
    type: T
    label: string
    category: ComponentCategory
    pins: CircuitPin[]
    params: ComponentParams<T>
  },
): CircuitComponent<T> {
  const component: CircuitComponent<T> = {
    id: options.id as CircuitComponentId,
    type: options.type,
    label: options.label,
    category: options.category,
    pins: options.pins,
    params: options.params,
    position: options.position ?? defaultPosition(),
    metadata: options.metadata,
  }

  assertValidCircuitComponent(component)
  return component
}

export function createPickup(
  options: ComponentFactoryOptions<'pickup'>,
): CircuitComponent<'pickup'> {
  const params: PickupParams = {
    coilCount: 1,
    conductorMode: '2_conductor',
    hasShield: true,
    resistanceOhms: 6200,
    magnet: 'unknown',
    ...options.params,
  }

  if (params.coilCount === 1) {
    params.conductorMode = '2_conductor'
  }

  if (params.coilCount === 2) {
    params.northResistanceOhms ??= 4100
    params.southResistanceOhms ??= 4100
  }

  return createComponent({
    ...options,
    type: 'pickup',
    label: options.label ?? 'Pastilla',
    category: 'pickup',
    pins: buildPickupPins(params),
    params,
  })
}

export function createPotentiometer(
  options: ComponentFactoryOptions<'potentiometer'>,
): CircuitComponent<'potentiometer'> {
  const params: PotentiometerParams = {
    resistanceOhms: 250000,
    taper: 'audio',
    position: 1,
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'potentiometer',
    label: options.label ?? 'Potenciometro',
    category: 'potentiometer',
    pins: [
      pin('in', 'in', 'pot_lug', 'resistive'),
      pin('out', 'out', 'pot_wiper', 'resistive'),
      pin('ground', 'ground', 'ground', 'ground_reference', 'reference'),
    ],
    params,
  })
}

export function createCapacitor(
  options: ComponentFactoryOptions<'capacitor'>,
): CircuitComponent<'capacitor'> {
  const params: CapacitorParams = {
    capacitanceFarads: 22e-9,
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'capacitor',
    label: options.label ?? 'Condensador',
    category: 'capacitor',
    pins: [
      pin('a', 'A', 'signal', 'capacitive'),
      pin('b', 'B', 'signal', 'capacitive'),
    ],
    params,
  })
}

export function createResistor(
  options: ComponentFactoryOptions<'resistor'>,
): CircuitComponent<'resistor'> {
  const params: ResistorParams = {
    resistanceOhms: 100000,
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'resistor',
    label: options.label ?? 'Resistencia',
    category: 'resistor',
    pins: [
      pin('a', 'A', 'signal', 'resistive'),
      pin('b', 'B', 'signal', 'resistive'),
    ],
    params,
  })
}

export function createMonoJack(
  options: ComponentFactoryOptions<'mono_jack'>,
): CircuitComponent<'mono_jack'> {
  const params: MonoJackParams = {}

  return createComponent({
    ...options,
    type: 'mono_jack',
    label: options.label ?? 'Jack mono',
    category: 'jack',
    pins: [
      pin('tip', 'tip', 'jack_tip', 'passive_signal', 'input'),
      pin('sleeve', 'sleeve', 'jack_sleeve', 'ground_reference', 'reference'),
    ],
    params,
  })
}

export function createGround(
  options: ComponentFactoryOptions<'ground'>,
): CircuitComponent<'ground'> {
  const params: GroundParams = {
    referenceName: 'common',
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'ground',
    label: options.label ?? 'Tierra',
    category: 'ground',
    pins: [pin('ground', 'ground', 'ground', 'ground_reference', 'reference')],
    params,
  })
}

export function buildSwitchPins(params: SwitchParams): CircuitPin[] {
  if (params.poles === 2) {
    return [
      pin('pole_a_common', 'C1', 'switch_common', 'switch_contact'),
      pin('pole_a_throw_a', 'A1', 'switch_throw', 'switch_contact'),
      pin('pole_a_throw_b', 'B1', 'switch_throw', 'switch_contact'),
      pin('pole_b_common', 'C2', 'switch_common', 'switch_contact'),
      pin('pole_b_throw_a', 'A2', 'switch_throw', 'switch_contact'),
      pin('pole_b_throw_b', 'B2', 'switch_throw', 'switch_contact'),
    ]
  }

  return [
    pin('common', 'C', 'switch_common', 'switch_contact'),
    pin('throw_a', 'A', 'switch_throw', 'switch_contact'),
    pin('throw_b', 'B', 'switch_throw', 'switch_contact'),
  ]
}

export function createSwitch(
  options: ComponentFactoryOptions<'switch'>,
): CircuitComponent<'switch'> {
  const params: SwitchParams = {
    kind: 'SPDT',
    poles: 1,
    throws: 2,
    positions: 2,
    position: 1,
    mode: 'on_on',
    ...options.params,
  }
  params.poles = params.kind === 'DPDT' ? 2 : 1
  params.throws = 2
  params.positions = params.mode === 'on_on' ? 2 : 3

  return createComponent({
    ...options,
    type: 'switch',
    label: options.label ?? 'Switch',
    category: 'switch',
    pins: buildSwitchPins(params),
    params,
  })
}

export function buildSelectorPins(params: SelectorParams): CircuitPin[] {
  if (params.positions === 5) {
    return [
      pin('common', 'C', 'switch_common', 'switch_contact'),
      pin('bridge', 'B', 'switch_throw', 'switch_contact'),
      pin('middle', 'M', 'switch_throw', 'switch_contact'),
      pin('neck', 'N', 'switch_throw', 'switch_contact'),
    ]
  }

  return [
    pin('common', 'C', 'switch_common', 'switch_contact'),
    pin('neck', 'N', 'switch_throw', 'switch_contact'),
    pin('bridge', 'B', 'switch_throw', 'switch_contact'),
  ]
}

export function createSelector(
  options: ComponentFactoryOptions<'selector'>,
): CircuitComponent<'selector'> {
  const params: SelectorParams = {
    positions: 5,
    position: 1,
    mode: 'blade',
    ...options.params,
  }
  params.mode = params.positions === 3 ? 'toggle' : 'blade'

  return createComponent({
    ...options,
    type: 'selector',
    label: options.label ?? 'Selector',
    category: 'switch',
    pins: buildSelectorPins(params),
    params,
  })
}

export function createSpdtSwitch(options: ComponentFactoryOptions<'switch'>): CircuitComponent<'switch'> {
  return createSwitch({
    ...options,
    params: { poles: 1, kind: 'SPDT', ...options.params },
  })
}

export function createDpdtSwitch(options: ComponentFactoryOptions<'switch'>): CircuitComponent<'switch'> {
  return createSwitch({
    ...options,
    params: { poles: 2, kind: 'DPDT', ...options.params },
  })
}

export function createFivePositionSelector(options: ComponentFactoryOptions<'selector'>): CircuitComponent<'selector'> {
  return createSelector({
    ...options,
    params: { positions: 5, mode: 'blade', ...options.params },
  })
}

export function createThreePositionToggle(options: ComponentFactoryOptions<'selector'>): CircuitComponent<'selector'> {
  return createSelector({
    ...options,
    params: { positions: 3, mode: 'toggle', ...options.params },
  })
}

export function createOscilloscopeProbe(
  options: ComponentFactoryOptions<'oscilloscope_probe'>,
): CircuitComponent<'oscilloscope_probe'> {
  const params: OscilloscopeProbeParams = {
    impedanceOhms: 1000000,
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'oscilloscope_probe',
    label: options.label ?? 'Sonda de osciloscopio',
    category: 'instrument',
    pins: [
      pin('positive', '+', 'probe_positive', 'measurement', 'input'),
      pin('reference', 'ref', 'probe_reference', 'ground_reference', 'reference'),
    ],
    params,
  })
}

export function createSignalGenerator(
  options: ComponentFactoryOptions<'signal_generator'>,
): CircuitComponent<'signal_generator'> {
  const params: SignalGeneratorParams = {
    waveform: 'sine',
    frequencyHz: 440,
    amplitudeVolts: 0.1,
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'signal_generator',
    label: options.label ?? 'Generador de senal',
    category: 'instrument',
    pins: [
      pin('output', 'out', 'signal', 'measurement', 'output'),
      pin('reference', 'ref', 'ground', 'ground_reference', 'reference'),
    ],
    params,
  })
}

export function createStringExciter(
  options: ComponentFactoryOptions<'string_exciter'>,
): CircuitComponent<'string_exciter'> {
  const params: StringExciterParams = {
    waveform: 'sine',
    frequencyHz: 440,
    amplitudeVolts: 0.12,
    target: 'all_pickups',
    ...options.params,
  }

  return createComponent({
    ...options,
    type: 'string_exciter',
    label: options.label ?? 'Excitador de cuerdas',
    category: 'instrument',
    pins: [],
    params,
  })
}
