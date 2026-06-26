export type ValidationSeverity = 'info' | 'warning' | 'error'

import type {
  CircuitComponent,
  ElectricalConnection,
  PinRef,
} from '@/domain/components/circuit-component'
import type { CircuitGraph } from '@/domain/graph/circuit-graph'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  message: string
  componentId?: string
  pinRef?: PinRef
  switchPosition?: string
  code?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  global: ValidationIssue[]
  byComponent: Record<string, ValidationIssue[]>
  bySwitchPosition: Record<string, ValidationIssue[]>
}

export interface SwitchPositionValidationContext {
  id: string
  switchId: string
  label: string
  position: number
  graph: CircuitGraph
}

export interface ValidationContext {
  components: CircuitComponent[]
  connections: ElectricalConnection[]
  graph: CircuitGraph
  switchPositions?: SwitchPositionValidationContext[]
}
