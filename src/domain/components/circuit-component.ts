import type { Brand } from '@/types/brand'
import type { CircuitPin, PinId } from './component-terminal'

export type ComponentDefinitionId = Brand<string, 'ComponentDefinitionId'>
export type CircuitComponentId = Brand<string, 'CircuitComponentId'>
export type ElectricalConnectionId = Brand<string, 'ElectricalConnectionId'>

export type ComponentType =
  | 'pickup'
  | 'potentiometer'
  | 'capacitor'
  | 'resistor'
  | 'mono_jack'
  | 'ground'
  | 'switch'
  | 'selector'
  | 'oscilloscope_probe'
  | 'signal_generator'
  | 'string_exciter'

export type ComponentCategory =
  | 'pickup'
  | 'potentiometer'
  | 'capacitor'
  | 'resistor'
  | 'jack'
  | 'ground'
  | 'switch'
  | 'instrument'

export type ComponentFamily = ComponentCategory

export interface VisualPosition {
  x: number
  y: number
}

export interface ComponentMetadata {
  description?: string
  manufacturer?: string
  model?: string
  tags?: string[]
}

export interface PickupParams {
  coilCount: 1 | 2
  conductorMode: '2_conductor' | '4_conductor'
  hasShield: boolean
  resistanceOhms?: number
  northResistanceOhms?: number
  southResistanceOhms?: number
  magnet?: 'alnico_2' | 'alnico_3' | 'alnico_5' | 'ceramic' | 'unknown'
}

export interface PotentiometerParams {
  resistanceOhms: number
  taper: 'audio' | 'linear' | 'reverse_audio'
  position?: number
}

export interface CapacitorParams {
  capacitanceFarads: number
  voltageRating?: number
}

export interface ResistorParams {
  resistanceOhms: number
  tolerancePercent?: number
}

export type MonoJackParams = Record<string, never>

export interface GroundParams {
  referenceName?: string
}

export interface SwitchParams {
  kind?: 'SPDT' | 'DPDT'
  poles: 1 | 2
  throws: number
  positions: number
  position?: number
  mode?: 'on_on' | 'on_off_on' | 'on_on_on'
}

export interface SelectorParams {
  positions: 3 | 5
  position?: number
  mode?: 'blade' | 'toggle'
}

export interface OscilloscopeProbeParams {
  impedanceOhms?: number
}

export type SignalWaveform =
  | 'sine'
  | 'square'
  | 'triangle'
  | 'multi_frequency'
  | 'white_noise'
  | 'pink_noise'

export interface SignalGeneratorParams {
  waveform: SignalWaveform
  frequencyHz: number
  amplitudeVolts: number
  durationMs?: number
}

export interface StringExciterParams {
  waveform: SignalWaveform
  frequencyHz: number
  amplitudeVolts: number
  durationMs?: number
  target: 'all_pickups'
}

export interface ComponentParamsMap {
  pickup: PickupParams
  potentiometer: PotentiometerParams
  capacitor: CapacitorParams
  resistor: ResistorParams
  mono_jack: MonoJackParams
  ground: GroundParams
  switch: SwitchParams
  selector: SelectorParams
  oscilloscope_probe: OscilloscopeProbeParams
  signal_generator: SignalGeneratorParams
  string_exciter: StringExciterParams
}

export type ComponentParams<T extends ComponentType = ComponentType> = ComponentParamsMap[T]

export interface CircuitComponent<T extends ComponentType = ComponentType> {
  id: CircuitComponentId
  type: T
  label: string
  category: ComponentCategory
  pins: CircuitPin[]
  params: ComponentParams<T>
  position: VisualPosition
  metadata?: ComponentMetadata
}

export interface ComponentDefinition<T extends ComponentType = ComponentType> {
  id: ComponentDefinitionId
  type: T
  name: string
  category: ComponentCategory
  family: ComponentCategory
  description: string
  pins: CircuitPin[]
  defaultParams: ComponentParams<T>
  metadata?: ComponentMetadata
}

export interface PinRef {
  componentId: string
  pinId: string
}

export type CircuitEndpoint = PinRef

export interface ElectricalConnection {
  id: ElectricalConnectionId | string
  from: PinRef
  to: PinRef
  color: string
  label?: string
  metadata?: ComponentMetadata
}
