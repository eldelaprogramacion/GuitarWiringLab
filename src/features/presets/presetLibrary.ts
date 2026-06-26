import type { CircuitComponent, ElectricalConnection } from '@/domain/components/circuit-component'
import {
  componentCatalog,
  createComponentFromCatalogItem,
  type CatalogItem,
} from '@/domain/components/componentCatalog'
import { buildCircuitGraph } from '@/domain/graph/circuit-graph'
import { WIRE_COLOR_PALETTE } from '@/domain/graph/wire-colors'
import type { ValidationContext } from '@/features/validators/validation-result'

export interface PresetSwitchPosition {
  id: string
  switchId: string
  label: string
  position: number
  activeConnections: ElectricalConnection[]
}

export type PresetCategory =
  | 'one_pickup'
  | 'two_pickups'
  | 'three_pickups'

export interface CircuitPreset {
  id: string
  name: string
  category: PresetCategory
  description: string
  components: CircuitComponent[]
  connections: ElectricalConnection[]
  switchPositions: PresetSwitchPosition[]
}

interface CircuitPresetStoreTarget {
  loadCircuit?: (
    components: CircuitComponent[],
    connections: ElectricalConnection[],
    switchPositions?: PresetSwitchPosition[],
  ) => void
  components?: CircuitComponent[]
  connections?: ElectricalConnection[]
  switchPositions?: PresetSwitchPosition[]
  selectedComponentId?: string
}

type PresetFactory = () => CircuitPreset

const catalogItem = (id: string): CatalogItem => {
  const item = componentCatalog.find((candidate) => candidate.id === id)

  if (!item) {
    throw new Error(`Unknown catalog item: ${id}`)
  }

  return item
}

const localizeComponentLabel = (label: string): string =>
  label
    .replaceAll('Single / Both', 'Simple / Ambas')
    .replaceAll('North / Both / South', 'Norte / Ambas / Sur')
    .replaceAll('Output Jack', 'Jack de salida')
    .replaceAll('Ground', 'Tierra')
    .replaceAll('Single Coil', 'Single coil')
    .replaceAll('Humbucker', 'Humbucker')
    .replaceAll('Master', 'Maestro')
    .replaceAll('Volume', 'Volumen')
    .replaceAll('Tone Cap', 'Condensador tono')
    .replaceAll('Tone', 'Tono')
    .replaceAll('Neck', 'Mastil')
    .replaceAll('Middle', 'Medio')
    .replaceAll('Bridge', 'Puente')
    .replaceAll('Series', 'Serie')
    .replaceAll('Split', 'Split')
    .replaceAll('Parallel', 'Paralelo')
    .replaceAll('Selector toggle', 'Selector 3 posiciones')

const localizePositionLabel = (label: string): string =>
  label
    .replaceAll('Single Coil', 'Single coil')
    .replaceAll('Both Coils', 'Ambas bobinas')
    .replaceAll('Both', 'Ambas')
    .replaceAll('Series', 'Serie')
    .replaceAll('Parallel', 'Paralelo')
    .replaceAll('Neck', 'Mastil')
    .replaceAll('Middle', 'Medio')
    .replaceAll('Bridge', 'Puente')
    .replaceAll('North', 'Norte')
    .replaceAll('South', 'Sur')

const localizeSwitchPositions = (switchPositions: PresetSwitchPosition[]): PresetSwitchPosition[] =>
  switchPositions.map((switchPosition) => ({
    ...switchPosition,
    label: localizePositionLabel(switchPosition.label),
  }))

const component = (
  catalogId: string,
  id: string,
  label: string,
  x: number,
  y: number,
  params: Record<string, unknown> = {},
): CircuitComponent =>
  createComponentFromCatalogItem(catalogItem(catalogId), {
    id,
    label: localizeComponentLabel(label),
    position: { x, y },
    params,
  })

const colorForWireId = (id: string): string => {
  let hash = 0

  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % WIRE_COLOR_PALETTE.length
  }

  return WIRE_COLOR_PALETTE[hash]
}

const wire = (
  id: string,
  fromComponentId: string,
  fromPinId: string,
  toComponentId: string,
  toPinId: string,
): ElectricalConnection => ({
  id,
  color: colorForWireId(id),
  from: { componentId: fromComponentId, pinId: fromPinId },
  to: { componentId: toComponentId, pinId: toPinId },
})

const implicitGroundPinIds = new Set(['ground', 'sleeve', 'shield', 'reference'])

const isGroundBusEndpoint = (endpoint: ElectricalConnection['from']): boolean =>
  endpoint.componentId === 'ground' && endpoint.pinId === 'ground'

const isImplicitGroundEndpoint = (endpoint: ElectricalConnection['from']): boolean =>
  implicitGroundPinIds.has(endpoint.pinId)

const isRedundantGroundWire = (connection: ElectricalConnection): boolean =>
  (isGroundBusEndpoint(connection.from) && isImplicitGroundEndpoint(connection.to)) ||
  (isGroundBusEndpoint(connection.to) && isImplicitGroundEndpoint(connection.from))

