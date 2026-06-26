import type { Edge, Node } from '@vue-flow/core'

import type {
  CircuitComponent,
  ElectricalConnection,
  PinRef,
} from '@/domain/components/circuit-component'
import { buildCircuitGraph, type CircuitGraph } from '@/domain/graph/circuit-graph'
import type { CircuitNodeData } from '@/features/circuit-engine/circuit-node-data'
import type {
  SwitchPositionValidationContext,
  ValidationContext,
  ValidationIssue,
  ValidationResult,
} from './validation-result'

type ComponentById = Map<string, CircuitComponent>

const pin = (componentId: string, pinId: string): PinRef => ({ componentId, pinId })
const pinKey = (pinRef: PinRef): string => `${pinRef.componentId}:${pinRef.pinId}`

const componentLabel = (component?: CircuitComponent): string => component?.label ?? 'El componente'

const hasPin = (component: CircuitComponent, pinId: string): boolean =>
  component.pins.some((componentPin) => String(componentPin.id) === pinId)

const isGroundPin = (component: CircuitComponent, pinId: string): boolean =>
  component.pins.some(
    (componentPin) =>
      String(componentPin.id) === pinId &&
      (componentPin.role === 'ground' ||
        componentPin.role === 'jack_sleeve' ||
        componentPin.role === 'probe_reference'),
  )

const isSignalPin = (component: CircuitComponent, pinId: string): boolean =>
  component.type !== 'capacitor' &&
  component.type !== 'resistor' &&
  component.pins.some(
    (componentPin) =>
      String(componentPin.id) === pinId &&
      (componentPin.role === 'signal' ||
        componentPin.role === 'pickup_coil_start' ||
        componentPin.role === 'pot_lug' ||
        componentPin.role === 'pot_wiper' ||
        componentPin.role === 'jack_tip' ||
        componentPin.role === 'probe_positive'),
  )

function indexComponents(components: CircuitComponent[]): ComponentById {
  return new Map(components.map((component) => [String(component.id), component]))
}

function getJacks(components: CircuitComponent[]): CircuitComponent<'mono_jack'>[] {
  return components.filter(
    (component): component is CircuitComponent<'mono_jack'> => component.type === 'mono_jack',
  )
}

function getGroundRefs(components: CircuitComponent[]): PinRef[] {
  return components
    .filter((component) => component.type === 'ground')
    .flatMap((component) =>
      component.pins
        .filter((componentPin) => String(componentPin.id) === 'ground')
        .map((componentPin) => pin(String(component.id), String(componentPin.id))),
    )
}

function getJackTipRefs(components: CircuitComponent[]): PinRef[] {
  return getJacks(components).map((jack) => pin(String(jack.id), 'tip'))
}

function isConnectedToAny(graph: CircuitGraph, pinRef: PinRef, targets: PinRef[]): boolean {
  return targets.some((target) => graph.arePinsConnected(pinRef, target))
}

function isTonePotentiometer(component: CircuitComponent<'potentiometer'>): boolean {
  const text = `${component.id} ${component.label}`.toLowerCase()

  return text.includes('tone') || text.includes('tono')
}

function createContext(
  components: CircuitComponent[],
  connections: ElectricalConnection[],
  switchPositions?: SwitchPositionValidationContext[],
): ValidationContext {
  return {
    components,
    connections,
    graph: buildCircuitGraph(components, connections),
    switchPositions,
  }
}

function functionalNeighbors(context: ValidationContext, pinRef: PinRef): PinRef[] {
  const neighbors = context.graph.findConnectedPins(pinRef)
  const component = context.components.find(
    (candidate) => String(candidate.id) === pinRef.componentId,
  )

  if (!component) {
    return neighbors
  }

  if (component.type === 'potentiometer') {
    if (pinRef.pinId === 'in' && hasPin(component, 'out')) {
      neighbors.push(pin(pinRef.componentId, 'out'))
    }

    if (pinRef.pinId === 'out' && hasPin(component, 'in')) {
      neighbors.push(pin(pinRef.componentId, 'in'))
    }
  }

  if (component.type === 'resistor' || component.type === 'capacitor') {
    if (pinRef.pinId === 'a' && hasPin(component, 'b')) {
      neighbors.push(pin(pinRef.componentId, 'b'))
    }

    if (pinRef.pinId === 'b' && hasPin(component, 'a')) {
      neighbors.push(pin(pinRef.componentId, 'a'))
    }
  }

  return neighbors
}

