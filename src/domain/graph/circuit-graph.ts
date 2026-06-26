import type {
  CircuitComponent,
  ElectricalConnection,
  PinRef,
} from '@/domain/components/circuit-component'

export type ElectricalNodeId = string

export interface ElectricalNode {
  id: ElectricalNodeId
  pins: PinRef[]
}

export interface ConnectedPinGroup {
  electricalNodeId: ElectricalNodeId
  pins: PinRef[]
}

export interface CircuitGraphDebugInfo {
  componentCount: number
  pinCount: number
  connectionCount: number
  electricalNodeCount: number
  electricalNodes: Array<{
    id: ElectricalNodeId
    pins: string[]
  }>
  floatingPins: string[]
}

export interface CircuitGraph {
  components: CircuitComponent[]
  connections: ElectricalConnection[]
  electricalNodes: ElectricalNode[]
  connectedPinGroups: ConnectedPinGroup[]
  findConnectedPins: (pinRef: PinRef) => PinRef[]
  arePinsConnected: (pinA: PinRef, pinB: PinRef) => boolean
  getElectricalNodeOfPin: (pinRef: PinRef) => ElectricalNode | undefined
  getFloatingPins: () => PinRef[]
  getConnectedComponents: (componentId: string) => CircuitComponent[]
  hasPathBetweenPins: (pinA: PinRef, pinB: PinRef) => boolean
  debugGraph: () => CircuitGraphDebugInfo
}

class DisjointSet {
  private readonly parent = new Map<string, string>()
  private readonly rank = new Map<string, number>()

  makeSet(value: string): void {
    if (this.parent.has(value)) {
      return
    }

    this.parent.set(value, value)
    this.rank.set(value, 0)
  }

  find(value: string): string {
    const parent = this.parent.get(value)

    if (!parent) {
      throw new Error(`Unknown disjoint-set value: ${value}`)
    }

    if (parent !== value) {
      const root = this.find(parent)
      this.parent.set(value, root)
      return root
    }

    return parent
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)

    if (leftRoot === rightRoot) {
      return
    }

    const leftRank = this.rank.get(leftRoot) ?? 0
    const rightRank = this.rank.get(rightRoot) ?? 0

    if (leftRank < rightRank) {
      this.parent.set(leftRoot, rightRoot)
      return
    }

    if (leftRank > rightRank) {
      this.parent.set(rightRoot, leftRoot)
      return
    }

    this.parent.set(rightRoot, leftRoot)
    this.rank.set(leftRoot, leftRank + 1)
  }
}

const pinKey = (pinRef: PinRef): string => `${pinRef.componentId}:${pinRef.pinId}`

const samePin = (left: PinRef, right: PinRef): boolean =>
  left.componentId === right.componentId && left.pinId === right.pinId

const electricalNodeIdFromIndex = (index: number): ElectricalNodeId =>
  `node_${String(index + 1).padStart(3, '0')}`

const isGroundComponentPin = (component: CircuitComponent, pinId: string): boolean =>
  component.type === 'ground' && pinId === 'ground'

const isImplicitGroundBusPin = (component: CircuitComponent, pinId: string): boolean =>
  component.type !== 'ground' &&
  component.pins.some(
    (pin) =>
      String(pin.id) === pinId &&
      (pin.electricalType === 'ground_reference' ||
        pin.electricalType === 'shield_drain' ||
        pin.role === 'ground' ||
        pin.role === 'shield' ||
        pin.role === 'jack_sleeve' ||
        String(pin.id) === 'ground' ||
        String(pin.id) === 'sleeve' ||
        String(pin.id) === 'shield'),
  )

