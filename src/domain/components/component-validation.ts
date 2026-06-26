import type { CircuitComponent, ComponentType } from './circuit-component'

export interface ComponentValidationIssue {
  field: string
  message: string
}

export interface ComponentValidationResult {
  valid: boolean
  issues: ComponentValidationIssue[]
}

const requiredPinsByType = {
  pickup: [],
  potentiometer: ['in', 'out', 'ground'],
  capacitor: ['a', 'b'],
  resistor: ['a', 'b'],
  mono_jack: ['tip', 'sleeve'],
  ground: ['ground'],
  switch: [],
  selector: [],
  oscilloscope_probe: ['positive', 'reference'],
  signal_generator: ['output', 'reference'],
  string_exciter: [],
} satisfies Record<ComponentType, string[]>

export function validateCircuitComponent(component: CircuitComponent): ComponentValidationResult {
  const issues: ComponentValidationIssue[] = []

  if (!component.id) {
    issues.push({ field: 'id', message: 'Component id is required.' })
  }

  if (!component.label.trim()) {
    issues.push({ field: 'label', message: 'Component label is required.' })
  }

  if (!Number.isFinite(component.position.x) || !Number.isFinite(component.position.y)) {
    issues.push({ field: 'position', message: 'Visual position must contain finite x and y.' })
  }

  const pinIds = new Set(component.pins.map((pin) => pin.id))
  if (pinIds.size !== component.pins.length) {
    issues.push({ field: 'pins', message: 'Pin ids must be unique inside a component.' })
  }

  const dynamicRequiredPins =
    component.type === 'pickup'
      ? component.pins.map((componentPin) => String(componentPin.id))
      : component.type === 'switch' || component.type === 'selector'
        ? component.pins.map((componentPin) => String(componentPin.id))
      : requiredPinsByType[component.type]
  const missingPins = dynamicRequiredPins.filter((pinId) => !pinIds.has(pinId as never))

  if (missingPins.length > 0) {
    issues.push({
      field: 'pins',
      message: `Missing required pin(s): ${missingPins.join(', ')}.`,
    })
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export function assertValidCircuitComponent(component: CircuitComponent): void {
  const validation = validateCircuitComponent(component)

  if (!validation.valid) {
    throw new Error(
      validation.issues.map((issue) => `${issue.field}: ${issue.message}`).join(' '),
    )
  }
}