function hasFunctionalPath(context: ValidationContext, from: PinRef, targets: PinRef[]): boolean {
  const targetKeys = new Set(targets.map(pinKey))
  const visited = new Set<string>()
  const queue = [from]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    const currentKey = pinKey(current)

    if (targetKeys.has(currentKey)) {
      return true
    }

    if (visited.has(currentKey)) {
      continue
    }

    visited.add(currentKey)

    for (const next of functionalNeighbors(context, current)) {
      if (!visited.has(pinKey(next))) {
        queue.push(next)
      }
    }
  }

  return false
}

function signalSourcePins(components: CircuitComponent[]): PinRef[] {
  return components.flatMap((component) => {
    if (component.type === 'pickup') {
      if (component.params.coilCount === 1 || component.params.conductorMode === '2_conductor') {
        return [pin(String(component.id), 'hot')]
      }

      return [
        pin(String(component.id), 'north_start'),
        pin(String(component.id), 'south_start'),
      ]
    }

    if (component.type === 'signal_generator') {
      return [pin(String(component.id), 'output')]
    }

    return []
  })
}

export function validateJack(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const groundRefs = getGroundRefs(context.components)
  const sourcePins = signalSourcePins(context.components)

  for (const jack of getJacks(context.components)) {
    const jackId = String(jack.id)
    const tip = pin(jackId, 'tip')
    const sleeve = pin(jackId, 'sleeve')

    if (context.graph.arePinsConnected(tip, sleeve) || isConnectedToAny(context.graph, tip, groundRefs)) {
      issues.push({
        id: `${jackId}.tip-ground-short`,
        code: 'jack_tip_ground_short',
        severity: 'error',
        componentId: jackId,
        pinRef: tip,
        message: 'jack.tip esta conectado directamente a tierra. La salida quedara en silencio.',
      })
    }

    if (!isConnectedToAny(context.graph, sleeve, groundRefs)) {
      issues.push({
        id: `${jackId}.sleeve-missing-ground`,
        code: 'jack_sleeve_missing_ground',
        severity: 'error',
        componentId: jackId,
        pinRef: sleeve,
        message: 'jack.sleeve no esta conectado a ground. La guitarra puede meter ruido o no cerrar el circuito.',
      })
    }

    if (!hasFunctionalPath(context, tip, sourcePins)) {
      issues.push({
        id: `${jackId}.tip-no-signal`,
        code: 'jack_tip_no_signal',
        severity: 'warning',
        componentId: jackId,
        pinRef: tip,
        message: 'jack.tip no recibe senal de ninguna pastilla o fuente. La salida quedara muda.',
      })
    }
  }

  return issues
}

export function validateGround(context: ValidationContext): ValidationIssue[] {
  if (getGroundRefs(context.components).length > 0) {
    return []
  }

  return [
    {
      id: 'missing-ground-reference',
      code: 'missing_ground_reference',
      severity: 'error',
      message: 'El circuito no tiene un ground de referencia. Agrega un punto de tierra comun.',
    },
  ]
}

export function validatePickups(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const groundRefs = getGroundRefs(context.components)
  const jackTips = getJackTipRefs(context.components)

  for (const component of context.components) {
    const componentId = String(component.id)

    if (component.type === 'pickup') {
      const hotPins =
        component.params.coilCount === 1 || component.params.conductorMode === '2_conductor'
          ? [pin(componentId, 'hot')]
          : [pin(componentId, 'north_start'), pin(componentId, 'south_start')]
      const activeStarts = hotPins.filter((hotPin) => hasFunctionalPath(context, hotPin, jackTips))

      if (activeStarts.length === 0) {
        issues.push({
          id: `${componentId}.hot-no-output`,
          code: 'pickup_hot_no_output',
          severity: 'warning',
          componentId,
          pinRef: hotPins[0],
          message: `${componentLabel(component)} no tiene camino desde hot hacia la salida.`,
        })
      }

      if (
        (component.params.coilCount === 1 || component.params.conductorMode === '2_conductor') &&
        !isConnectedToAny(context.graph, pin(componentId, 'ground'), groundRefs)
      ) {
        issues.push({
          id: `${componentId}.ground-return-missing`,
          code: 'pickup_ground_return_missing',
          severity: 'error',
          componentId,
          pinRef: pin(componentId, 'ground'),
          message: `${componentLabel(component)} no tiene retorno a ground.`,
        })
      }

      if (component.params.hasShield && hasPin(component, 'shield')) {
        const shield = pin(componentId, 'shield')

        if (!isConnectedToAny(context.graph, shield, groundRefs)) {
          issues.push({
            id: `${componentId}.shield-floating`,
            code: 'humbucker_shield_floating',
            severity: 'warning',
            componentId,
            pinRef: shield,
            message: `La malla/shield de ${componentLabel(component)} no esta conectada a ground.`,
          })
        }
      }
    }

  }

  return issues
}

