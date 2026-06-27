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

export type PresetCategory = 'one_pickup' | 'two_pickups' | 'three_pickups'

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
    label,
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

const noSwitchPositions: PresetSwitchPosition[] = []
const singlePickupParams = { coilCount: 1, conductorMode: '2_conductor', hasShield: true }
const humbucker4Params = {
  coilCount: 2,
  conductorMode: '4_conductor',
  hasShield: true,
  resistanceOhms: 8200,
}
const volume250kParams = { resistanceOhms: 250000, taper: 'audio', position: 1 }
const volume500kParams = { resistanceOhms: 500000, taper: 'audio', position: 1 }
const tone250kParams = { resistanceOhms: 250000, taper: 'audio', position: 1 }
const tone500kParams = { resistanceOhms: 500000, taper: 'audio', position: 1 }
const toneCapParams = { capacitanceFarads: 22e-9 }
const bassCapParams = { capacitanceFarads: 2.2e-9 }

const jackAndGround = (x = 780, y = 120): CircuitComponent[] => [
  component('mono_jack', 'jack', 'Jack de salida', x, y),
  component('ground', 'ground', 'Tierra', x - 160, y + 180),
]

const jackGroundConnections = (): ElectricalConnection[] => [
  wire('jack-sleeve-ground', 'jack', 'sleeve', 'ground', 'ground'),
]

const singleGround = (prefix: string, pickupId: string): ElectricalConnection[] => [
  wire(`${prefix}-ground`, pickupId, 'ground', 'ground', 'ground'),
  wire(`${prefix}-shield-ground`, pickupId, 'shield', 'ground', 'ground'),
]

