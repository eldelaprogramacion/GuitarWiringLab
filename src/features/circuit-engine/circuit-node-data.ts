import type {
  CircuitComponent,
  CircuitComponentId,
  ComponentDefinition,
  ComponentDefinitionId,
} from '@/domain/components/circuit-component'
import type { CircuitPin } from '@/domain/components/component-terminal'

export interface CircuitNodeData {
  component: CircuitComponent
  componentId: CircuitComponentId
  definitionId: ComponentDefinitionId
  label: string
  family: ComponentDefinition['family']
  pins: CircuitPin[]
  pinConnectionColors: Record<string, string | null>
}