export function validateShortCircuits(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const componentsById = indexComponents(context.components)
  const groundRefs = getGroundRefs(context.components)

  for (const jack of getJacks(context.components)) {
    const jackId = String(jack.id)

    if (context.graph.arePinsConnected(pin(jackId, 'tip'), pin(jackId, 'sleeve'))) {
      issues.push({
        id: `${jackId}.tip-sleeve-short`,
        code: 'jack_tip_sleeve_short',
        severity: 'error',
        componentId: jackId,
        message: 'jack.tip y jack.sleeve estan unidos directamente. La salida quedara en corto.',
      })
    }
  }

  for (const electricalNode of context.graph.electricalNodes) {
    const hasGround = electricalNode.pins.some((nodePin) => {
      const component = componentsById.get(nodePin.componentId)
      return Boolean(component && isGroundPin(component, nodePin.pinId))
    })
    const hasSignal = electricalNode.pins.some((nodePin) => {
      const component = componentsById.get(nodePin.componentId)
      return Boolean(component && isSignalPin(component, nodePin.pinId))
    })
    const includesGroundReference = electricalNode.pins.some((nodePin) =>
      groundRefs.some((groundRef) => pinKey(groundRef) === pinKey(nodePin)),
    )

    if (hasGround && hasSignal && includesGroundReference) {
      issues.push({
        id: `${electricalNode.id}.signal-ground-short`,
        code: 'signal_ground_short',
        severity: 'error',
        message: 'Una linea de senal esta conectada directamente a ground. Esa parte del circuito quedara en silencio.',
      })
    }
  }

  return issues
}

export function validateFloatingPins(context: ValidationContext): ValidationIssue[] {
  const importantRoles = new Set([
    'pickup_coil_start',
    'pickup_coil_finish',
    'pot_wiper',
    'jack_tip',
    'jack_sleeve',
    'shield',
  ])
  const componentsById = indexComponents(context.components)

  return context.graph.getFloatingPins().flatMap((floatingPin) => {
    const component = componentsById.get(floatingPin.componentId)
    const componentPin = component?.pins.find((candidate) => String(candidate.id) === floatingPin.pinId)

    if (!component || !componentPin || !importantRoles.has(componentPin.role)) {
      return []
    }

    return [
      {
        id: `${floatingPin.componentId}.${floatingPin.pinId}.floating`,
        code: 'important_pin_floating',
        severity: 'warning',
        componentId: floatingPin.componentId,
        pinRef: floatingPin,
        message: `${componentLabel(component)} tiene el pin ${componentPin.name} sin conectar.`,
      },
    ]
  })
}

export function validatePotentiometers(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const jackTips = getJackTipRefs(context.components)
  const groundRefs = getGroundRefs(context.components)

  for (const component of context.components.filter((candidate) => candidate.type === 'potentiometer')) {
    const componentId = String(component.id)

    for (const requiredPin of ['in', 'out', 'ground']) {
      if (!hasPin(component, requiredPin)) {
        issues.push({
          id: `${componentId}.${requiredPin}.missing`,
          code: 'pot_pin_missing',
          severity: 'error',
          componentId,
          message: `${componentLabel(component)} no tiene el pin ${requiredPin}.`,
        })
      }
    }

    const out = pin(componentId, 'out')
    const ground = pin(componentId, 'ground')

    if (!isTonePotentiometer(component) && !hasFunctionalPath(context, out, jackTips)) {
      issues.push({
        id: `${componentId}.wiper-no-jack`,
        code: 'volume_wiper_no_jack',
        severity: 'warning',
        componentId,
        pinRef: out,
        message: `${componentLabel(component)} es volumen, pero el wiper/out no llega a jack.tip.`,
      })
    }

    if (isTonePotentiometer(component) && !isConnectedToAny(context.graph, ground, groundRefs)) {
      issues.push({
        id: `${componentId}.tone-no-ground`,
        code: 'tone_pot_no_ground',
        severity: 'warning',
        componentId,
        pinRef: ground,
        message: `${componentLabel(component)} parece control de tono, pero no tiene camino a ground.`,
      })
    }
  }

  for (const capacitor of context.components.filter((candidate) => candidate.type === 'capacitor')) {
    const componentId = String(capacitor.id)
    const capPins = [pin(componentId, 'a'), pin(componentId, 'b')]

    if (!capPins.some((capPin) => isConnectedToAny(context.graph, capPin, groundRefs))) {
      issues.push({
        id: `${componentId}.cap-no-ground`,
        code: 'tone_cap_no_ground',
        severity: 'info',
        componentId,
        message: `${componentLabel(capacitor)} no tiene un lado conectado a ground. Si es capacitor de tono, no recortara agudos.`,
      })
    }
  }

  return issues
}