const humbuckerSeriesGround = (prefix: string, pickupId: string): ElectricalConnection[] => [
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

const threePositionSelectorPosition = (
  id: string,
  switchId: string,
  position: number,
  label: string,
  throws: Array<'neck' | 'bridge'>,
): PresetSwitchPosition => ({
  id,
  switchId,
  label,
  position,
  activeConnections: throws.map((throwId) =>
    wire(`${id}-${throwId}-common`, switchId, throwId, switchId, 'common'),
  ),
})

const fivePositionSelectorPosition = (
  id: string,
  position: number,
  label: string,
  throws: Array<'bridge' | 'middle' | 'neck'>,
): PresetSwitchPosition => ({
  id,
  switchId: 'selector',
  label,
  position,
  activeConnections: throws.map((throwId) =>
    wire(`${id}-${throwId}-common`, 'selector', throwId, 'selector', 'common'),
  ),
})

const withStringExciter = (preset: CircuitPreset): CircuitPreset => {
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

const makePreset = (
  id: string,
  name: string,
  category: PresetCategory,
  description: string,
  components: CircuitComponent[],
  connections: ElectricalConnection[],
  switchPositions: PresetSwitchPosition[] = noSwitchPositions,
): CircuitPreset => ({
  id,
  name,
  category,
  description,
  components,
  connections,
  switchPositions,
})

function sJack(): CircuitPreset {
  return makePreset(
    's-jack',
    'S - Jack',
    'one_pickup',
    'Una pastilla single coil conectada directo al jack.',
    [
      component('pickup', 'pickup', 'Single coil', 120, 140, singlePickupParams),
      ...jackAndGround(520, 140),
    ],
    [
      wire('pickup-hot-jack-tip', 'pickup', 'hot', 'jack', 'tip'),
      ...singleGround('pickup', 'pickup'),
      ...jackGroundConnections(),
    ],
  )
}

function sKillSwitchJack(): CircuitPreset {
  return makePreset(
    's-kill-switch-jack',
    'S - Kill switch - Jack',
    'one_pickup',
    'Single coil con switch de silencio antes del jack.',
    [
      component('pickup', 'pickup', 'Single coil', 80, 140, singlePickupParams),
      component('switch', 'kill-switch', 'Kill switch', 320, 150, { kind: 'SPDT', mode: 'on_on' }),
      ...jackAndGround(580, 140),
    ],
    [
      wire('pickup-hot-kill-throw-a', 'pickup', 'hot', 'kill-switch', 'throw_a'),
      wire('kill-common-jack-tip', 'kill-switch', 'common', 'jack', 'tip'),
      wire('kill-throw-b-ground', 'kill-switch', 'throw_b', 'ground', 'ground'),
      ...singleGround('pickup', 'pickup'),
      ...jackGroundConnections(),
    ],
    [
      {
        id: 'kill-on',
        switchId: 'kill-switch',
        label: 'On',
        position: 1,
        activeConnections: [
          wire('kill-on-common-throw-a', 'kill-switch', 'common', 'kill-switch', 'throw_a'),
        ],
      },
      {
        id: 'kill-off',
        switchId: 'kill-switch',
        label: 'Kill',
        position: 2,
        activeConnections: [
          wire('kill-off-common-ground', 'kill-switch', 'common', 'kill-switch', 'throw_b'),
        ],
      },
    ],
  )
}

function sPhaseSwitchJack(): CircuitPreset {
  return makePreset(
    's-phase-switch-jack',
    'S - Phase switch - Jack',
    'one_pickup',
    'Single coil con DPDT para invertir la fase hacia el jack.',
    [
      component('pickup', 'pickup', 'Single coil', 80, 150, singlePickupParams),
      component('switch', 'phase-switch', 'Phase switch DPDT', 330, 150, {
        kind: 'DPDT',
        mode: 'on_on',
      }),
      ...jackAndGround(640, 140),
    ],
    [
      wire('pickup-hot-phase-a-common', 'pickup', 'hot', 'phase-switch', 'pole_a_common'),
      wire('pickup-ground-phase-b-common', 'pickup', 'ground', 'phase-switch', 'pole_b_common'),
      wire('phase-a-throw-a-jack-tip', 'phase-switch', 'pole_a_throw_a', 'jack', 'tip'),
      wire('phase-b-throw-a-ground', 'phase-switch', 'pole_b_throw_a', 'ground', 'ground'),
      wire('phase-a-throw-b-ground', 'phase-switch', 'pole_a_throw_b', 'ground', 'ground'),
      wire('phase-b-throw-b-jack-tip', 'phase-switch', 'pole_b_throw_b', 'jack', 'tip'),
      wire('pickup-shield-ground', 'pickup', 'shield', 'ground', 'ground'),
      ...jackGroundConnections(),
    ],
    [
      {
        id: 'phase-normal',
        switchId: 'phase-switch',
        label: 'Normal',
        position: 1,
        activeConnections: [
          wire('phase-normal-a', 'phase-switch', 'pole_a_common', 'phase-switch', 'pole_a_throw_a'),
          wire('phase-normal-b', 'phase-switch', 'pole_b_common', 'phase-switch', 'pole_b_throw_a'),
        ],
      },
      {
        id: 'phase-inverted',
        switchId: 'phase-switch',
        label: 'Invertida',
        position: 2,
        activeConnections: [
          wire('phase-invert-a', 'phase-switch', 'pole_a_common', 'phase-switch', 'pole_a_throw_b'),
          wire('phase-invert-b', 'phase-switch', 'pole_b_common', 'phase-switch', 'pole_b_throw_b'),
        ],
      },
    ],
  )
}

function sVolJack(id = 's-vol-jack', name = 'S - Vol - Jack'): CircuitPreset {
  return makePreset(
    id,
    name,
    'one_pickup',
    'Single coil con volumen maestro y jack.',
    [
      component('pickup', 'pickup', 'Single coil', 80, 130, singlePickupParams),
      component('potentiometer', 'volume', 'Volumen 250k', 340, 130, volume250kParams),
      ...jackAndGround(620, 130),
    ],
    [
      wire('pickup-hot-volume-in', 'pickup', 'hot', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...singleGround('pickup', 'pickup'),
      ...jackGroundConnections(),
    ],
  )
}

function sVol50sJack(): CircuitPreset {
  return sVolJack('s-vol-50s-jack', 'S - Vol 50s - Jack')
}

function sVolTrebleBleedSeriesJack(): CircuitPreset {
  const preset = sVolJack(
    's-vol-treble-bleed-series-jack',
    'S - Vol (treble bleed serie) - Jack',
  )

  return {
    ...preset,
    description: 'Volumen con red treble bleed en serie entre entrada y salida del pot.',
    components: [
      ...preset.components,
      component('capacitor', 'bleed-cap', 'Treble bleed cap', 330, 300, {
        capacitanceFarads: 1e-9,
      }),
      component('resistor', 'bleed-resistor', 'Treble bleed resistor', 520, 300, {
        resistanceOhms: 150000,
      }),
    ],
    connections: [
      ...preset.connections,
      wire('bleed-volume-in-cap', 'volume', 'in', 'bleed-cap', 'a'),
      wire('bleed-cap-resistor', 'bleed-cap', 'b', 'bleed-resistor', 'a'),
      wire('bleed-resistor-volume-out', 'bleed-resistor', 'b', 'volume', 'out'),
    ],
  }
}

function sVolTrebleBleedParallelJack(): CircuitPreset {
  const preset = sVolJack(
    's-vol-treble-bleed-parallel-jack',
    'S - Vol (treble bleed paralelo) - Jack',
  )

  return {
    ...preset,
    description: 'Volumen con capacitor y resistencia treble bleed en paralelo.',
    components: [
      ...preset.components,
      component('capacitor', 'bleed-cap', 'Treble bleed cap', 330, 300, {
        capacitanceFarads: 1e-9,
      }),
      component('resistor', 'bleed-resistor', 'Treble bleed resistor', 520, 300, {
        resistanceOhms: 150000,
      }),
    ],
    connections: [
      ...preset.connections,
      wire('bleed-cap-a-volume-in', 'volume', 'in', 'bleed-cap', 'a'),
      wire('bleed-cap-b-volume-out', 'bleed-cap', 'b', 'volume', 'out'),
      wire('bleed-resistor-a-volume-in', 'volume', 'in', 'bleed-resistor', 'a'),
      wire('bleed-resistor-b-volume-out', 'bleed-resistor', 'b', 'volume', 'out'),
    ],
  }
}

function sVolToneJack(): CircuitPreset {
  return makePreset(
    's-vol-tone-jack',
    'S - Vol - Tono - Jack',
    'one_pickup',
    'Single coil con volumen, tono moderno y jack.',
    [
      component('pickup', 'pickup', 'Single coil', 80, 130, singlePickupParams),
      component('potentiometer', 'volume', 'Volumen 250k', 330, 100, volume250kParams),
      component('potentiometer', 'tone', 'Tono 250k', 330, 260, tone250kParams),
      component('capacitor', 'tone-cap', 'Condensador tono 22nF', 530, 280, toneCapParams),
      ...jackAndGround(720, 120),
    ],
    [
      wire('pickup-hot-volume-in', 'pickup', 'hot', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
      ...singleGround('pickup', 'pickup'),
      ...jackGroundConnections(),
    ],
  )
}

function sVolTone50sJack(): CircuitPreset {
  const preset = sVolToneJack()

  return {
    ...preset,
    id: 's-vol-tone-50s-jack',
    name: 'S - Vol - Tono 50s - Jack',
    description: 'Single coil con tono conectado a la salida del volumen al estilo 50s.',
    connections: [
      ...preset.connections.filter((connection) => !connection.id.startsWith('tone-')),
      ...toneNetwork('tone', 'volume', 'out', 'tone', 'tone-cap'),
    ],
  }
}

function hSplitSingleBothJack(): CircuitPreset {
  return makePreset(
    'h-split-s-b-jack',
    'H - Split S/B - Jack',
    'one_pickup',
    'Humbucker con SPDT para seleccionar single o ambas bobinas.',
    [
      component('pickup', 'humbucker', 'Humbucker', 80, 150, humbucker4Params),
      component('switch', 'split-switch', 'Split S/B', 340, 160, { kind: 'SPDT', mode: 'on_on' }),
      ...jackAndGround(610, 140),
    ],
    [
      wire('north-start-jack-tip', 'humbucker', 'north_start', 'jack', 'tip'),
      wire('north-finish-switch-common', 'humbucker', 'north_finish', 'split-switch', 'common'),
      wire('south-start-switch-throw-a', 'humbucker', 'south_start', 'split-switch', 'throw_a'),
      wire('split-throw-b-ground', 'split-switch', 'throw_b', 'ground', 'ground'),
      wire('south-finish-ground', 'humbucker', 'south_finish', 'ground', 'ground'),
      wire('shield-ground', 'humbucker', 'shield', 'ground', 'ground'),
      ...jackGroundConnections(),
    ],
    [
      {
        id: 'h-split-single',
        switchId: 'split-switch',
        label: 'S',
        position: 1,
        activeConnections: [
          wire('split-single-common-ground', 'split-switch', 'common', 'split-switch', 'throw_b'),
        ],
      },
      {
        id: 'h-split-both',
        switchId: 'split-switch',
        label: 'B',
        position: 2,
        activeConnections: [
          wire('split-both-series-link', 'split-switch', 'common', 'split-switch', 'throw_a'),
        ],
      },
    ],
  )
}

function hSplitNorthBothSouthJack(): CircuitPreset {
  return makePreset(
    'h-split-n-b-s-jack',
    'H - Split N/B/S - Jack',
    'one_pickup',
    'Humbucker con selector para bobina norte, ambas o bobina sur.',
    [
      component('pickup', 'humbucker', 'Humbucker', 80, 160, humbucker4Params),
      component('selector', 'coil-selector', 'Selector N/B/S', 340, 160, { kind: 'toggle_3' }),
      ...jackAndGround(620, 140),
    ],
    [
      wire('north-start-selector', 'humbucker', 'north_start', 'coil-selector', 'neck'),
      wire('south-start-selector', 'humbucker', 'south_start', 'coil-selector', 'bridge'),
      wire('selector-common-jack-tip', 'coil-selector', 'common', 'jack', 'tip'),
      wire('south-finish-ground', 'humbucker', 'south_finish', 'ground', 'ground'),
      wire('shield-ground', 'humbucker', 'shield', 'ground', 'ground'),
      ...jackGroundConnections(),
    ],
    [
      {
        id: 'h-north',
        switchId: 'coil-selector',
        label: 'N',
        position: 1,
        activeConnections: [
          wire('north-to-output', 'coil-selector', 'neck', 'coil-selector', 'common'),
          wire('north-finish-ground', 'humbucker', 'north_finish', 'ground', 'ground'),
        ],
      },
      {
        id: 'h-both',
        switchId: 'coil-selector',
        label: 'B',
        position: 2,
        activeConnections: [
          wire('both-north-to-output', 'coil-selector', 'neck', 'coil-selector', 'common'),
          wire('both-series-link', 'humbucker', 'north_finish', 'humbucker', 'south_start'),
        ],
      },
      {
        id: 'h-south',
        switchId: 'coil-selector',
        label: 'S',
        position: 3,
        activeConnections: [
          wire('south-to-output', 'coil-selector', 'bridge', 'coil-selector', 'common'),
        ],
      },
    ],
  )
}

function hSeriesParallelJack(): CircuitPreset {
  return makePreset(
    'h-series-parallel-jack',
    'H - serie/paralelo - Jack',
    'one_pickup',
    'Humbucker de 4 conductores con DPDT para serie o paralelo.',
    [
      component('pickup', 'humbucker', 'Humbucker', 80, 160, humbucker4Params),
      component('switch', 'mode-switch', 'Serie/paralelo DPDT', 340, 160, {
        kind: 'DPDT',
        mode: 'on_on',
      }),
      ...jackAndGround(640, 140),
    ],
    [
      wire('north-start-switch-a-common', 'humbucker', 'north_start', 'mode-switch', 'pole_a_common'),
      wire('south-start-switch-b-common', 'humbucker', 'south_start', 'mode-switch', 'pole_b_common'),
      wire('north-finish-switch-a-throw-b', 'humbucker', 'north_finish', 'mode-switch', 'pole_a_throw_b'),
      wire('south-finish-switch-b-throw-b', 'humbucker', 'south_finish', 'mode-switch', 'pole_b_throw_b'),
      wire('switch-a-throw-a-jack-tip', 'mode-switch', 'pole_a_throw_a', 'jack', 'tip'),
      wire('switch-b-throw-a-jack-tip', 'mode-switch', 'pole_b_throw_a', 'jack', 'tip'),
      wire('shield-ground', 'humbucker', 'shield', 'ground', 'ground'),
      ...jackGroundConnections(),
    ],
    [
      {
        id: 'h-series',
        switchId: 'mode-switch',
        label: 'Serie',
        position: 1,
        activeConnections: [
          wire('series-north-output', 'mode-switch', 'pole_a_common', 'mode-switch', 'pole_a_throw_a'),
          wire('series-link', 'mode-switch', 'pole_a_throw_b', 'mode-switch', 'pole_b_common'),
          wire('series-south-ground', 'mode-switch', 'pole_b_throw_b', 'ground', 'ground'),
        ],
      },
      {
        id: 'h-parallel',
        switchId: 'mode-switch',
        label: 'Paralelo',
        position: 2,
        activeConnections: [
          wire('parallel-north-output', 'mode-switch', 'pole_a_common', 'mode-switch', 'pole_a_throw_a'),
          wire('parallel-south-output', 'mode-switch', 'pole_b_common', 'mode-switch', 'pole_b_throw_a'),
          wire('parallel-north-ground', 'mode-switch', 'pole_a_throw_b', 'ground', 'ground'),
          wire('parallel-south-ground', 'mode-switch', 'pole_b_throw_b', 'ground', 'ground'),
        ],
      },
    ],
  )
}

function ssSelectorVolToneJack(): CircuitPreset {
  return makePreset(
    'ss-selector-vol-tone-jack',
    'SS - Selector - Vol - Tono - Jack',
    'two_pickups',
    'Dos single coil con selector, volumen maestro, tono maestro y jack.',
    [
      component('pickup', 'neck', 'Mastil single coil', 80, 120, singlePickupParams),
      component('pickup', 'bridge', 'Puente single coil', 80, 320, singlePickupParams),
      component('selector', 'toggle', 'Selector 3 posiciones', 330, 220, { kind: 'toggle_3' }),
      component('potentiometer', 'volume', 'Volumen 250k', 560, 140, volume250kParams),
      component('potentiometer', 'tone', 'Tono 250k', 560, 300, tone250kParams),
      component('capacitor', 'tone-cap', 'Condensador tono 22nF', 760, 320, toneCapParams),
      ...jackAndGround(940, 140),
    ],
    [
      wire('neck-hot-toggle', 'neck', 'hot', 'toggle', 'neck'),
      wire('bridge-hot-toggle', 'bridge', 'hot', 'toggle', 'bridge'),
      wire('toggle-common-volume-in', 'toggle', 'common', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
      ...singleGround('neck', 'neck'),
      ...singleGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
    [
      threePositionSelectorPosition('ss-neck', 'toggle', 1, 'Mastil', ['neck']),
      threePositionSelectorPosition('ss-both', 'toggle', 2, 'Mastil + Puente', ['neck', 'bridge']),
      threePositionSelectorPosition('ss-bridge', 'toggle', 3, 'Puente', ['bridge']),
    ],
  )
}

function ssTwoVolTwoToneSelectorJack(): CircuitPreset {
  return makePreset(
    'ss-2vol-2tone-selector-jack',
    'SS - 2 Vol(indeps) - 2 Tono(indeps) - Selector - Jack',
    'two_pickups',
    'Dos single coil con volumen y tono independientes antes del selector.',
    [
      component('pickup', 'neck', 'Mastil single coil', 80, 100, singlePickupParams),
      component('pickup', 'bridge', 'Puente single coil', 80, 340, singlePickupParams),
      component('potentiometer', 'neck-volume', 'Volumen mastil 250k', 320, 80, volume250kParams),
      component('potentiometer', 'bridge-volume', 'Volumen puente 250k', 320, 320, volume250kParams),
      component('potentiometer', 'neck-tone', 'Tono mastil 250k', 540, 120, tone250kParams),
      component('potentiometer', 'bridge-tone', 'Tono puente 250k', 540, 360, tone250kParams),
      component('capacitor', 'neck-cap', 'Condensador mastil 22nF', 740, 140, toneCapParams),
      component('capacitor', 'bridge-cap', 'Condensador puente 22nF', 740, 380, toneCapParams),
      component('selector', 'toggle', 'Selector 3 posiciones', 820, 250, { kind: 'toggle_3' }),
      ...jackAndGround(1060, 250),
    ],
    [
      wire('neck-hot-neck-volume-in', 'neck', 'hot', 'neck-volume', 'in'),
      wire('bridge-hot-bridge-volume-in', 'bridge', 'hot', 'bridge-volume', 'in'),
      wire('neck-volume-toggle', 'neck-volume', 'out', 'toggle', 'neck'),
      wire('bridge-volume-toggle', 'bridge-volume', 'out', 'toggle', 'bridge'),
      wire('toggle-common-jack-tip', 'toggle', 'common', 'jack', 'tip'),
      wire('neck-volume-ground', 'neck-volume', 'ground', 'ground', 'ground'),
      wire('bridge-volume-ground', 'bridge-volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('neck-tone', 'neck-volume', 'in', 'neck-tone', 'neck-cap'),
      ...toneNetwork('bridge-tone', 'bridge-volume', 'in', 'bridge-tone', 'bridge-cap'),
      ...singleGround('neck', 'neck'),
      ...singleGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
    [
      threePositionSelectorPosition('ss-2v2t-neck', 'toggle', 1, 'Mastil', ['neck']),
      threePositionSelectorPosition('ss-2v2t-both', 'toggle', 2, 'Mastil + Puente', [
        'neck',
        'bridge',
      ]),
      threePositionSelectorPosition('ss-2v2t-bridge', 'toggle', 3, 'Puente', ['bridge']),
    ],
  )
}

function hhSelectorVolToneJack(): CircuitPreset {
  return makePreset(
    'hh-selector-vol-tone-jack',
    'HH - Selector - Vol - Tono - Jack',
    'two_pickups',
    'Dos humbuckers en serie interna con selector, volumen maestro y tono maestro.',
    [
      component('pickup', 'neck', 'Mastil humbucker', 80, 120, humbucker4Params),
      component('pickup', 'bridge', 'Puente humbucker', 80, 320, humbucker4Params),
      component('selector', 'toggle', 'Selector 3 posiciones', 330, 220, { kind: 'toggle_3' }),
      component('potentiometer', 'volume', 'Volumen 500k', 560, 140, volume500kParams),
      component('potentiometer', 'tone', 'Tono 500k', 560, 300, tone500kParams),
      component('capacitor', 'tone-cap', 'Condensador tono 22nF', 760, 320, toneCapParams),
      ...jackAndGround(940, 140),
    ],
    [
      wire('neck-hot-toggle', 'neck', 'north_start', 'toggle', 'neck'),
      wire('bridge-hot-toggle', 'bridge', 'north_start', 'toggle', 'bridge'),
      wire('toggle-common-volume-in', 'toggle', 'common', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
      ...humbuckerSeriesGround('neck', 'neck'),
      ...humbuckerSeriesGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
    [
      threePositionSelectorPosition('hh-neck', 'toggle', 1, 'Mastil', ['neck']),
      threePositionSelectorPosition('hh-both', 'toggle', 2, 'Mastil + Puente', ['neck', 'bridge']),
      threePositionSelectorPosition('hh-bridge', 'toggle', 3, 'Puente', ['bridge']),
    ],
  )
}

function hhTwoVolTwoToneSelectorJack(): CircuitPreset {
  return makePreset(
    'hh-2vol-2tone-selector-jack',
    'HH - 2 Vol(indeps) - 2 Tono (indeps) - Selector - Jack',
    'two_pickups',
    'Dos humbuckers con volumen y tono independientes antes del selector.',
    [
      component('pickup', 'neck', 'Mastil humbucker', 80, 100, humbucker4Params),
      component('pickup', 'bridge', 'Puente humbucker', 80, 340, humbucker4Params),
      component('potentiometer', 'neck-volume', 'Volumen mastil 500k', 320, 80, volume500kParams),
      component('potentiometer', 'bridge-volume', 'Volumen puente 500k', 320, 320, volume500kParams),
      component('potentiometer', 'neck-tone', 'Tono mastil 500k', 540, 120, tone500kParams),
      component('potentiometer', 'bridge-tone', 'Tono puente 500k', 540, 360, tone500kParams),
      component('capacitor', 'neck-cap', 'Condensador mastil 22nF', 740, 140, toneCapParams),
      component('capacitor', 'bridge-cap', 'Condensador puente 22nF', 740, 380, toneCapParams),
      component('selector', 'toggle', 'Selector 3 posiciones', 820, 250, { kind: 'toggle_3' }),
      ...jackAndGround(1060, 250),
    ],
    [
      wire('neck-hot-neck-volume-in', 'neck', 'north_start', 'neck-volume', 'in'),
      wire('bridge-hot-bridge-volume-in', 'bridge', 'north_start', 'bridge-volume', 'in'),
      wire('neck-volume-toggle', 'neck-volume', 'out', 'toggle', 'neck'),
      wire('bridge-volume-toggle', 'bridge-volume', 'out', 'toggle', 'bridge'),
      wire('toggle-common-jack-tip', 'toggle', 'common', 'jack', 'tip'),
      wire('neck-volume-ground', 'neck-volume', 'ground', 'ground', 'ground'),
      wire('bridge-volume-ground', 'bridge-volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('neck-tone', 'neck-volume', 'in', 'neck-tone', 'neck-cap'),
      ...toneNetwork('bridge-tone', 'bridge-volume', 'in', 'bridge-tone', 'bridge-cap'),
      ...humbuckerSeriesGround('neck', 'neck'),
      ...humbuckerSeriesGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
    [
      threePositionSelectorPosition('hh-2v2t-neck', 'toggle', 1, 'Mastil', ['neck']),
      threePositionSelectorPosition('hh-2v2t-both', 'toggle', 2, 'Mastil + Puente', [
        'neck',
        'bridge',
      ]),
      threePositionSelectorPosition('hh-2v2t-bridge', 'toggle', 3, 'Puente', ['bridge']),
    ],
  )
}

function sssSelectorVolToneJack(): CircuitPreset {
  return makePreset(
    'sss-selector-vol-tone-jack',
    'SSS - Selector - Vol - Tono - Jack',
    'three_pickups',
    'Tres single coil con selector de 5 posiciones, volumen y tono maestro.',
    [
      component('pickup', 'neck', 'Mastil single coil', 80, 80, singlePickupParams),
      component('pickup', 'middle', 'Medio single coil', 80, 230, singlePickupParams),
      component('pickup', 'bridge', 'Puente single coil', 80, 380, singlePickupParams),
      component('selector', 'selector', 'Selector 5 posiciones', 350, 230, { kind: 'blade_5' }),
      component('potentiometer', 'volume', 'Volumen 250k', 580, 140, volume250kParams),
      component('potentiometer', 'tone', 'Tono 250k', 580, 300, tone250kParams),
      component('capacitor', 'tone-cap', 'Condensador tono 22nF', 780, 320, toneCapParams),
      ...jackAndGround(960, 140),
    ],
    [
      wire('neck-hot-selector', 'neck', 'hot', 'selector', 'neck'),
      wire('middle-hot-selector', 'middle', 'hot', 'selector', 'middle'),
      wire('bridge-hot-selector', 'bridge', 'hot', 'selector', 'bridge'),
      wire('selector-common-volume-in', 'selector', 'common', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('tone', 'volume', 'in', 'tone', 'tone-cap'),
      ...singleGround('neck', 'neck'),
      ...singleGround('middle', 'middle'),
      ...singleGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
    [
      fivePositionSelectorPosition('sss-bridge', 1, 'Puente', ['bridge']),
      fivePositionSelectorPosition('sss-bridge-middle', 2, 'Puente + Medio', ['bridge', 'middle']),
      fivePositionSelectorPosition('sss-middle', 3, 'Medio', ['middle']),
      fivePositionSelectorPosition('sss-middle-neck', 4, 'Medio + Mastil', ['middle', 'neck']),
      fivePositionSelectorPosition('sss-neck', 5, 'Mastil', ['neck']),
    ],
  )
}

function sssTwoToneSelectorVolJack(): CircuitPreset {
  const preset = sssSelectorVolToneJack()

  return {
    ...preset,
    id: 'sss-2tone-selector-vol-jack',
    name: 'SSS - 2 Tono (indeps) - Selector - vol - Jack',
    description: 'Tres single coil con dos tonos independientes y volumen maestro despues del selector.',
    components: [
      component('pickup', 'neck', 'Mastil single coil', 80, 80, singlePickupParams),
      component('pickup', 'middle', 'Medio single coil', 80, 230, singlePickupParams),
      component('pickup', 'bridge', 'Puente single coil', 80, 380, singlePickupParams),
      component('selector', 'selector', 'Selector 5 posiciones', 350, 230, { kind: 'blade_5' }),
      component('potentiometer', 'volume', 'Volumen 250k', 580, 140, volume250kParams),
      component('potentiometer', 'neck-tone', 'Tono mastil 250k', 580, 300, tone250kParams),
      component('potentiometer', 'middle-tone', 'Tono medio 250k', 580, 440, tone250kParams),
      component('capacitor', 'neck-cap', 'Condensador mastil 22nF', 780, 320, toneCapParams),
      component('capacitor', 'middle-cap', 'Condensador medio 22nF', 780, 460, toneCapParams),
      ...jackAndGround(960, 140),
    ],
    connections: [
      wire('neck-hot-selector', 'neck', 'hot', 'selector', 'neck'),
      wire('middle-hot-selector', 'middle', 'hot', 'selector', 'middle'),
      wire('bridge-hot-selector', 'bridge', 'hot', 'selector', 'bridge'),
      wire('selector-common-volume-in', 'selector', 'common', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('neck-tone', 'selector', 'neck', 'neck-tone', 'neck-cap'),
      ...toneNetwork('middle-tone', 'selector', 'middle', 'middle-tone', 'middle-cap'),
      ...singleGround('neck', 'neck'),
      ...singleGround('middle', 'middle'),
      ...singleGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
  }
}

function sssTwoVolTwoToneSelectorJack(): CircuitPreset {
  return makePreset(
    'sss-2vol-2tone-selector-jack',
    'SSS - 2 Vol(indeps) - 2 Tono (indeps) - Selector - Jack',
    'three_pickups',
    'Tres single coil con volumen y tono independientes para mastil y puente.',
    [
      component('pickup', 'neck', 'Mastil single coil', 80, 80, singlePickupParams),
      component('pickup', 'middle', 'Medio single coil', 80, 240, singlePickupParams),
      component('pickup', 'bridge', 'Puente single coil', 80, 400, singlePickupParams),
      component('potentiometer', 'neck-volume', 'Volumen mastil 250k', 320, 70, volume250kParams),
      component('potentiometer', 'bridge-volume', 'Volumen puente 250k', 320, 380, volume250kParams),
      component('selector', 'selector', 'Selector 5 posiciones', 560, 240, { kind: 'blade_5' }),
      component('potentiometer', 'neck-tone', 'Tono mastil 250k', 760, 100, tone250kParams),
      component('potentiometer', 'bridge-tone', 'Tono puente 250k', 760, 400, tone250kParams),
      component('capacitor', 'neck-cap', 'Condensador mastil 22nF', 950, 120, toneCapParams),
      component('capacitor', 'bridge-cap', 'Condensador puente 22nF', 950, 420, toneCapParams),
      ...jackAndGround(1100, 250),
    ],
    [
      wire('neck-hot-neck-volume-in', 'neck', 'hot', 'neck-volume', 'in'),
      wire('neck-volume-selector', 'neck-volume', 'out', 'selector', 'neck'),
      wire('middle-hot-selector', 'middle', 'hot', 'selector', 'middle'),
      wire('bridge-hot-bridge-volume-in', 'bridge', 'hot', 'bridge-volume', 'in'),
      wire('bridge-volume-selector', 'bridge-volume', 'out', 'selector', 'bridge'),
      wire('selector-common-jack-tip', 'selector', 'common', 'jack', 'tip'),
      wire('neck-volume-ground', 'neck-volume', 'ground', 'ground', 'ground'),
      wire('bridge-volume-ground', 'bridge-volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('neck-tone', 'neck-volume', 'in', 'neck-tone', 'neck-cap'),
      ...toneNetwork('bridge-tone', 'bridge-volume', 'in', 'bridge-tone', 'bridge-cap'),
      ...singleGround('neck', 'neck'),
      ...singleGround('middle', 'middle'),
      ...singleGround('bridge', 'bridge'),
      ...jackGroundConnections(),
    ],
    [
      fivePositionSelectorPosition('sss-2v2t-bridge', 1, 'Puente', ['bridge']),
      fivePositionSelectorPosition('sss-2v2t-bridge-middle', 2, 'Puente + Medio', [
        'bridge',
        'middle',
      ]),
      fivePositionSelectorPosition('sss-2v2t-middle', 3, 'Medio', ['middle']),
      fivePositionSelectorPosition('sss-2v2t-middle-neck', 4, 'Medio + Mastil', [
        'middle',
        'neck',
      ]),
      fivePositionSelectorPosition('sss-2v2t-neck', 5, 'Mastil', ['neck']),
    ],
  )
}

function ptbTrebleCutBassCut(): CircuitPreset {
  return makePreset(
    'ptb-treble-cut-bass-cut',
    'PTB: treble cut + bass cut',
    'one_pickup',
    'Circuito PTB conceptual con corte de agudos y corte de graves pasivos.',
    [
      component('pickup', 'pickup', 'Single coil', 80, 160, singlePickupParams),
      component('capacitor', 'bass-cap', 'Bass cut cap', 280, 140, bassCapParams),
      component('potentiometer', 'bass-cut', 'Bass cut 1M', 460, 140, {
        resistanceOhms: 1000000,
        taper: 'audio',
        position: 1,
      }),
      component('potentiometer', 'volume', 'Volumen 250k', 650, 140, volume250kParams),
      component('potentiometer', 'treble-cut', 'Treble cut 250k', 650, 320, tone250kParams),
      component('capacitor', 'treble-cap', 'Treble cap 22nF', 850, 340, toneCapParams),
      ...jackAndGround(1040, 140),
    ],
    [
      wire('pickup-hot-bass-cap-a', 'pickup', 'hot', 'bass-cap', 'a'),
      wire('bass-cap-b-bass-cut-in', 'bass-cap', 'b', 'bass-cut', 'in'),
      wire('bass-cut-out-volume-in', 'bass-cut', 'out', 'volume', 'in'),
      wire('volume-out-jack-tip', 'volume', 'out', 'jack', 'tip'),
      wire('bass-cut-ground', 'bass-cut', 'ground', 'ground', 'ground'),
      wire('volume-ground', 'volume', 'ground', 'ground', 'ground'),
      ...toneNetwork('treble-cut', 'volume', 'in', 'treble-cut', 'treble-cap'),
      ...singleGround('pickup', 'pickup'),
      ...jackGroundConnections(),
    ],
  )
}

const presetOrder = [
  's-jack',
  's-kill-switch-jack',
  's-phase-switch-jack',
  's-vol-jack',
  's-vol-50s-jack',
  's-vol-treble-bleed-series-jack',
  's-vol-treble-bleed-parallel-jack',
  's-vol-tone-jack',
  's-vol-tone-50s-jack',
  'h-split-s-b-jack',
  'h-split-n-b-s-jack',
  'h-series-parallel-jack',
  'ss-selector-vol-tone-jack',
  'ss-2vol-2tone-selector-jack',
  'hh-selector-vol-tone-jack',
  'hh-2vol-2tone-selector-jack',
  'sss-selector-vol-tone-jack',
  'sss-2tone-selector-vol-jack',
  'sss-2vol-2tone-selector-jack',
  'ptb-treble-cut-bass-cut',
] as const

const presetFactories: Record<(typeof presetOrder)[number], PresetFactory> = {
  's-jack': sJack,
  's-kill-switch-jack': sKillSwitchJack,
  's-phase-switch-jack': sPhaseSwitchJack,
  's-vol-jack': () => sVolJack(),
  's-vol-50s-jack': sVol50sJack,
  's-vol-treble-bleed-series-jack': sVolTrebleBleedSeriesJack,
  's-vol-treble-bleed-parallel-jack': sVolTrebleBleedParallelJack,
  's-vol-tone-jack': sVolToneJack,
  's-vol-tone-50s-jack': sVolTone50sJack,
  'h-split-s-b-jack': hSplitSingleBothJack,
  'h-split-n-b-s-jack': hSplitNorthBothSouthJack,
  'h-series-parallel-jack': hSeriesParallelJack,
  'ss-selector-vol-tone-jack': ssSelectorVolToneJack,
  'ss-2vol-2tone-selector-jack': ssTwoVolTwoToneSelectorJack,
  'hh-selector-vol-tone-jack': hhSelectorVolToneJack,
  'hh-2vol-2tone-selector-jack': hhTwoVolTwoToneSelectorJack,
  'sss-selector-vol-tone-jack': sssSelectorVolToneJack,
  'sss-2tone-selector-vol-jack': sssTwoToneSelectorVolJack,
  'sss-2vol-2tone-selector-jack': sssTwoVolTwoToneSelectorJack,
  'ptb-treble-cut-bass-cut': ptbTrebleCutBassCut,
}

export const presetLibrary = presetOrder.map((presetId) => {
  const preset = presetFactories[presetId]()

  return {
    id: preset.id,
    name: preset.name,
    category: preset.category,
    description: preset.description,
  }
})

export function loadPreset(presetId: string): CircuitPreset {
  const factory = presetFactories[presetId as (typeof presetOrder)[number]]

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