const compactGroundBusConnections = (
  connections: ElectricalConnection[],
): ElectricalConnection[] => connections.filter((connection) => !isRedundantGroundWire(connection))

const groundSingleCoil = (prefix: string, pickupId: string): ElectricalConnection[] => [
  wire(`${prefix}-ground`, pickupId, 'ground', 'ground', 'ground'),
  wire(`${prefix}-shield-ground`, pickupId, 'shield', 'ground', 'ground'),
]

const groundHumbucker = (prefix: string, pickupId: string): ElectricalConnection[] => [
  wire(`${prefix}-north-finish-ground`, pickupId, 'north_finish', 'ground', 'ground'),
  wire(`${prefix}-south-finish-ground`, pickupId, 'south_finish', 'ground', 'ground'),
  wire(`${prefix}-shield-ground`, pickupId, 'shield', 'ground', 'ground'),
]

const seriesHumbuckerGround = (prefix: string, pickupId: string): ElectricalConnection[] => [
  wire(`${prefix}-series-link`, pickupId, 'north_finish', pickupId, 'south_start'),
  wire(`${prefix}-south-finish-ground`, pickupId, 'south_finish', 'ground', 'ground'),
  wire(`${prefix}-shield-ground`, pickupId, 'shield', 'ground', 'ground'),
]

const toneNetwork = (
  prefix: string,
  signalComponentId: string,
  signalPinId: string,
  tonePotId: string,
  capacitorId: string,
): ElectricalConnection[] => [
  wire(`${prefix}-signal-tone-in`, signalComponentId, signalPinId, tonePotId, 'in'),
  wire(`${prefix}-tone-ground`, tonePotId, 'ground', 'ground', 'ground'),
  wire(`${prefix}-tone-out-cap`, tonePotId, 'out', capacitorId, 'a'),
  wire(`${prefix}-cap-ground`, capacitorId, 'b', 'ground', 'ground'),
]

const noSwitchPositions: PresetSwitchPosition[] = []
const singlePickupParams = { coilCount: 1, conductorMode: '2_conductor', hasShield: true }
const humbucker4Params = { coilCount: 2, conductorMode: '4_conductor', hasShield: true }

function withStringExciter(preset: CircuitPreset): CircuitPreset {
  if (preset.components.some((presetComponent) => presetComponent.type === 'string_exciter')) {
    return preset
  }

  return {
    ...preset,
    components: [
      ...preset.components,
      component('string_exciter', 'strings', 'Excitador de cuerdas', 20, 20, {
        waveform: 'multi_frequency',
      }),
    ],
  }
}