export function buildCircuitGraph(
  components: CircuitComponent[],
  connections: ElectricalConnection[],
): CircuitGraph {
  // This graph represents visible wire continuity plus the virtual ground bus.
  // Switch internals and active switch positions should be applied in a later graph pass.
  const disjointSet = new DisjointSet()
  const pinsByKey = new Map<string, PinRef>()
  const componentById = new Map(components.map((component) => [String(component.id), component]))
  const groundBusPins: PinRef[] = []
  const implicitGroundPins: PinRef[] = []

  for (const component of components) {
    for (const pin of component.pins) {
      const pinRef = {
        componentId: String(component.id),
        pinId: String(pin.id),
      }
      const key = pinKey(pinRef)

      pinsByKey.set(key, pinRef)
      disjointSet.makeSet(key)

      if (isGroundComponentPin(component, String(pin.id))) {
        groundBusPins.push(pinRef)
      } else if (isImplicitGroundBusPin(component, String(pin.id))) {
        implicitGroundPins.push(pinRef)
      }
    }
  }

  for (const connection of connections) {
    const fromKey = pinKey(connection.from)
    const toKey = pinKey(connection.to)

    if (!pinsByKey.has(fromKey) || !pinsByKey.has(toKey)) {
      continue
    }

    disjointSet.union(fromKey, toKey)
  }

  if (groundBusPins.length > 0) {
    const rootGroundKey = pinKey(groundBusPins[0])

    for (const groundPin of groundBusPins.slice(1)) {
      disjointSet.union(rootGroundKey, pinKey(groundPin))
    }

    for (const implicitGroundPin of implicitGroundPins) {
      disjointSet.union(rootGroundKey, pinKey(implicitGroundPin))
    }
  }

  const groupsByRoot = new Map<string, PinRef[]>()

  for (const [key, pinRef] of pinsByKey) {
    const root = disjointSet.find(key)
    const group = groupsByRoot.get(root) ?? []

    group.push(pinRef)
    groupsByRoot.set(root, group)
  }

  const electricalNodes: ElectricalNode[] = Array.from(groupsByRoot.values()).map((pins, index) => ({
    id: electricalNodeIdFromIndex(index),
    pins,
  }))

  const electricalNodeByPinKey = new Map<string, ElectricalNode>()
  for (const electricalNode of electricalNodes) {
    for (const pin of electricalNode.pins) {
      electricalNodeByPinKey.set(pinKey(pin), electricalNode)
    }
  }

  const connectedPinGroups: ConnectedPinGroup[] = electricalNodes
    .filter((electricalNode) => electricalNode.pins.length > 1)
    .map((electricalNode) => ({
      electricalNodeId: electricalNode.id,
      pins: electricalNode.pins,
    }))

  const findConnectedPins = (pinRef: PinRef): PinRef[] => {
    const electricalNode = electricalNodeByPinKey.get(pinKey(pinRef))

    if (!electricalNode) {
      return []
    }

    return electricalNode.pins.filter((pin) => !samePin(pin, pinRef))
  }

  const arePinsConnected = (pinA: PinRef, pinB: PinRef): boolean => {
    const nodeA = electricalNodeByPinKey.get(pinKey(pinA))
    const nodeB = electricalNodeByPinKey.get(pinKey(pinB))

    return Boolean(nodeA && nodeB && nodeA.id === nodeB.id)
  }

  const getElectricalNodeOfPin = (pinRef: PinRef): ElectricalNode | undefined =>
    electricalNodeByPinKey.get(pinKey(pinRef))

  const getFloatingPins = (): PinRef[] =>
    electricalNodes
      .filter((electricalNode) => electricalNode.pins.length === 1)
      .flatMap((electricalNode) => electricalNode.pins)

  const getConnectedComponents = (componentId: string): CircuitComponent[] => {
    const componentPinKeys = new Set(
      components
        .find((component) => String(component.id) === componentId)
        ?.pins.map((pin) => pinKey({ componentId, pinId: String(pin.id) })) ?? [],
    )

    if (componentPinKeys.size === 0) {
      return []
    }

    const connectedComponentIds = new Set<string>()

    for (const key of componentPinKeys) {
      const electricalNode = electricalNodeByPinKey.get(key)

      if (!electricalNode) {
        continue
      }

      for (const pin of electricalNode.pins) {
        if (pin.componentId !== componentId) {
          connectedComponentIds.add(pin.componentId)
        }
      }
    }

    return Array.from(connectedComponentIds)
      .map((connectedComponentId) => componentById.get(connectedComponentId))
      .filter((component): component is CircuitComponent => Boolean(component))
  }

  const hasPathBetweenPins = (pinA: PinRef, pinB: PinRef): boolean =>
    arePinsConnected(pinA, pinB)

  const debugGraph = (): CircuitGraphDebugInfo => ({
    componentCount: components.length,
    pinCount: pinsByKey.size,
    connectionCount: connections.length,
    electricalNodeCount: electricalNodes.length,
    electricalNodes: electricalNodes.map((electricalNode) => ({
      id: electricalNode.id,
      pins: electricalNode.pins.map(pinKey),
    })),
    floatingPins: getFloatingPins().map(pinKey),
  })

  return {
    components,
    connections,
    electricalNodes,
    connectedPinGroups,
    findConnectedPins,
    arePinsConnected,
    getElectricalNodeOfPin,
    getFloatingPins,
    getConnectedComponents,
    hasPathBetweenPins,
    debugGraph,
  }
}
