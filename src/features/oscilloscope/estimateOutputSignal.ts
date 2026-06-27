import type {
  CircuitComponent,
  ElectricalConnection,
  PinRef,
  SignalGeneratorParams,
  StringExciterParams,
} from '@/domain/components/circuit-component'
import { buildCircuitGraph, type CircuitGraph } from '@/domain/graph/circuit-graph'
import type {
  OscilloscopeReading,
  OscilloscopeStatus,
  WaveformPoint,
} from '@/domain/simulation/oscilloscope'
import type { PresetSwitchPosition } from '@/features/presets/presetLibrary'
import type { ValidationResult } from '@/features/validators/validation-result'

export interface EstimateOutputSignalInput {
  components: CircuitComponent[]
  connections?: ElectricalConnection[]
  switchPositions?: PresetSwitchPosition[]
  measurementPin?: PinRef
  measureAtSource?: boolean
  validation: ValidationResult
  durationMs?: number
  sampleCount?: number
}

const statusLabels: Record<OscilloscopeStatus, string> = {
  'signal-ok': 'Señal OK',
  'output-shorted': 'Salida en corto',
  'no-signal-path': 'Sin camino de señal',
  'no-signal-source': 'Sin fuente de señal',
  'missing-ground': 'Tierra ausente',
  'muted-switch-position': 'Posicion muda del selector',
  'floating-output': 'Salida flotante',
}

interface SignalSource {
  component: CircuitComponent<'signal_generator'> | CircuitComponent<'string_exciter'>
  params: SignalGeneratorParams | StringExciterParams
  kind: 'generator' | 'strings'
}

interface GraphCandidate {
  graph: CircuitGraph
  label?: string
}

interface SignalPath {
  graph: CircuitGraph
  source: PinRef
  target: PinRef
}

interface ToneProfile {
  highFrequencyDamping: number
}

const pin = (componentId: string, pinId: string): PinRef => ({ componentId, pinId })
const pinKey = (pinRef: PinRef): string => `${pinRef.componentId}:${pinRef.pinId}`

function findSignalGenerator(components: CircuitComponent[]): CircuitComponent<'signal_generator'> | undefined {
  return components.find(
    (component): component is CircuitComponent<'signal_generator'> =>
      component.type === 'signal_generator',
  )
}

function findStringExciter(components: CircuitComponent[]): CircuitComponent<'string_exciter'> | undefined {
  return components.find(
    (component): component is CircuitComponent<'string_exciter'> =>
      component.type === 'string_exciter',
  )
}

function findActiveSource(components: CircuitComponent[]): SignalSource | undefined {
  const stringExciter = findStringExciter(components)

  if (stringExciter) {
    return {
      component: stringExciter,
      params: stringExciter.params,
      kind: 'strings',
    }
  }

  const signalGenerator = findSignalGenerator(components)

  if (signalGenerator) {
    return {
      component: signalGenerator,
      params: signalGenerator.params,
      kind: 'generator',
    }
  }

  return undefined
}

function isPhysicallyConnected(graph: CircuitGraph, left: PinRef, right: PinRef): boolean {
  return graph.arePinsConnected(left, right)
}

function normalizedPotPosition(position?: number): number {
  const rawPosition = position ?? 1
  const normalizedPosition = rawPosition > 1 ? rawPosition / 10 : rawPosition

  return Math.min(1, Math.max(0, normalizedPosition))
}

function taperAttenuationFactor(pot: CircuitComponent<'potentiometer'>): number {
  const position = normalizedPotPosition(pot.params.position)

  if (pot.params.taper === 'audio') {
    return Math.pow(position, 2.15)
  }

  if (pot.params.taper === 'reverse_audio') {
    return 1 - Math.pow(1 - position, 2.15)
  }

  return position
}

function isTonePotentiometer(component: CircuitComponent<'potentiometer'>): boolean {
  const text = `${component.id} ${component.label}`.toLowerCase()

  return text.includes('tone') || text.includes('tono')
}

function estimateVolumeAttenuation(components: CircuitComponent[], signalPath?: SignalPath): number {
  const volumePots = components.filter(
    (component): component is CircuitComponent<'potentiometer'> =>
      component.type === 'potentiometer' && !isTonePotentiometer(component),
  )

  if (volumePots.length === 0 || !signalPath) {
    return 1
  }

  return volumePots.reduce((attenuation, pot) => {
    const potIn = pin(String(pot.id), 'in')
    const potOut = pin(String(pot.id), 'out')
    const isAfterPot =
      isPhysicallyConnected(signalPath.graph, signalPath.source, potIn) &&
      isPhysicallyConnected(signalPath.graph, potOut, signalPath.target)

    if (!isAfterPot) {
      return attenuation
    }

    return attenuation * taperAttenuationFactor(pot)
  }, 1)
}