function singlePickupVolumeJack(): CircuitPreset {
  const components = [
    component('pickup', 'pickup', 'Single Coil', 80, 120, singlePickupParams),
    component('potentiometer', 'volume', 'Volume 250k', 340, 120),
    component('mono_jack', 'jack', 'Output Jack', 620, 120),
    component('ground', 'ground', 'Ground', 340, 300),
  ]
  const connections = [
    wire('pickup-hot-volume-in', 'pickup', 'hot', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...groundSingleCoil('pickup', 'pickup'),
  ]

  return {
    id: 'single-pickup-volume-jack',
    name: '01 S - Vol - Jack',
    category: 'one_pickup',
    description: 'Una single coil con volumen maestro, jack mono y tierra.',
    components,
    connections,
    switchPositions: noSwitchPositions,
  }
}

function singlePickupVolumeToneJack(): CircuitPreset {
  const components = [
    component('pickup', 'pickup', 'Single Coil', 80, 120, singlePickupParams),
    component('potentiometer', 'volume', 'Volume 250k', 320, 100),
    component('potentiometer', 'tone', 'Tone 250k', 320, 240),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 520, 250),
    component('mono_jack', 'jack', 'Output Jack', 700, 120),
    component('ground', 'ground', 'Ground', 520, 360),
  ]
  const connections = [
    wire('pickup-hot-volume-in', 'pickup', 'hot', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...groundSingleCoil('pickup', 'pickup'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]

  return {
    id: 'single-pickup-volume-tone-jack',
    name: '02 S - Vol/Tono - Jack',
    category: 'one_pickup',
    description: 'Single coil con volumen, tono pasivo, capacitor de 22nF, jack y tierra.',
    components,
    connections,
    switchPositions: noSwitchPositions,
  }
}

function sssFivePositionStandard(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Single Coil', 80, 80, singlePickupParams),
    component('pickup', 'middle', 'Middle Single Coil RP/RW', 80, 210, singlePickupParams),
    component('pickup', 'bridge', 'Bridge Single Coil', 80, 340, singlePickupParams),
    component('selector', 'selector', 'Selector 5 posiciones', 340, 210, { positions: 5 }),
    component('potentiometer', 'volume', 'Volume 250k', 560, 120),
    component('potentiometer', 'tone-neck', 'Neck Tone 250k', 560, 250),
    component('potentiometer', 'tone-middle', 'Middle Tone 250k', 560, 380),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 760, 320),
    component('mono_jack', 'jack', 'Output Jack', 920, 120),
    component('ground', 'ground', 'Ground', 760, 470),
  ]
  const baseConnections = [
    wire('neck-hot-selector', 'neck', 'hot', 'selector', 'neck'),
    wire('middle-hot-selector', 'middle', 'hot', 'selector', 'middle'),
    wire('bridge-hot-selector', 'bridge', 'hot', 'selector', 'bridge'),
    wire('selector-common-volume-in', 'selector', 'common', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...groundSingleCoil('neck', 'neck'),
    ...groundSingleCoil('middle', 'middle'),
    ...groundSingleCoil('bridge', 'bridge'),
    ...toneNetwork('neck-tone', 'selector', 'neck', 'tone-neck', 'tone-cap'),
    wire('middle-tone-signal', 'selector', 'middle', 'tone-middle', 'in'),
    wire('middle-tone-ground', 'tone-middle', 'ground', 'ground', 'ground'),
    wire('middle-tone-out-cap', 'tone-middle', 'out', 'tone-cap', 'a'),
  ]
  const switchPositions = [
    fivePositionSelectorPosition('sss-pos-1', 1, 'Bridge', ['bridge']),
    fivePositionSelectorPosition('sss-pos-2', 2, 'Bridge + Middle', ['bridge', 'middle']),
    fivePositionSelectorPosition('sss-pos-3', 3, 'Middle', ['middle']),
    fivePositionSelectorPosition('sss-pos-4', 4, 'Middle + Neck', ['middle', 'neck']),
    fivePositionSelectorPosition('sss-pos-5', 5, 'Neck', ['neck']),
  ]

  return {
    id: 'sss-5-position-standard',
    name: '10 SSS - 5 posiciones',
    category: 'three_pickups',
    description: 'SSS con selector de 5 posiciones, volumen maestro y dos tonos.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function sssFivePositionThreePots(): CircuitPreset {
  const preset = sssFivePositionStandard()

  return {
    ...preset,
    id: 'sss-5-position-3-pots',
    name: '11 SSS - 3 potenciometros',
    description: 'SSS con selector de 5 posiciones, volumen maestro y dos tonos.',
  }
}

function fivePositionSelectorPosition(
  id: string,
  position: number,
  label: string,
  throws: Array<'bridge' | 'middle' | 'neck'>,
): PresetSwitchPosition {
  return {
    id,
    switchId: 'selector',
    label: localizePositionLabel(label),
    position,
    activeConnections: throws.map((throwId) =>
      wire(`${id}-${throwId}-to-common`, 'selector', throwId, 'selector', 'common'),
    ),
  }
}

function ssThreePositionVolumeTone(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Single Coil', 80, 120, singlePickupParams),
    component('pickup', 'bridge', 'Bridge Single Coil', 80, 320, singlePickupParams),
    component('selector', 'toggle', 'Selector 3 posiciones', 330, 220, { positions: 3 }),
    component('potentiometer', 'volume', 'Master Volume 250k', 560, 140),
    component('potentiometer', 'tone', 'Master Tone 250k', 560, 300),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 760, 320),
    component('mono_jack', 'jack', 'Output Jack', 930, 140),
    component('ground', 'ground', 'Ground', 760, 450),
  ]
  const baseConnections = [
    wire('neck-hot-toggle', 'neck', 'hot', 'toggle', 'neck'),
    wire('bridge-hot-toggle', 'bridge', 'hot', 'toggle', 'bridge'),
    wire('toggle-common-volume-in', 'toggle', 'common', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...groundSingleCoil('neck', 'neck'),
    ...groundSingleCoil('bridge', 'bridge'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    threePositionTogglePosition('ss-master-pos-1', 1, 'Neck', ['neck']),
    threePositionTogglePosition('ss-master-pos-2', 2, 'Neck + Bridge', ['neck', 'bridge']),
    threePositionTogglePosition('ss-master-pos-3', 3, 'Bridge', ['bridge']),
  ]

  return {
    id: 'ss-3-position-volume-tone',
    name: '06 SS - Vol/Tono',
    category: 'two_pickups',
    description: 'SS con selector toggle de 3 posiciones, volumen maestro, tono maestro y jack.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function ssThreePositionTwoVolumesTwoTones(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Single Coil', 80, 120, singlePickupParams),
    component('pickup', 'bridge', 'Bridge Single Coil', 80, 320, singlePickupParams),
    component('potentiometer', 'neck-volume', 'Neck Volume 250k', 330, 90),
    component('potentiometer', 'bridge-volume', 'Bridge Volume 250k', 330, 290),
    component('potentiometer', 'neck-tone', 'Neck Tone 250k', 530, 130),
    component('potentiometer', 'bridge-tone', 'Bridge Tone 250k', 530, 330),
    component('capacitor', 'neck-cap', 'Neck Tone Cap 22nF', 700, 160),
    component('capacitor', 'bridge-cap', 'Bridge Tone Cap 22nF', 700, 360),
    component('selector', 'toggle', 'Selector 3 posiciones', 760, 250, { positions: 3 }),
    component('mono_jack', 'jack', 'Output Jack', 980, 250),
    component('ground', 'ground', 'Ground', 760, 500),
  ]
  const baseConnections = [
    wire('neck-hot-volume-in', 'neck', 'hot', 'neck-volume', 'in'),
    wire('bridge-hot-volume-in', 'bridge', 'hot', 'bridge-volume', 'in'),
    wire('neck-volume-toggle', 'neck-volume', 'out', 'toggle', 'neck'),
    wire('bridge-volume-toggle', 'bridge-volume', 'out', 'toggle', 'bridge'),
    wire('toggle-common-jack-tip', 'toggle', 'common', 'jack', 'tip'),
    wire('neck-volume-ground', 'neck-volume', 'ground', 'ground', 'ground'),
    wire('bridge-volume-ground', 'bridge-volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...groundSingleCoil('neck', 'neck'),
    ...groundSingleCoil('bridge', 'bridge'),
    ...toneNetwork('neck-tone', 'neck-volume', 'in', 'neck-tone', 'neck-cap'),
    ...toneNetwork('bridge-tone', 'bridge-volume', 'in', 'bridge-tone', 'bridge-cap'),
  ]
  const switchPositions = [
    threePositionTogglePosition('ss-2v2t-pos-1', 1, 'Neck', ['neck']),
    threePositionTogglePosition('ss-2v2t-pos-2', 2, 'Neck + Bridge', ['neck', 'bridge']),
    threePositionTogglePosition('ss-2v2t-pos-3', 3, 'Bridge', ['bridge']),
  ]

  return {
    id: 'ss-3-position-2v2t',
    name: '07 SS - 2 Vol/2 Tono',
    category: 'two_pickups',
    description: 'SS con selector toggle de 3 posiciones, 2 volumenes, 2 tonos y jack.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function hhThreePositionStandard(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Humbucker', 80, 120, humbucker4Params),
    component('pickup', 'bridge', 'Bridge Humbucker', 80, 320, humbucker4Params),
    component('potentiometer', 'neck-volume', 'Neck Volume 500k', 330, 90, { resistanceOhms: 500000 }),
    component('potentiometer', 'bridge-volume', 'Bridge Volume 500k', 330, 290, { resistanceOhms: 500000 }),
    component('potentiometer', 'neck-tone', 'Neck Tone 500k', 530, 130, { resistanceOhms: 500000 }),
    component('potentiometer', 'bridge-tone', 'Bridge Tone 500k', 530, 330, { resistanceOhms: 500000 }),
    component('capacitor', 'neck-cap', 'Neck Tone Cap 22nF', 700, 160),
    component('capacitor', 'bridge-cap', 'Bridge Tone Cap 22nF', 700, 360),
    component('selector', 'toggle', 'Selector 3 posiciones', 760, 250, { positions: 3 }),
    component('mono_jack', 'jack', 'Output Jack', 980, 250),
    component('ground', 'ground', 'Ground', 760, 500),
  ]
  const baseConnections = [
    wire('neck-hot-volume-in', 'neck', 'north_start', 'neck-volume', 'in'),
    wire('bridge-hot-volume-in', 'bridge', 'north_start', 'bridge-volume', 'in'),
    wire('neck-volume-toggle', 'neck-volume', 'out', 'toggle', 'neck'),
    wire('bridge-volume-toggle', 'bridge-volume', 'out', 'toggle', 'bridge'),
    wire('toggle-common-jack-tip', 'toggle', 'common', 'jack', 'tip'),
    wire('neck-volume-ground', 'neck-volume', 'ground', 'ground', 'ground'),
    wire('bridge-volume-ground', 'bridge-volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...groundHumbucker('neck', 'neck'),
    ...groundHumbucker('bridge', 'bridge'),
    ...toneNetwork('neck-tone', 'neck-volume', 'in', 'neck-tone', 'neck-cap'),
    ...toneNetwork('bridge-tone', 'bridge-volume', 'in', 'bridge-tone', 'bridge-cap'),
  ]
  const switchPositions = [
    threePositionTogglePosition('hh-pos-1', 1, 'Neck', ['neck']),
    threePositionTogglePosition('hh-pos-2', 2, 'Neck + Bridge', ['neck', 'bridge']),
    threePositionTogglePosition('hh-pos-3', 3, 'Bridge', ['bridge']),
  ]

  return {
    id: 'hh-3-position-standard',
    name: '09 HH - 2 Vol/2 Tono',
    category: 'two_pickups',
    description: 'HH con selector toggle de 3 posiciones, 2 volumenes, 2 tonos y jack.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function hhThreePositionVolumeTone(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Humbucker', 80, 120, humbucker4Params),
    component('pickup', 'bridge', 'Bridge Humbucker', 80, 320, humbucker4Params),
    component('selector', 'toggle', 'Selector 3 posiciones', 330, 220, { positions: 3 }),
    component('potentiometer', 'volume', 'Master Volume 500k', 560, 140, { resistanceOhms: 500000 }),
    component('potentiometer', 'tone', 'Master Tone 500k', 560, 300, { resistanceOhms: 500000 }),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 760, 320),
    component('mono_jack', 'jack', 'Output Jack', 930, 140),
    component('ground', 'ground', 'Ground', 760, 450),
  ]
  const baseConnections = [
    wire('neck-hot-toggle', 'neck', 'north_start', 'toggle', 'neck'),
    wire('bridge-hot-toggle', 'bridge', 'north_start', 'toggle', 'bridge'),
    wire('toggle-common-volume-in', 'toggle', 'common', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...seriesHumbuckerGround('neck', 'neck'),
    ...seriesHumbuckerGround('bridge', 'bridge'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    threePositionTogglePosition('hh-master-pos-1', 1, 'Neck', ['neck']),
    threePositionTogglePosition('hh-master-pos-2', 2, 'Neck + Bridge', ['neck', 'bridge']),
    threePositionTogglePosition('hh-master-pos-3', 3, 'Bridge', ['bridge']),
  ]

  return {
    id: 'hh-3-position-volume-tone',
    name: '08 HH - Vol/Tono',
    category: 'two_pickups',
    description: 'HH con selector toggle de 3 posiciones, volumen maestro, tono maestro y jack.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function threePositionTogglePosition(
  id: string,
  position: number,
  label: string,
  throws: Array<'neck' | 'bridge'>,
): PresetSwitchPosition {
  return {
    id,
    switchId: 'toggle',
    label: localizePositionLabel(label),
    position,
    activeConnections: throws.map((throwId) =>
      wire(`${id}-${throwId}-to-common`, 'toggle', throwId, 'toggle', 'common'),
    ),
  }
}

function humbuckerSeriesSplitParallel(): CircuitPreset {
  const components = [
    component('pickup', 'humbucker', 'Bridge Humbucker', 80, 160, humbucker4Params),
    component('switch', 'mode-switch', 'Serie / Split / Paralelo DPDT', 340, 180, { kind: 'DPDT', mode: 'on_on_on' }),
    component('potentiometer', 'volume', 'Volume 500k', 590, 120, { resistanceOhms: 500000 }),
    component('potentiometer', 'tone', 'Tone 500k', 590, 280, { resistanceOhms: 500000 }),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 790, 300),
    component('mono_jack', 'jack', 'Output Jack', 930, 120),
    component('ground', 'ground', 'Ground', 790, 420),
  ]
  const baseConnections = [
    wire('north-start-switch-common-a', 'humbucker', 'north_start', 'mode-switch', 'pole_a_common'),
    wire('south-start-switch-common-b', 'humbucker', 'south_start', 'mode-switch', 'pole_b_common'),
    wire('north-finish-switch-a-throw-b', 'humbucker', 'north_finish', 'mode-switch', 'pole_a_throw_b'),
    wire('south-finish-switch-b-throw-b', 'humbucker', 'south_finish', 'mode-switch', 'pole_b_throw_b'),
    wire('switch-a-throw-a-volume', 'mode-switch', 'pole_a_throw_a', 'volume', 'in'),
    wire('switch-b-throw-a-volume', 'mode-switch', 'pole_b_throw_a', 'volume', 'in'),
    wire('switch-b-throw-b-ground', 'mode-switch', 'pole_b_throw_b', 'ground', 'ground'),
    wire('shield-ground', 'humbucker', 'shield', 'ground', 'ground'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    {
      id: 'humbucker-mode-series',
      switchId: 'mode-switch',
      label: 'Series',
      position: 1,
      activeConnections: [
        wire('series-north-hot', 'mode-switch', 'pole_a_common', 'mode-switch', 'pole_a_throw_a'),
        wire('series-link', 'mode-switch', 'pole_a_throw_b', 'mode-switch', 'pole_b_common'),
        wire('series-south-ground', 'mode-switch', 'pole_b_throw_b', 'ground', 'ground'),
      ],
    },
    {
      id: 'humbucker-mode-split',
      switchId: 'mode-switch',
      label: 'Split',
      position: 2,
      activeConnections: [
        wire('split-north-hot', 'mode-switch', 'pole_a_common', 'mode-switch', 'pole_a_throw_a'),
        wire('split-north-ground', 'mode-switch', 'pole_a_throw_b', 'ground', 'ground'),
      ],
    },
    {
      id: 'humbucker-mode-parallel',
      switchId: 'mode-switch',
      label: 'Parallel',
      position: 3,
      activeConnections: [
        wire('parallel-north-hot', 'mode-switch', 'pole_a_common', 'mode-switch', 'pole_a_throw_a'),
        wire('parallel-south-hot', 'mode-switch', 'pole_b_common', 'mode-switch', 'pole_b_throw_a'),
        wire('parallel-north-ground', 'mode-switch', 'pole_a_throw_b', 'ground', 'ground'),
        wire('parallel-south-ground', 'mode-switch', 'pole_b_throw_b', 'ground', 'ground'),
      ],
    },
  ]

  return {
    id: 'humbucker-series-split-parallel',
    name: '05 HB - Serie/Split/Paralelo',
    category: 'one_pickup',
    description: 'Humbucker de 4 conductores con DPDT on/on/on, volumen, tono, jack y tierra.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function humbuckerSplitSingleBoth(): CircuitPreset {
  const components = [
    component('pickup', 'humbucker', 'Bridge Humbucker', 80, 150, humbucker4Params),
    component('switch', 'split-switch', 'Simple / Ambas SPDT', 340, 170, { kind: 'SPDT', mode: 'on_on' }),
    component('potentiometer', 'volume', 'Volume 500k', 580, 120, { resistanceOhms: 500000 }),
    component('potentiometer', 'tone', 'Tone 500k', 580, 280, { resistanceOhms: 500000 }),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 780, 300),
    component('mono_jack', 'jack', 'Output Jack', 930, 120),
    component('ground', 'ground', 'Ground', 780, 430),
  ]
  const baseConnections = [
    wire('north-start-volume-in', 'humbucker', 'north_start', 'volume', 'in'),
    wire('north-finish-switch-common', 'humbucker', 'north_finish', 'split-switch', 'common'),
    wire('south-start-switch-series', 'humbucker', 'south_start', 'split-switch', 'throw_a'),
    wire('split-switch-ground', 'split-switch', 'throw_b', 'ground', 'ground'),
    wire('south-finish-ground', 'humbucker', 'south_finish', 'ground', 'ground'),
    wire('shield-ground', 'humbucker', 'shield', 'ground', 'ground'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    {
      id: 'hb-single-both-single',
      switchId: 'split-switch',
      label: 'Single Coil',
      position: 1,
      activeConnections: [
        wire('single-north-finish-ground', 'split-switch', 'common', 'split-switch', 'throw_b'),
      ],
    },
    {
      id: 'hb-single-both-both',
      switchId: 'split-switch',
      label: 'Both Coils',
      position: 2,
      activeConnections: [
        wire('both-series-link', 'split-switch', 'common', 'split-switch', 'throw_a'),
      ],
    },
  ]

  return {
    id: 'humbucker-split-single-both',
    name: '03 HB - Split simple/ambas',
    category: 'one_pickup',
    description: 'Humbucker con SPDT para alternar entre una bobina y ambas bobinas en serie.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function humbuckerSplitNorthBothSouth(): CircuitPreset {
  const components = [
    component('pickup', 'humbucker', 'Bridge Humbucker', 80, 170, humbucker4Params),
    component('selector', 'coil-selector', 'Norte / Ambas / Sur', 340, 180, { positions: 3 }),
    component('potentiometer', 'volume', 'Volume 500k', 580, 120, { resistanceOhms: 500000 }),
    component('potentiometer', 'tone', 'Tone 500k', 580, 280, { resistanceOhms: 500000 }),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 780, 300),
    component('mono_jack', 'jack', 'Output Jack', 930, 120),
    component('ground', 'ground', 'Ground', 780, 430),
  ]
  const baseConnections = [
    wire('north-start-selector', 'humbucker', 'north_start', 'coil-selector', 'neck'),
    wire('south-start-selector', 'humbucker', 'south_start', 'coil-selector', 'bridge'),
    wire('selector-common-volume-in', 'coil-selector', 'common', 'volume', 'in'),
    wire('south-finish-ground', 'humbucker', 'south_finish', 'ground', 'ground'),
    wire('shield-ground', 'humbucker', 'shield', 'ground', 'ground'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    {
      id: 'hb-north-both-south-north',
      switchId: 'coil-selector',
      label: 'North',
      position: 1,
      activeConnections: [
        wire('north-to-output', 'coil-selector', 'neck', 'coil-selector', 'common'),
        wire('north-finish-ground', 'humbucker', 'north_finish', 'ground', 'ground'),
      ],
    },
    {
      id: 'hb-north-both-south-both',
      switchId: 'coil-selector',
      label: 'Both',
      position: 2,
      activeConnections: [
        wire('both-north-to-output', 'coil-selector', 'neck', 'coil-selector', 'common'),
        wire('both-series-link', 'humbucker', 'north_finish', 'humbucker', 'south_start'),
      ],
    },
    {
      id: 'hb-north-both-south-south',
      switchId: 'coil-selector',
      label: 'South',
      position: 3,
      activeConnections: [
        wire('south-to-output', 'coil-selector', 'bridge', 'coil-selector', 'common'),
      ],
    },
  ]

  return {
    id: 'humbucker-split-north-both-south',
    name: '04 HB - Split N/B/S',
    category: 'one_pickup',
    description: 'Humbucker con selector de 3 posiciones para norte, ambas bobinas o sur.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function hshFivePositionStandard(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Humbucker', 80, 80, humbucker4Params),
    component('pickup', 'middle', 'Middle Single Coil', 80, 230, singlePickupParams),
    component('pickup', 'bridge', 'Bridge Humbucker', 80, 380, humbucker4Params),
    component('selector', 'selector', 'Selector 5 posiciones', 360, 230, { positions: 5 }),
    component('potentiometer', 'volume', 'Volume 500k', 600, 140, { resistanceOhms: 500000 }),
    component('potentiometer', 'tone', 'Tone 500k', 600, 300, { resistanceOhms: 500000 }),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 800, 320),
    component('mono_jack', 'jack', 'Output Jack', 960, 140),
    component('ground', 'ground', 'Ground', 800, 470),
  ]
  const baseConnections = [
    wire('neck-hot-selector', 'neck', 'north_start', 'selector', 'neck'),
    wire('middle-hot-selector', 'middle', 'hot', 'selector', 'middle'),
    wire('bridge-hot-selector', 'bridge', 'north_start', 'selector', 'bridge'),
    wire('selector-common-volume-in', 'selector', 'common', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...seriesHumbuckerGround('neck', 'neck'),
    ...groundSingleCoil('middle', 'middle'),
    ...seriesHumbuckerGround('bridge', 'bridge'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    fivePositionSelectorPosition('hsh-pos-1', 1, 'Bridge', ['bridge']),
    fivePositionSelectorPosition('hsh-pos-2', 2, 'Bridge + Middle', ['bridge', 'middle']),
    fivePositionSelectorPosition('hsh-pos-3', 3, 'Middle', ['middle']),
    fivePositionSelectorPosition('hsh-pos-4', 4, 'Middle + Neck', ['middle', 'neck']),
    fivePositionSelectorPosition('hsh-pos-5', 5, 'Neck', ['neck']),
  ]

  return {
    id: 'hsh-5-position-standard',
    name: '12 HSH - Vol/Tono',
    category: 'three_pickups',
    description: 'HSH con selector de 5 posiciones, volumen, tono, condensador, jack y tierra.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function hshFivePositionTwoVolumesTwoTones(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Humbucker', 80, 80, humbucker4Params),
    component('pickup', 'middle', 'Middle Single Coil', 80, 240, singlePickupParams),
    component('pickup', 'bridge', 'Bridge Humbucker', 80, 400, humbucker4Params),
    component('potentiometer', 'neck-volume', 'Neck Volume 500k', 330, 70, { resistanceOhms: 500000 }),
    component('potentiometer', 'bridge-volume', 'Bridge Volume 500k', 330, 360, { resistanceOhms: 500000 }),
    component('selector', 'selector', 'Selector 5 posiciones', 570, 240, { positions: 5 }),
    component('potentiometer', 'neck-tone', 'Neck Tone 500k', 760, 100, { resistanceOhms: 500000 }),
    component('potentiometer', 'bridge-tone', 'Bridge Tone 500k', 760, 380, { resistanceOhms: 500000 }),
    component('capacitor', 'neck-cap', 'Neck Tone Cap 22nF', 940, 120),
    component('capacitor', 'bridge-cap', 'Bridge Tone Cap 22nF', 940, 400),
    component('mono_jack', 'jack', 'Output Jack', 1080, 240),
    component('ground', 'ground', 'Ground', 940, 520),
  ]
  const baseConnections = [
    wire('neck-hot-volume-in', 'neck', 'north_start', 'neck-volume', 'in'),
    wire('neck-volume-selector', 'neck-volume', 'out', 'selector', 'neck'),
    wire('middle-hot-selector', 'middle', 'hot', 'selector', 'middle'),
    wire('bridge-hot-volume-in', 'bridge', 'north_start', 'bridge-volume', 'in'),
    wire('bridge-volume-selector', 'bridge-volume', 'out', 'selector', 'bridge'),
    wire('selector-common-jack-tip', 'selector', 'common', 'jack', 'tip'),
    wire('neck-volume-ground', 'neck-volume', 'ground', 'ground', 'ground'),
    wire('bridge-volume-ground', 'bridge-volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...seriesHumbuckerGround('neck', 'neck'),
    ...groundSingleCoil('middle', 'middle'),
    ...seriesHumbuckerGround('bridge', 'bridge'),
    ...toneNetwork('neck-tone', 'neck-volume', 'in', 'neck-tone', 'neck-cap'),
    ...toneNetwork('bridge-tone', 'bridge-volume', 'in', 'bridge-tone', 'bridge-cap'),
  ]
  const switchPositions = [
    fivePositionSelectorPosition('hsh-2v2t-pos-1', 1, 'Bridge', ['bridge']),
    fivePositionSelectorPosition('hsh-2v2t-pos-2', 2, 'Bridge + Middle', ['bridge', 'middle']),
    fivePositionSelectorPosition('hsh-2v2t-pos-3', 3, 'Middle', ['middle']),
    fivePositionSelectorPosition('hsh-2v2t-pos-4', 4, 'Middle + Neck', ['middle', 'neck']),
    fivePositionSelectorPosition('hsh-2v2t-pos-5', 5, 'Neck', ['neck']),
  ]

  return {
    id: 'hsh-5-position-2v2t',
    name: '13 HSH - 2 Vol/2 Tono',
    category: 'three_pickups',
    description: 'HSH con selector de 5 posiciones, volumen y tono independientes para neck y bridge.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

function hhhFivePositionVolumeTone(): CircuitPreset {
  const components = [
    component('pickup', 'neck', 'Neck Humbucker', 80, 80, humbucker4Params),
    component('pickup', 'middle', 'Middle Humbucker', 80, 230, humbucker4Params),
    component('pickup', 'bridge', 'Bridge Humbucker', 80, 380, humbucker4Params),
    component('selector', 'selector', 'Selector 5 posiciones', 360, 230, { positions: 5 }),
    component('potentiometer', 'volume', 'Volume 500k', 600, 140, { resistanceOhms: 500000 }),
    component('potentiometer', 'tone', 'Tone 500k', 600, 300, { resistanceOhms: 500000 }),
    component('capacitor', 'tone-cap', 'Tone Cap 22nF', 800, 320),
    component('mono_jack', 'jack', 'Output Jack', 960, 140),
    component('ground', 'ground', 'Ground', 800, 470),
  ]
  const baseConnections = [
    wire('neck-hot-selector', 'neck', 'north_start', 'selector', 'neck'),
    wire('middle-hot-selector', 'middle', 'north_start', 'selector', 'middle'),
    wire('bridge-hot-selector', 'bridge', 'north_start', 'selector', 'bridge'),
    wire('selector-common-volume-in', 'selector', 'common', 'volume', 'in'),
    wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
    wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
    wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
    ...seriesHumbuckerGround('neck', 'neck'),
    ...seriesHumbuckerGround('middle', 'middle'),
    ...seriesHumbuckerGround('bridge', 'bridge'),
    ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
  ]
  const switchPositions = [
    fivePositionSelectorPosition('hhh-pos-1', 1, 'Bridge', ['bridge']),
    fivePositionSelectorPosition('hhh-pos-2', 2, 'Bridge + Middle', ['bridge', 'middle']),
    fivePositionSelectorPosition('hhh-pos-3', 3, 'Middle', ['middle']),
    fivePositionSelectorPosition('hhh-pos-4', 4, 'Middle + Neck', ['middle', 'neck']),
    fivePositionSelectorPosition('hhh-pos-5', 5, 'Neck', ['neck']),
  ]

  return {
    id: 'hhh-5-position-volume-tone',
    name: '14 HHH - Vol/Tono',
    category: 'three_pickups',
    description: 'HHH con selector de 5 posiciones, volumen maestro, tono maestro y jack.',
    components,
    connections: baseConnections,
    switchPositions: localizeSwitchPositions(switchPositions),
  }
}

const presetFactories: Record<string, PresetFactory> = {
  'single-pickup-volume-jack': singlePickupVolumeJack,
  'single-pickup-volume-tone-jack': singlePickupVolumeToneJack,
  'humbucker-split-single-both': humbuckerSplitSingleBoth,
  'humbucker-split-north-both-south': humbuckerSplitNorthBothSouth,
  'humbucker-series-split-parallel': humbuckerSeriesSplitParallel,
  'ss-3-position-volume-tone': ssThreePositionVolumeTone,
  'ss-3-position-2v2t': ssThreePositionTwoVolumesTwoTones,
  'hh-3-position-volume-tone': hhThreePositionVolumeTone,
  'hh-3-position-standard': hhThreePositionStandard,
  'sss-5-position-standard': sssFivePositionStandard,
  'sss-5-position-3-pots': sssFivePositionThreePots,
  'hsh-5-position-standard': hshFivePositionStandard,
  'hsh-5-position-2v2t': hshFivePositionTwoVolumesTwoTones,
  'hhh-5-position-volume-tone': hhhFivePositionVolumeTone,
}

export const presetLibrary = Object.keys(presetFactories).map((presetId) => {
  const preset = presetFactories[presetId]()
  return {
    id: preset.id,
    name: preset.name,
    category: preset.category,
    description: preset.description,
  }
})

export function loadPreset(presetId: string): CircuitPreset {
  const factory = presetFactories[presetId]

  if (!factory) {
    throw new Error(`Unknown preset: ${presetId}`)
  }

  const preset = withStringExciter(factory())

  return {
    ...preset,
    connections: compactGroundBusConnections(preset.connections),
    switchPositions: preset.switchPositions.map((switchPosition) => ({
      ...switchPosition,
      activeConnections: compactGroundBusConnections(switchPosition.activeConnections),
    })),
  }
}

export function createPresetValidationContext(preset: CircuitPreset): ValidationContext {
  const graph = buildCircuitGraph(preset.components, preset.connections)

  return {
    components: preset.components,
    connections: preset.connections,
    graph,
    switchPositions: preset.switchPositions.map((switchPosition) => ({
      id: switchPosition.id,
      switchId: switchPosition.switchId,
      label: switchPosition.label,
      position: switchPosition.position,
      graph: buildCircuitGraph(preset.components, [
        ...preset.connections,
        ...switchPosition.activeConnections,
      ]),
    })),
  }
}

export function applyPresetToStore(
  store: CircuitPresetStoreTarget,
  presetId: string,
): CircuitPreset {
  const preset = loadPreset(presetId)

  if (store.loadCircuit) {
    store.loadCircuit(preset.components, preset.connections, preset.switchPositions)
    return preset
  }

  store.components = preset.components
  store.connections = preset.connections
  store.switchPositions = preset.switchPositions
  store.selectedComponentId = undefined

  return preset
}
