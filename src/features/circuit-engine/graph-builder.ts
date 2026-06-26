import type { Edge, Node } from '@vue-flow/core'

import type { ElectricalConnection } from '@/domain/components/circuit-component'
import {
  buildCircuitGraph as buildElectricalCircuitGraph,
  type CircuitGraph,
} from '@/domain/graph/circuit-graph'
import type { CircuitNodeData } from './circuit-node-data'

export function buildCircuitGraph(
  nodes: Node<CircuitNodeData>[],
  edges: Edge[],
): CircuitGraph {
  const components = nodes.map((node) => node.data.component)
  const connections = edges.flatMap((edge): ElectricalConnection[] => {
    const source = nodes.find((node) => node.id === edge.source)
    const target = nodes.find((node) => node.id === edge.target)

    if (!source || !target) {
      return []
    }

    return [
      {
        id: edge.id,
        color: '#000000',
        from: {
          componentId: String(source.data.componentId),
          pinId: String(edge.sourceHandle ?? ''),
        },
        to: {
          componentId: String(target.data.componentId),
          pinId: String(edge.targetHandle ?? ''),
        },
      },
    ]
  })

  return buildElectricalCircuitGraph(components, connections)
}