function estimateLoadAttenuation(components: CircuitComponent[]): number {
  const loadPots = components.filter(
    (component): component is CircuitComponent<'potentiometer'> =>
      component.type === 'potentiometer' && !isTonePotentiometer(component),
  )
  const lowestLoad = Math.min(...loadPots.map((pot) => pot.params.resistanceOhms), 1000000)

  if (!Number.isFinite(lowestLoad)) {
    return 1
  }

  if (lowestLoad <= 250000) {
    return 0.82
  }

  if (lowestLoad <= 500000) {
    return 0.92
  }

  return 1
}

function estimateToneProfile(components: CircuitComponent[]): ToneProfile {
  const tonePots = components.filter(
    (component): component is CircuitComponent<'potentiometer'> =>
      component.type === 'potentiometer' && isTonePotentiometer(component),
  )
  const capacitors = components.filter(
    (component): component is CircuitComponent<'capacitor'> => component.type === 'capacitor',
  )

  if (tonePots.length === 0 || capacitors.length === 0) {
    return {
      highFrequencyDamping: 1,
    }
  }

  const averageTonePosition =
    tonePots.reduce((sum, pot) => sum + normalizedPotPosition(pot.params.position), 0) /
    tonePots.length
  const largestCap = Math.max(...capacitors.map((capacitor) => capacitor.params.capacitanceFarads))
  const highFrequencyFactor =
    largestCap >= 47e-9
      ? 0.9
      : largestCap >= 22e-9
        ? 0.72
        : largestCap >= 10e-9
          ? 0.55
          : largestCap >= 4.7e-9
            ? 0.38
            : largestCap >= 2.2e-9
              ? 0.22
              : 0.12
  const closedAmount = 1 - averageTonePosition

  return {
    highFrequencyDamping: Math.max(0.08, 1 - closedAmount * highFrequencyFactor),
  }
}

function triangleWave(phase: number): number {
  return 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1
}

function deterministicNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453

  return (value - Math.floor(value)) * 2 - 1
}

function multiFrequencyWave(phase: number, highFrequencyDamping: number): number {
  const partials = [
    { harmonic: 1, amplitude: 1 },
    { harmonic: 2, amplitude: 0.55 },
    { harmonic: 3, amplitude: 0.36 },
    { harmonic: 5, amplitude: 0.22 },
    { harmonic: 8, amplitude: 0.14 },
  ]
  let total = 0
  let maxAmplitude = 0

  for (const [index, partial] of partials.entries()) {
    const damping = Math.pow(highFrequencyDamping, index)
    const amplitude = partial.amplitude * damping

    total += Math.sin(2 * Math.PI * phase * partial.harmonic) * amplitude
    maxAmplitude += amplitude
  }

  return maxAmplitude === 0 ? 0 : total / maxAmplitude
}

function applyToneLowPass(points: WaveformPoint[], highFrequencyDamping: number): WaveformPoint[] {
  if (highFrequencyDamping >= 0.98 || points.length < 2) {
    return points
  }

  const response = Math.max(0.04, Math.min(1, highFrequencyDamping))
  let previousVoltage = points[0].voltage

  return points.map((point, index) => {
    if (index === 0) {
      return point
    }

    previousVoltage += (point.voltage - previousVoltage) * response

    return {
      ...point,
      voltage: previousVoltage,
    }
  })
}

