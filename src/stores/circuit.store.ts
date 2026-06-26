import { MarkerType, type Connection, type Edge, type Node } from '@vue-flow/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  CircuitComponent,
  CircuitComponentId,
  ComponentDefinitionId,
  ElectricalConnection,
} from '@/domain/components/circuit-component'
import type { PresetSwitchPosition } from '@/features/presets/presetLibrary'
import type { CatalogItem } from '@/domain/components/componentCatalog'
import { createComponentFromCatalogItem } from '@/domain/components/componentCatalog'
import {
  buildPickupPins,
  buildSelectorPins,
  buildSwitchPins,
} from '@/domain/components/component-factories'
import { buildCircuitGraph } from '@/domain/graph/circuit-graph'
import { getNextWireColor, getPinConnectionColor } from '@/domain/graph/wire-colors'
import type { CircuitNodeData } from '@/features/circuit-engine/circuit-node-data'
import { validateCircuit } from '@/features/validators/electrical-validator'
import { createId } from '@/utils/id'

export const useCircuitStore = defineStore('circuit', () => {
  const components = ref<CircuitComponent[]>([])
  const connections = ref<ElectricalConnection[]>([])
  const switchPositions = ref<PresetSwitchPosition[]>([])
  const selectedComponentId = ref<string | undefined>()
  const selectedConnectionId = ref<string | undefined>()

  const activeSwitchConnections = computed(() =>
    switchPositions.value
      .filter((switchPosition) => {
        const component = components.value.find(
          (candidate) => String(candidate.id) === switchPosition.switchId,
        )

        return (
          component &&
          'position' in component.params &&
          Number(component.params.position ?? 1) === switchPosition.position
        )
      })
      .flatMap((switchPosition) => switchPosition.activeConnections),
  )
  const activeConnections = computed(() => [
    ...connections.value,
    ...activeSwitchConnections.value,
  ])
  const graph = computed(() => buildCircuitGraph(components.value, activeConnections.value))
  const validationSwitchPositions = computed(() =>
    switchPositions.value.map((switchPosition) => ({
      id: switchPosition.id,
      switchId: switchPosition.switchId,
      label: switchPosition.label,
      position: switchPosition.position,
      graph: buildCircuitGraph(components.value, [
        ...connections.value,
        ...switchPosition.activeConnections,
      ]),
    })),
  )
  const validation = computed(() =>
    validateCircuit({
      components: components.value,
      connections: activeConnections.value,
      graph: graph.value,
      switchPositions: validationSwitchPositions.value,
    }),
  )
  const selectedComponent = computed(() =>
    components.value.find((component) => String(component.id) === selectedComponentId.value),
  )
  const selectedConnection = computed(() =>
    connections.value.find((connection) => String(connection.id) === selectedConnectionId.value),
  )
  const nodes = computed<Node<CircuitNodeData>[]>(() =>
    components.value.map((component) => ({
      id: String(component.id),
      type: 'circuit-node',
      position: component.position,
      data: {
        component,
        componentId: component.id as CircuitComponentId,
        definitionId: component.type as ComponentDefinitionId,
        label: component.label,
        family: component.category,
        pins: component.pins,
        pinConnectionColors: Object.fromEntries(
          component.pins.map((pin) => [
            String(pin.id),
            getPinConnectionColor(
              { componentId: String(component.id), pinId: String(pin.id) },
              connections.value,
            ),
          ]),
        ),
      },
    })),
  )
  const edges = computed<Edge[]>(() =>
    connections.value.map((connection) => {
      const color = connection.color || '#000000'

      return {
        id: String(connection.id),
        source: connection.from.componentId,
        sourceHandle: connection.from.pinId,
        target: connection.to.componentId,
        targetHandle: connection.to.pinId,
        type: 'default',
        updatable: true,
        selectable: true,
        deletable: true,
        interactionWidth: 18,
        ariaLabel: 'Editable guitar circuit wire',
        selected: selectedConnectionId.value === String(connection.id),
        style: {
          stroke: color,
          strokeWidth: selectedConnectionId.value === String(connection.id) ? 3.8 : 2.4,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
        },
      }
    }),
  )

  function addComponent(item: CatalogItem): void {
    const component = createComponentFromCatalogItem(item, {
      id: createId(item.id),
      position: {
        x: 120 + components.value.length * 32,
        y: 120 + components.value.length * 24,
      },
    })

    components.value.push(component)
    switchPositions.value = []
    selectedComponentId.value = String(component.id)
    selectedConnectionId.value = undefined
  }

  function removeComponent(componentId: string): void {
    components.value = components.value.filter((component) => String(component.id) !== componentId)
    connections.value = connections.value.filter(
      (connection) =>
        connection.from.componentId !== componentId && connection.to.componentId !== componentId,
    )
    switchPositions.value = switchPositions.value.map((switchPosition) => ({
      ...switchPosition,
      activeConnections: switchPosition.activeConnections.filter(
        (connection) =>
          connection.from.componentId !== componentId && connection.to.componentId !== componentId,
      ),
    }))

    if (selectedComponentId.value === componentId) {
      selectedComponentId.value = undefined
    }

    if (
      selectedConnectionId.value &&
      !connections.value.some((connection) => String(connection.id) === selectedConnectionId.value)
    ) {
      selectedConnectionId.value = undefined
    }
  }

  function updateComponentLabel(componentId: string, label: string): void {
    const component = components.value.find((candidate) => String(candidate.id) === componentId)

    if (component) {
      component.label = label
    }
  }

  function updateComponentParams(
    componentId: string,
    params: Partial<CircuitComponent['params']>,
  ): void {
    const component = components.value.find((candidate) => String(candidate.id) === componentId)

    if (component) {
      component.params = {
        ...component.params,
        ...params,
      } as CircuitComponent['params']

      if (component.type === 'pickup') {
        if (component.params.coilCount === 1) {
          component.params.conductorMode = '2_conductor'
        }

        component.pins = buildPickupPins(component.params)
        const validPinIds = new Set(component.pins.map((pin) => String(pin.id)))

        connections.value = connections.value.filter((connection) => {
          const fromIsValid =
            connection.from.componentId !== componentId || validPinIds.has(connection.from.pinId)
          const toIsValid =
            connection.to.componentId !== componentId || validPinIds.has(connection.to.pinId)

          return fromIsValid && toIsValid
        })
      }

      if (component.type === 'switch') {
        component.params.kind = component.params.kind === 'DPDT' ? 'DPDT' : 'SPDT'
        component.params.poles = component.params.kind === 'DPDT' ? 2 : 1
        component.params.throws = 2
        component.params.positions = component.params.mode === 'on_on' ? 2 : 3
        component.params.position = Math.min(
          component.params.positions,
          Math.max(1, Number(component.params.position ?? 1)),
        )
        component.pins = buildSwitchPins(component.params)
        const validPinIds = new Set(component.pins.map((pin) => String(pin.id)))

        connections.value = connections.value.filter((connection) => {
          const fromIsValid =
            connection.from.componentId !== componentId || validPinIds.has(connection.from.pinId)
          const toIsValid =
            connection.to.componentId !== componentId || validPinIds.has(connection.to.pinId)

          return fromIsValid && toIsValid
        })
      }

      if (component.type === 'selector') {
        component.params.positions = component.params.positions === 3 ? 3 : 5
        component.params.mode = component.params.positions === 3 ? 'toggle' : 'blade'
        component.params.position = Math.min(
          component.params.positions,
          Math.max(1, Number(component.params.position ?? 1)),
        )
        component.pins = buildSelectorPins(component.params)
        const validPinIds = new Set(component.pins.map((pin) => String(pin.id)))

        connections.value = connections.value.filter((connection) => {
          const fromIsValid =
            connection.from.componentId !== componentId || validPinIds.has(connection.from.pinId)
          const toIsValid =
            connection.to.componentId !== componentId || validPinIds.has(connection.to.pinId)

          return fromIsValid && toIsValid
        })
      }
    }
  }

  function updateComponentPosition(componentId: string, position: { x: number; y: number }): void {
    const component = components.value.find((candidate) => String(candidate.id) === componentId)

    if (component) {
      component.position = position
    }
  }

  function addConnection(connection: Connection | ElectricalConnection): void {
    if ('from' in connection) {
      connections.value.push({
        ...connection,
        color: connection.color || getNextWireColor(connections.value),
      })
      return
    }

    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
      return
    }

    connections.value.push({
      id: createId('wire'),
      color: getNextWireColor(connections.value),
      from: {
        componentId: connection.source,
        pinId: String(connection.sourceHandle),
      },
      to: {
        componentId: connection.target,
        pinId: String(connection.targetHandle),
      },
    })
    switchPositions.value = []
  }

  function removeConnection(connectionId: string): void {
    connections.value = connections.value.filter((connection) => String(connection.id) !== connectionId)

    if (selectedConnectionId.value === connectionId) {
      selectedConnectionId.value = undefined
    }
  }

  function selectComponent(componentId?: string): void {
    selectedComponentId.value = componentId
    selectedConnectionId.value = undefined
  }

  function selectConnection(connectionId?: string): void {
    selectedConnectionId.value = connectionId
    selectedComponentId.value = undefined
  }

  function updateConnection(connectionId: string, connection: Connection): void {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
      return
    }

    const existingConnection = connections.value.find(
      (candidate) => String(candidate.id) === connectionId,
    )

    if (!existingConnection) {
      return
    }

    connections.value = connections.value.map((candidate) =>
      String(candidate.id) === connectionId
        ? {
            ...candidate,
            from: {
              componentId: connection.source,
              pinId: String(connection.sourceHandle),
            },
            to: {
              componentId: connection.target,
              pinId: String(connection.targetHandle),
            },
            color: candidate.color || getNextWireColor(connections.value),
          }
        : candidate,
    )
    switchPositions.value = []
    selectedConnectionId.value = connectionId
  }

  function validateCurrentCircuit() {
    return validation.value
  }

  function clearWorkspace(): void {
    components.value = []
    connections.value = []
    switchPositions.value = []
    selectedComponentId.value = undefined
    selectedConnectionId.value = undefined
  }

  function syncConnectionsFromEdges(nextEdges: Edge[]): void {
    const existingConnectionsById = new Map(
      connections.value.map((connection) => [String(connection.id), connection]),
    )
    const nextConnections: ElectricalConnection[] = []

    for (const edge of nextEdges) {
      if (!edge.sourceHandle || !edge.targetHandle) {
        continue
      }

      const existingConnection = existingConnectionsById.get(edge.id)

      nextConnections.push({
        id: edge.id,
        color: existingConnection?.color ?? getNextWireColor(nextConnections),
        from: {
          componentId: edge.source,
          pinId: String(edge.sourceHandle),
        },
        to: {
          componentId: edge.target,
          pinId: String(edge.targetHandle),
        },
      })
    }

    connections.value = nextConnections
    switchPositions.value = []
  }

  function syncPositionsFromNodes(nextNodes: Node[]): void {
    for (const node of nextNodes) {
      updateComponentPosition(node.id, node.position)
    }
  }

  function loadCircuit(
    nextComponents: CircuitComponent[],
    nextConnections: ElectricalConnection[],
    nextSwitchPositions: PresetSwitchPosition[] = [],
  ): void {
    components.value = nextComponents
    connections.value = nextConnections.map((connection, index) => ({
      ...connection,
      color: connection.color || getNextWireColor(nextConnections.slice(0, index)),
    }))
    switchPositions.value = nextSwitchPositions
    selectedComponentId.value = undefined
    selectedConnectionId.value = undefined
  }

  return {
    components,
    connections,
    switchPositions,
    activeSwitchConnections,
    activeConnections,
    selectedComponentId,
    selectedConnectionId,
    selectedComponent,
    selectedConnection,
    nodes,
    edges,
    graph,
    validation,
    addComponent,
    removeComponent,
    updateComponentLabel,
    updateComponentParams,
    updateComponentPosition,
    addConnection,
    removeConnection,
    selectComponent,
    selectConnection,
    updateConnection,
    validateCurrentCircuit,
    clearWorkspace,
    syncConnectionsFromEdges,
    syncPositionsFromNodes,
    loadCircuit,
  }
})
