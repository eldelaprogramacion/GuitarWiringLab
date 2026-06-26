import type { Brand } from '@/types/brand'

export type PinId = Brand<string, 'PinId'>
export type CircuitNodeId = Brand<string, 'CircuitNodeId'>

export type PinRole =
  | 'signal'
  | 'ground'
  | 'shield'
  | 'pickup_coil_start'
  | 'pickup_coil_finish'
  | 'pot_lug'
  | 'pot_wiper'
  | 'switch_common'
  | 'switch_throw'
  | 'jack_tip'
  | 'jack_sleeve'
  | 'probe_positive'
  | 'probe_reference'

export type ElectricalType =
  | 'passive_signal'
  | 'ground_reference'
  | 'shield_drain'
  | 'resistive'
  | 'capacitive'
  | 'switch_contact'
  | 'measurement'

export type PinDirection = 'input' | 'output' | 'bidirectional' | 'reference'

export interface CircuitPin {
  id: PinId
  name: string
  role: PinRole
  electricalType: ElectricalType
  direction?: PinDirection
  nodeId?: CircuitNodeId
}

export type TerminalId = PinId
export type TerminalRole = PinRole
export type ComponentTerminal = CircuitPin