function generateWaveform(
  waveform: SignalGeneratorParams['waveform'],
  frequencyHz: number,
  amplitudeVolts: number,
  durationMs: number,
  sampleCount: number,
  highFrequencyDamping = 1,
): WaveformPoint[] {
  let pinkState = 0

  const points = Array.from({ length: sampleCount }, (_, index) => {
    const progress = sampleCount === 1 ? 0 : index / (sampleCount - 1)
    const timeMs = progress * durationMs
    const seconds = timeMs / 1000
    const phase = frequencyHz * seconds
    const sine = Math.sin(2 * Math.PI * phase)
    let normalized = sine

    if (waveform === 'square') {
      normalized = sine >= 0 ? 1 : -1
    } else if (waveform === 'triangle') {
      normalized = triangleWave(phase)
    } else if (waveform === 'multi_frequency') {
      normalized = multiFrequencyWave(phase, highFrequencyDamping)
    } else if (waveform === 'white_noise') {
      normalized = deterministicNoise(index + Math.round(frequencyHz * 10))
    } else if (waveform === 'pink_noise') {
      const white = deterministicNoise(index + Math.round(frequencyHz * 10))
      pinkState = pinkState * 0.86 + white * 0.14
      normalized = Math.max(-1, Math.min(1, pinkState * 2.6))
    }

    return {
      timeMs,
      voltage: normalized * amplitudeVolts,
    }
  })

  if (waveform === 'sine') {
    return points
  }

  return applyToneLowPass(points, highFrequencyDamping)
}

function generateFlatLine(durationMs: number, sampleCount: number): WaveformPoint[] {
  return Array.from({ length: sampleCount }, (_, index) => ({
    timeMs: (index / Math.max(1, sampleCount - 1)) * durationMs,
    voltage: 0,
  }))
}

function hasPin(component: CircuitComponent, pinId: string): boolean {
  return component.pins.some((componentPin) => String(componentPin.id) === pinId)
}

function functionalNeighbors(
  components: CircuitComponent[],
  graph: CircuitGraph,
  pinRef: PinRef,
): PinRef[] {
  const neighbors = graph.findConnectedPins(pinRef)
  const component = components.find((candidate) => String(candidate.id) === pinRef.componentId)

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

function hasFunctionalPath(
  components: CircuitComponent[],
  graph: CircuitGraph,
  from: PinRef,
  targets: PinRef[],
): boolean {
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

    for (const next of functionalNeighbors(components, graph, current)) {
      if (!visited.has(pinKey(next))) {
        queue.push(next)
      }
    }
  }

  return false
}

function jackTipPins(components: CircuitComponent[]): PinRef[] {
  return components
    .filter((component) => component.type === 'mono_jack')
    .map((component) => pin(String(component.id), 'tip'))
}

function oscilloscopeProbePins(components: CircuitComponent[]): PinRef[] {
  return components
    .filter((component) => component.type === 'oscilloscope_probe')
    .map((component) => pin(String(component.id), 'positive'))
}

function measurementPins(input: EstimateOutputSignalInput, source: SignalSource): PinRef[] {
  if (input.measureAtSource) {
    return sourcePinsFor(input.components, source)
  }

  if (input.measurementPin) {
    return [input.measurementPin]
  }

  const { components } = input
  const probes = oscilloscopeProbePins(components)

  return probes.length > 0 ? probes : jackTipPins(components)
}

function pickupSignalPins(components: CircuitComponent[]): PinRef[] {
  return components.flatMap((component) => {
    if (component.type !== 'pickup') {
      return []
    }

    if (component.params.coilCount === 1 || component.params.conductorMode === '2_conductor') {
      return [pin(String(component.id), 'hot')]
    }

    return [pin(String(component.id), 'north_start'), pin(String(component.id), 'south_start')]
  })
}

function sourcePinsFor(components: CircuitComponent[], source: SignalSource): PinRef[] {
  if (source.kind === 'generator') {
    return [pin(String(source.component.id), 'output')]
  }

  return pickupSignalPins(components)
}

function graphCandidates(input: EstimateOutputSignalInput): GraphCandidate[] {
  const connections = input.connections ?? []
  const baseGraph = buildCircuitGraph(input.components, connections)
  const selectedSwitchPositions = (input.switchPositions ?? []).filter((switchPosition) => {
    const component = input.components.find(
      (candidate) => String(candidate.id) === switchPosition.switchId,
    )

    return (
      component &&
      'position' in component.params &&
      Number(component.params.position ?? 1) === switchPosition.position
    )
  })

  if (selectedSwitchPositions.length > 0) {
    return [
      {
        graph: buildCircuitGraph(input.components, [
          ...connections,
          ...selectedSwitchPositions.flatMap((switchPosition) => switchPosition.activeConnections),
        ]),
      },
    ]
  }

  const switchedGraphs = (input.switchPositions ?? []).map((switchPosition) => ({
    label: switchPosition.label,
    graph: buildCircuitGraph(input.components, [
      ...connections,
      ...switchPosition.activeConnections,
    ]),
  }))

  return switchedGraphs.length > 0 ? switchedGraphs : [{ graph: baseGraph }]
}

