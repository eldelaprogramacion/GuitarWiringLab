import type {
  CircuitComponent,
  ComponentParams,
  ComponentType,
  VisualPosition,
} from './circuit-component'
import {
  createCapacitor,
  createGround,
  createMonoJack,
  createOscilloscopeProbe,
  createPickup,
  createPotentiometer,
  createResistor,
  createSelector,
  createSignalGenerator,
  createStringExciter,
  createSwitch,
} from './component-factories'

export const potentiometerResistanceOptions = [
  { label: '250k', value: 250000 },
  { label: '500k', value: 500000 },
  { label: '1M', value: 1000000 },
] as const

export const potentiometerTaperOptions = [
  { label: 'Lineal', value: 'linear' },
  { label: 'Audio/Log', value: 'audio' },
  { label: 'Audio inverso', value: 'reverse_audio' },
] as const

export const capacitorValueOptions = [
  { label: '0.0022uF', value: 2.2e-9 },
  { label: '0.0047uF', value: 4.7e-9 },
  { label: '0.01uF', value: 10e-9 },
  { label: '0.022uF', value: 22e-9 },
  { label: '0.047uF', value: 47e-9 },
] as const

export const pickupCoilCountOptions = [
  { label: '1 bobina', value: 1 },
  { label: '2 bobinas', value: 2 },
] as const

export const pickupConductorModeOptions = [
  { label: '2 conductores', value: '2_conductor' },
  { label: '4 conductores', value: '4_conductor' },
] as const

export const switchKindOptions = [
  { label: 'SPDT', value: 'SPDT' },
  { label: 'DPDT', value: 'DPDT' },
] as const

export const switchModeOptions = [
  { label: 'on/on', value: 'on_on' },
  { label: 'on/off/on', value: 'on_off_on' },
  { label: 'on/on/on', value: 'on_on_on' },
] as const

export type ComponentCategory =
  | 'sources'
  | 'passives'
  | 'connectors'
  | 'switches'
  | 'selectors'

export interface CatalogFactoryOptions<T extends ComponentType = ComponentType> {
  id: string
  label?: string
  position?: VisualPosition
  params?: Partial<ComponentParams<T>>
}

export interface CatalogItem<T extends ComponentType = ComponentType> {
  id: string
  label: string
  description: string
  category: ComponentCategory
  type: T
  defaultParams: ComponentParams<T>
  factory: (options: CatalogFactoryOptions<T>) => CircuitComponent<T>
  icon?: string
  tags: string[]
}

interface CreateFromCatalogOptions<T extends ComponentType = ComponentType> {
  id: string
  label?: string
  position?: VisualPosition
  params?: Partial<ComponentParams<T>>
}

const potentiometer = (): CatalogItem<'potentiometer'> => ({
  id: 'potentiometer',
  label: 'Potenciometro',
  description: 'Control editable para volumen, tono o blend con resistencia y tipo seleccionables.',
  category: 'passives',
  type: 'potentiometer',
  defaultParams: {
    resistanceOhms: 250000,
    taper: 'audio',
    position: 1,
  },
  factory: createPotentiometer,
  icon: 'potentiometer',
  tags: ['potentiometer', 'control', 'volume', 'tone', 'editable'],
})

const capacitor = (): CatalogItem<'capacitor'> => ({
  id: 'capacitor',
  label: 'Condensador',
  description: 'Condensador de tono con capacitancia seleccionable.',
  category: 'passives',
  type: 'capacitor',
  defaultParams: {
    capacitanceFarads: 22e-9,
  },
  factory: createCapacitor,
  icon: 'capacitor',
  tags: ['capacitor', 'tone', 'editable'],
})