export function validateSwitchPositions(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const switchPosition of context.switchPositions ?? []) {
    const positionContext: ValidationContext = {
      ...context,
      graph: switchPosition.graph,
    }
    const jackIssues = validateJack(positionContext)
    const shortIssues = validateShortCircuits(positionContext)
    const positionIssues = [
      ...jackIssues.filter((validationIssue) => validationIssue.code === 'jack_tip_no_signal'),
      ...shortIssues,
    ]

    for (const positionIssue of positionIssues) {
      const isMuted = positionIssue.code === 'jack_tip_no_signal'
      const message = isMuted
        ? `En la posicion ${switchPosition.position} del selector, el jack no recibe senal de ninguna pastilla.`
        : `En la posicion ${switchPosition.position} del selector, hay un corto que dejara la salida en silencio.`

      issues.push({
        ...positionIssue,
        id: `${switchPosition.id}.${positionIssue.id}`,
        switchPosition: switchPosition.id,
        message,
      })
    }
  }

  return issues
}

function groupIssues(issues: ValidationIssue[]): Pick<ValidationResult, 'global' | 'byComponent' | 'bySwitchPosition'> {
  const global: ValidationIssue[] = []
  const byComponent: Record<string, ValidationIssue[]> = {}
  const bySwitchPosition: Record<string, ValidationIssue[]> = {}

  for (const validationIssue of issues) {
    if (validationIssue.switchPosition) {
      bySwitchPosition[validationIssue.switchPosition] ??= []
      bySwitchPosition[validationIssue.switchPosition].push(validationIssue)
    } else if (validationIssue.componentId) {
      byComponent[validationIssue.componentId] ??= []
      byComponent[validationIssue.componentId].push(validationIssue)
    } else {
      global.push(validationIssue)
    }
  }

  return {
    global,
    byComponent,
    bySwitchPosition,
  }
}

export function validateCircuit(context: ValidationContext): ValidationResult {
  const issues = [
    ...validateGround(context),
    ...validateJack(context),
    ...validatePickups(context),
    ...validateShortCircuits(context),
    ...validateFloatingPins(context),
    ...validatePotentiometers(context),
    ...validateSwitchPositions(context),
  ]
  const groupedIssues = groupIssues(issues)

  return {
    valid: !issues.some((validationIssue) => validationIssue.severity === 'error'),
    issues,
    ...groupedIssues,
  }
}

export function validateElectricalGraph(
  nodes: Node<CircuitNodeData>[],
  edges: Edge[],
): ValidationResult {
  const components = nodes.map((node) => node.data.component)
  const connections = edges.flatMap((edge): ElectricalConnection[] => {
    const source = nodes.find((node) => node.id === edge.source)
    const target = nodes.find((node) => node.id === edge.target)

    if (!source || !target || !edge.sourceHandle || !edge.targetHandle) {
      return []
    }

    return [
      {
        id: edge.id,
        color: '#000000',
        from: {
          componentId: String(source.data.componentId),
          pinId: String(edge.sourceHandle),
        },
        to: {
          componentId: String(target.data.componentId),
          pinId: String(edge.targetHandle),
        },
      },
    ]
  })
  const context = createContext(components, connections)

  if (nodes.length === 0) {
    const emptyIssue: ValidationIssue = {
      id: 'empty-workspace',
      severity: 'info',
      message: 'Agrega componentes para iniciar un circuito.',
    }
    const result = validateCircuit(context)

    return {
      ...result,
      issues: [emptyIssue, ...result.issues],
      global: [emptyIssue, ...result.global],
    }
  }

  return validateCircuit(context)
}