function findUsableSignalPath(
  input: EstimateOutputSignalInput,
  source: SignalSource,
): SignalPath | undefined {
  const outputs = measurementPins(input, source)
  const sourcePins = sourcePinsFor(input.components, source)

  if (outputs.length === 0 || sourcePins.length === 0) {
    return undefined
  }

  for (const { graph } of graphCandidates(input)) {
    for (const sourcePin of sourcePins) {
      for (const output of outputs) {
        if (hasFunctionalPath(input.components, graph, sourcePin, [output])) {
          return {
            graph,
            source: sourcePin,
            target: output,
          }
        }
      }
    }
  }

  return undefined
}

function allSwitchPositionsHaveIssue(validation: ValidationResult, switchPositionCount: number): boolean {
  return (
    switchPositionCount > 0 &&
    Object.keys(validation.bySwitchPosition).length >= switchPositionCount
  )
}

function statusFromValidation(
  validation: ValidationResult,
  hasSource: boolean,
  switchPositionCount: number,
  isLocalMeasurement: boolean,
): OscilloscopeStatus {
  const codes = validation.issues.map((issue) => issue.code)
  const switchedCircuitHasUsablePosition =
    switchPositionCount > 0 && !allSwitchPositionsHaveIssue(validation, switchPositionCount)

  if (codes.includes('missing_ground_reference') || codes.includes('jack_sleeve_missing_ground')) {
    return 'missing-ground'
  }

  if (
    !isLocalMeasurement &&
    (codes.includes('jack_tip_ground_short') ||
      codes.includes('jack_tip_sleeve_short') ||
      codes.includes('signal_ground_short'))
  ) {
    return 'output-shorted'
  }

  if (!hasSource) {
    return 'no-signal-source'
  }

  if (
    allSwitchPositionsHaveIssue(validation, switchPositionCount) &&
    Object.values(validation.bySwitchPosition)
      .flat()
      .some((issue) => issue.code === 'jack_tip_no_signal')
  ) {
    return 'muted-switch-position'
  }

  if (!hasSource && !switchedCircuitHasUsablePosition && codes.includes('jack_tip_no_signal')) {
    return 'no-signal-path'
  }

  if (!hasSource && codes.includes('important_pin_floating')) {
    return 'floating-output'
  }

  return 'signal-ok'
}

export function estimateOutputSignal(input: EstimateOutputSignalInput): OscilloscopeReading {
  const source = findActiveSource(input.components)
  const params = source?.params ?? {
    waveform: 'sine' as const,
    frequencyHz: 440,
    amplitudeVolts: 0,
    durationMs: 20,
  }
  const frequencyHz = params.frequencyHz || 440
  const durationMs = input.durationMs ?? params.durationMs ?? 20
  const sampleCount = input.sampleCount ?? 160
  const signalPath = source ? findUsableSignalPath(input, source) : undefined
  const hasSource = Boolean(signalPath)
  const status = statusFromValidation(
    input.validation,
    hasSource,
    input.switchPositions?.length ?? 0,
    Boolean(input.measurementPin || input.measureAtSource),
  )
  const isFlat = status !== 'signal-ok'
  const toneProfile = estimateToneProfile(input.components)
  const referenceAmplitudeVolts =
    params.amplitudeVolts * estimateLoadAttenuation(input.components)
  const amplitudeVolts =
    referenceAmplitudeVolts *
    estimateVolumeAttenuation(input.components, signalPath)
  const points = isFlat
    ? generateFlatLine(durationMs, sampleCount)
    : generateWaveform(
        params.waveform,
        frequencyHz,
        amplitudeVolts,
        durationMs,
        sampleCount,
        toneProfile.highFrequencyDamping,
      )

  return {
    status,
    statusLabel: statusLabels[status],
    message:
      status === 'signal-ok'
        ? source?.kind === 'strings'
          ? 'El excitador de cuerdas aplica señal conceptual a las pastillas conectadas.'
          : 'El generador esta conectado a una ruta de salida valida. La onda es una estimacion conceptual.'
        : status === 'no-signal-source'
          ? 'El osciloscopio queda en cero hasta conectar un generador o agregar un excitador de cuerdas.'
        : 'El osciloscopio muestra linea plana porque la salida no esta lista para entregar señal.',
    isFlat,
    frequencyHz,
    amplitudeVolts: isFlat ? 0 : amplitudeVolts,
    referenceAmplitudeVolts,
    durationMs,
    points,
  }
}