export const componentCatalog = [
  {
    id: 'pickup',
    label: 'Pastilla',
    description: 'Pastilla configurable: 1 o 2 bobinas, 2 o 4 conductores y shield opcional.',
    category: 'sources',
    type: 'pickup',
    defaultParams: {
      coilCount: 1,
      conductorMode: '2_conductor',
      hasShield: true,
      resistanceOhms: 6200,
      magnet: 'unknown',
    },
    factory: createPickup,
    icon: 'pickup',
    tags: ['pickup', 'single-coil', 'humbucker', 'passive', 'configurable'],
  },
  potentiometer(),
  capacitor(),
  {
    id: 'resistor',
    label: 'Resistencia',
    description: 'Resistencia editable para redes pasivas y cargas.',
    category: 'passives',
    type: 'resistor',
    defaultParams: {
      resistanceOhms: 100000,
      tolerancePercent: 5,
    },
    factory: createResistor,
    icon: 'resistor',
    tags: ['resistor', 'editable', 'passive'],
  },
  {
    id: 'mono_jack',
    label: 'Jack Mono',
    description: 'Conector de salida mono con punta y manga.',
    category: 'connectors',
    type: 'mono_jack',
  defaultParams: {
  },
    factory: createMonoJack,
    icon: 'jack',
    tags: ['jack', 'output', 'mono'],
  },
  {
    id: 'ground',
    label: 'Tierra',
    description: 'Bus virtual de tierra. Los pines de tierra, manga, malla y referencia se unen sin dibujar cables.',
    category: 'connectors',
    type: 'ground',
    defaultParams: {
      referenceName: 'common',
    },
    factory: createGround,
    icon: 'ground',
    tags: ['ground', 'reference'],
  },
  {
    id: 'switch',
    label: 'Switch',
    description: 'Switch configurable: SPDT/DPDT y modo on/on, on/off/on u on/on/on.',
    category: 'switches',
    type: 'switch',
    defaultParams: {
      kind: 'SPDT',
      poles: 1,
      throws: 2,
      positions: 2,
      position: 1,
      mode: 'on_on',
    },
    factory: createSwitch,
    icon: 'switch',
    tags: ['switch', 'spdt', 'dpdt', 'configurable'],
  },
  {
    id: 'selector',
    label: 'Selector',
    description: 'Selector configurable de 3 o 5 posiciones.',
    category: 'switches',
    type: 'selector',
    defaultParams: {
      positions: 5,
      position: 1,
      mode: 'blade',
    },
    factory: createSelector,
    icon: 'selector',
    tags: ['selector', '3-position', '5-position'],
  },
  {
    id: 'oscilloscope_probe',
    label: 'Sonda de osciloscopio',
    description: 'Herramienta virtual de medicion con positivo y referencia.',
    category: 'sources',
    type: 'oscilloscope_probe',
    defaultParams: {
      impedanceOhms: 1000000,
    },
    factory: createOscilloscopeProbe,
    icon: 'scope',
    tags: ['herramienta', 'sonda', 'osciloscopio'],
  },
  {
    id: 'signal_generator',
    label: 'Generador de senal',
    description: 'Fuente virtual de senal para pruebas conceptuales de respuesta.',
    category: 'sources',
    type: 'signal_generator',
    defaultParams: {
      waveform: 'sine',
      frequencyHz: 440,
      amplitudeVolts: 0.1,
    },
    factory: createSignalGenerator,
    icon: 'waveform',
    tags: ['herramienta', 'generador', 'senal', 'fuente'],
  },
  {
    id: 'string_exciter',
    label: 'Excitador de cuerdas',
    description: 'Fuente conceptual que excita todas las pastillas sin conectarse por cables.',
    category: 'sources',
    type: 'string_exciter',
    defaultParams: {
      waveform: 'sine',
      frequencyHz: 440,
      amplitudeVolts: 0.12,
      target: 'all_pickups',
    },
    factory: createStringExciter,
    icon: 'strings',
    tags: ['herramienta', 'cuerdas', 'pastillas', 'mecanico'],
  },
] satisfies CatalogItem[]

export function getCatalogByCategory(category: ComponentCategory): CatalogItem[] {
  return componentCatalog.filter((item) => item.category === category)
}

export function createComponentFromCatalogItem<T extends ComponentType>(
  item: CatalogItem<T>,
  options: CreateFromCatalogOptions<T>,
): CircuitComponent<T> {
  return item.factory({
    id: options.id,
    label: options.label ?? item.label,
    position: options.position,
    params: {
      ...item.defaultParams,
      ...options.params,
    } as Partial<ComponentParams<T>>,
  })
}
