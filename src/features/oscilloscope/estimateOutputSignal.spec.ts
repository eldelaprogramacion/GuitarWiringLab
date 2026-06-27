import {
  createGround,
  createMonoJack,
  createPickup,
  createPotentiometer,
  createCapacitor,
  createOscilloscopeProbe,
  createSignalGenerator,
  createStringExciter,
} from '@/domain/components/component-factories'
import type { CircuitComponent } from '@/domain/components/circuit-component'
import { buildCircuitGraph } from '@/domain/graph/circuit-graph'
import { loadPreset } from '@/features/presets/presetLibrary'
import { validateCircuit } from '@/features/validators/electrical-validator'
import { estimateOutputSignal } from './estimateOutputSignal'

const wire = (
  id: string,
  fromComponentId: string,
  fromPinId: string,
  toComponentId: string,
  toPinId: string,
) => ({
  id,
  color: '#111111',
  from: { componentId: fromComponentId, pinId: fromPinId },
  to: { componentId: toComponentId, pinId: toPinId },
})

function readingFor(connections: ReturnType<typeof wire>[]) {
  const components = [
    createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
    createPickup({ id: 'pickup' }),
    createPotentiometer({ id: 'volume', params: { position: 0.5, resistanceOhms: 250000 } }),
    createMonoJack({ id: 'jack' }),
    createGround({ id: 'ground' }),
  ]
  const graph = buildCircuitGraph(components, connections)
  const validation = validateCircuit({ components, connections, graph })

  return estimateOutputSignal({ components, connections, validation, sampleCount: 24 })
}

describe('estimateOutputSignal', () => {
  it('keeps the output flat when a valid guitar circuit has no real excitation source', () => {
    const components = [
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 250000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'pickup', 'hot', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
    ]
    const graph = buildCircuitGraph(components, connections)
    const validation = validateCircuit({ components, connections, graph })
    const reading = estimateOutputSignal({ components, connections, validation, sampleCount: 24 })

    expect(reading.status).toBe('no-signal-source')
    expect(reading.isFlat).toBe(true)
    expect(reading.amplitudeVolts).toBe(0)
  })

  it('returns a conceptual sine wave when output is valid', () => {
    const reading = readingFor([
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'pickup', 'hot', 'volume', 'in'),
      wire('w3', 'volume', 'out', 'jack', 'tip'),
      wire('w4', 'pickup', 'ground', 'ground', 'ground'),
      wire('w5', 'pickup', 'shield', 'ground', 'ground'),
      wire('w6', 'volume', 'ground', 'ground', 'ground'),
      wire('w7', 'jack', 'sleeve', 'ground', 'ground'),
      wire('w8', 'generator', 'reference', 'ground', 'ground'),
    ])

    expect(reading.status).toBe('signal-ok')
    expect(reading.isFlat).toBe(false)
    expect(reading.points.some((point) => point.voltage !== 0)).toBe(true)
    expect(reading.amplitudeVolts).toBeGreaterThan(0)
    expect(reading.amplitudeVolts).toBeLessThan(1)
  })

  it('keeps the output flat when the signal generator is not connected to the circuit', () => {
    const components = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 250000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'pickup', 'hot', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
      wire('w7', 'generator', 'reference', 'ground', 'ground'),
    ]
    const graph = buildCircuitGraph(components, connections)
    const validation = validateCircuit({ components, connections, graph })
    const reading = estimateOutputSignal({ components, connections, validation, sampleCount: 24 })

    expect(reading.status).toBe('no-signal-source')
    expect(reading.isFlat).toBe(true)
  })

  it('returns a flat line when the jack output is shorted', () => {
    const reading = readingFor([
      wire('w1', 'jack', 'tip', 'jack', 'sleeve'),
      wire('w2', 'jack', 'sleeve', 'ground', 'ground'),
    ])

    expect(reading.status).toBe('output-shorted')
    expect(reading.isFlat).toBe(true)
    expect(reading.points.every((point) => point.voltage === 0)).toBe(true)
  })

  it('returns a flat line when there is no signal path', () => {
    const reading = readingFor([
      wire('w1', 'jack', 'sleeve', 'ground', 'ground'),
      wire('w2', 'pickup', 'ground', 'ground', 'ground'),
    ])

    expect(reading.status).toBe('no-signal-source')
    expect(reading.isFlat).toBe(true)
  })

  it('uses a string exciter without requiring generator wires', () => {
    const components = [
      createStringExciter({
        id: 'strings',
        params: { waveform: 'triangle', frequencyHz: 220, amplitudeVolts: 0.8 },
      }),
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'pickup', 'hot', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
    ]
    const graph = buildCircuitGraph(components, connections)
    const validation = validateCircuit({ components, connections, graph })
    const reading = estimateOutputSignal({ components, connections, validation, sampleCount: 24 })

    expect(reading.status).toBe('signal-ok')
    expect(reading.isFlat).toBe(false)
    expect(reading.frequencyHz).toBe(220)
    expect(reading.amplitudeVolts).toBeGreaterThan(0)
  })

  it('lets the string exciter drive a preset that needs selector position connections', () => {
    const preset = loadPreset('sss-selector-vol-tone-jack')
    const components: CircuitComponent[] = [
      createStringExciter({
        id: 'strings',
        params: { waveform: 'sine', frequencyHz: 330, amplitudeVolts: 0.5 },
      }),
      ...preset.components,
    ]
    const switchPositions = preset.switchPositions.map((switchPosition) => ({
      id: switchPosition.id,
      switchId: switchPosition.switchId,
      label: switchPosition.label,
      position: switchPosition.position,
      graph: buildCircuitGraph(components, [
        ...preset.connections,
        ...switchPosition.activeConnections,
      ]),
    }))
    const graph = buildCircuitGraph(components, preset.connections)
    const validation = validateCircuit({
      components,
      connections: preset.connections,
      graph,
      switchPositions,
    })
    const reading = estimateOutputSignal({
      components,
      connections: preset.connections,
      switchPositions: preset.switchPositions,
      validation,
      sampleCount: 24,
    })

    expect(reading.status).toBe('signal-ok')
    expect(reading.isFlat).toBe(false)
  })

  it('attenuates amplitude when the volume position is lowered', () => {
    const loud = readingFor([
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
      wire('w7', 'generator', 'reference', 'ground', 'ground'),
    ])
    const components = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 0.25, resistanceOhms: 250000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
      wire('w7', 'generator', 'reference', 'ground', 'ground'),
    ]
    const graph = buildCircuitGraph(components, connections)
    const validation = validateCircuit({ components, connections, graph })
    const quiet = estimateOutputSignal({ components, connections, validation, sampleCount: 24 })

    expect(quiet.amplitudeVolts).toBeLessThan(loud.amplitudeVolts)
  })

  it('attenuates an oscilloscope probe placed after the volume pot', () => {
    const components = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPotentiometer({ id: 'volume', params: { position: 0.3, resistanceOhms: 500000 } }),
      createOscilloscopeProbe({ id: 'scope' }),
      createGround({ id: 'ground' }),
    ]
    const loudComponents = components.map((component) =>
      String(component.id) === 'volume'
        ? createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } })
        : component,
    )
    const connections = [
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'scope', 'positive'),
      wire('w3', 'generator', 'reference', 'ground', 'ground'),
      wire('w4', 'scope', 'reference', 'ground', 'ground'),
    ]
    const quietGraph = buildCircuitGraph(components, connections)
    const quietValidation = validateCircuit({ components, connections, graph: quietGraph })
    const loudGraph = buildCircuitGraph(loudComponents, connections)
    const loudValidation = validateCircuit({
      components: loudComponents,
      connections,
      graph: loudGraph,
    })
    const quiet = estimateOutputSignal({
      components,
      connections,
      measurementPin: { componentId: 'scope', pinId: 'positive' },
      validation: quietValidation,
      sampleCount: 24,
    })
    const loud = estimateOutputSignal({
      components: loudComponents,
      connections,
      measurementPin: { componentId: 'scope', pinId: 'positive' },
      validation: loudValidation,
      sampleCount: 24,
    })

    expect(quiet.status).toBe('signal-ok')
    expect(loud.status).toBe('signal-ok')
    expect(quiet.amplitudeVolts).toBeLessThan(loud.amplitudeVolts)
    expect(quiet.referenceAmplitudeVolts).toBe(loud.referenceAmplitudeVolts)
  })

  it('applies different attenuation curves for linear, audio, and reverse audio pots', () => {
    const readingWithTaper = (taper: 'linear' | 'audio' | 'reverse_audio') => {
      const components = [
        createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
        createPotentiometer({
          id: 'volume',
          params: { position: 0.5, resistanceOhms: 500000, taper },
        }),
        createOscilloscopeProbe({ id: 'scope' }),
        createGround({ id: 'ground' }),
      ]
      const connections = [
        wire('w1', 'generator', 'output', 'volume', 'in'),
        wire('w2', 'volume', 'out', 'scope', 'positive'),
        wire('w3', 'generator', 'reference', 'ground', 'ground'),
        wire('w4', 'scope', 'reference', 'ground', 'ground'),
      ]
      const graph = buildCircuitGraph(components, connections)

      return estimateOutputSignal({
        components,
        connections,
        measurementPin: { componentId: 'scope', pinId: 'positive' },
        validation: validateCircuit({ components, connections, graph }),
        sampleCount: 24,
      })
    }

    const audio = readingWithTaper('audio')
    const linear = readingWithTaper('linear')
    const reverseAudio = readingWithTaper('reverse_audio')

    expect(audio.status).toBe('signal-ok')
    expect(linear.status).toBe('signal-ok')
    expect(reverseAudio.status).toBe('signal-ok')
    expect(audio.amplitudeVolts).toBeLessThan(linear.amplitudeVolts)
    expect(linear.amplitudeVolts).toBeLessThan(reverseAudio.amplitudeVolts)
  })

  it('does not attenuate an oscilloscope probe placed before the volume pot', () => {
    const quietComponents = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPotentiometer({ id: 'volume', params: { position: 0.2, resistanceOhms: 500000 } }),
      createOscilloscopeProbe({ id: 'scope' }),
      createGround({ id: 'ground' }),
    ]
    const loudComponents = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
      createOscilloscopeProbe({ id: 'scope' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'volume', 'in', 'scope', 'positive'),
      wire('w3', 'generator', 'reference', 'ground', 'ground'),
      wire('w4', 'scope', 'reference', 'ground', 'ground'),
    ]
    const quietGraph = buildCircuitGraph(quietComponents, connections)
    const loudGraph = buildCircuitGraph(loudComponents, connections)
    const quiet = estimateOutputSignal({
      components: quietComponents,
      connections,
      measurementPin: { componentId: 'scope', pinId: 'positive' },
      validation: validateCircuit({ components: quietComponents, connections, graph: quietGraph }),
      sampleCount: 24,
    })
    const loud = estimateOutputSignal({
      components: loudComponents,
      connections,
      measurementPin: { componentId: 'scope', pinId: 'positive' },
      validation: validateCircuit({ components: loudComponents, connections, graph: loudGraph }),
      sampleCount: 24,
    })

    expect(quiet.status).toBe('signal-ok')
    expect(loud.status).toBe('signal-ok')
    expect(quiet.amplitudeVolts).toBe(loud.amplitudeVolts)
  })

  it('does not let a post-volume probe attenuate a pre-volume probe reading', () => {
    const quietComponents = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPotentiometer({ id: 'volume', params: { position: 0.2, resistanceOhms: 500000 } }),
      createOscilloscopeProbe({ id: 'scope-before' }),
      createOscilloscopeProbe({ id: 'scope-after' }),
      createGround({ id: 'ground' }),
    ]
    const loudComponents = [
      createSignalGenerator({ id: 'generator', params: { frequencyHz: 440, amplitudeVolts: 1 } }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
      createOscilloscopeProbe({ id: 'scope-before' }),
      createOscilloscopeProbe({ id: 'scope-after' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'volume', 'in', 'scope-before', 'positive'),
      wire('w3', 'volume', 'out', 'scope-after', 'positive'),
      wire('w4', 'generator', 'reference', 'ground', 'ground'),
      wire('w5', 'scope-before', 'reference', 'ground', 'ground'),
      wire('w6', 'scope-after', 'reference', 'ground', 'ground'),
    ]
    const quietGraph = buildCircuitGraph(quietComponents, connections)
    const loudGraph = buildCircuitGraph(loudComponents, connections)
    const quietBefore = estimateOutputSignal({
      components: quietComponents,
      connections,
      measurementPin: { componentId: 'scope-before', pinId: 'positive' },
      validation: validateCircuit({ components: quietComponents, connections, graph: quietGraph }),
      sampleCount: 24,
    })
    const loudBefore = estimateOutputSignal({
      components: loudComponents,
      connections,
      measurementPin: { componentId: 'scope-before', pinId: 'positive' },
      validation: validateCircuit({ components: loudComponents, connections, graph: loudGraph }),
      sampleCount: 24,
    })
    const quietAfter = estimateOutputSignal({
      components: quietComponents,
      connections,
      measurementPin: { componentId: 'scope-after', pinId: 'positive' },
      validation: validateCircuit({ components: quietComponents, connections, graph: quietGraph }),
      sampleCount: 24,
    })

    expect(quietBefore.status).toBe('signal-ok')
    expect(loudBefore.status).toBe('signal-ok')
    expect(quietBefore.amplitudeVolts).toBe(loudBefore.amplitudeVolts)
    expect(quietAfter.amplitudeVolts).toBeLessThan(quietBefore.amplitudeVolts)
  })

  it('does not attenuate the pickup source reading when volume is lowered downstream', () => {
    const quietComponents = [
      createStringExciter({
        id: 'strings',
        params: { waveform: 'sine', frequencyHz: 440, amplitudeVolts: 1 },
      }),
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 0.2, resistanceOhms: 500000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const loudComponents = [
      createStringExciter({
        id: 'strings',
        params: { waveform: 'sine', frequencyHz: 440, amplitudeVolts: 1 },
      }),
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'pickup', 'hot', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
    ]
    const quietGraph = buildCircuitGraph(quietComponents, connections)
    const loudGraph = buildCircuitGraph(loudComponents, connections)
    const quietPickup = estimateOutputSignal({
      components: quietComponents,
      connections,
      measurementPin: { componentId: 'pickup', pinId: 'hot' },
      validation: validateCircuit({ components: quietComponents, connections, graph: quietGraph }),
      sampleCount: 24,
    })
    const loudPickup = estimateOutputSignal({
      components: loudComponents,
      connections,
      measurementPin: { componentId: 'pickup', pinId: 'hot' },
      validation: validateCircuit({ components: loudComponents, connections, graph: loudGraph }),
      sampleCount: 24,
    })

    expect(quietPickup.status).toBe('signal-ok')
    expect(loudPickup.status).toBe('signal-ok')
    expect(quietPickup.amplitudeVolts).toBe(loudPickup.amplitudeVolts)
  })

  it.each(['multi_frequency', 'white_noise', 'pink_noise'] as const)(
    'generates %s samples',
    (waveform) => {
    const components = [
      createSignalGenerator({
        id: 'generator',
        params: { waveform, frequencyHz: 440, amplitudeVolts: 1 },
      }),
      createPickup({ id: 'pickup' }),
      createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
      createMonoJack({ id: 'jack' }),
      createGround({ id: 'ground' }),
    ]
    const connections = [
      wire('w1', 'generator', 'output', 'volume', 'in'),
      wire('w2', 'volume', 'out', 'jack', 'tip'),
      wire('w3', 'pickup', 'ground', 'ground', 'ground'),
      wire('w4', 'pickup', 'shield', 'ground', 'ground'),
      wire('w5', 'volume', 'ground', 'ground', 'ground'),
      wire('w6', 'jack', 'sleeve', 'ground', 'ground'),
      wire('w7', 'generator', 'reference', 'ground', 'ground'),
    ]
    const graph = buildCircuitGraph(components, connections)
    const validation = validateCircuit({ components, connections, graph })
    const reading = estimateOutputSignal({ components, connections, validation, sampleCount: 24 })
    const uniqueVoltages = new Set(reading.points.map((point) => point.voltage.toFixed(6)))

      expect(reading.status).toBe('signal-ok')
      expect(uniqueVoltages.size).toBeGreaterThan(4)
    },
  )

  it('lets tone controls damp high partials in multifrequency readings', () => {
    const readingWithTonePosition = (position: number) => {
      const components = [
        createStringExciter({
          id: 'strings',
          params: { waveform: 'multi_frequency', frequencyHz: 220, amplitudeVolts: 1 },
        }),
        createPickup({ id: 'pickup' }),
        createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
        createPotentiometer({
          id: 'tone',
          label: 'Tone 250k',
          params: { position, resistanceOhms: 250000 },
        }),
        createMonoJack({ id: 'jack' }),
        createGround({ id: 'ground' }),
      ]
      const capacitor = createCapacitor({
        id: 'tone-capacitor',
        label: 'Condensador de tono',
        params: { capacitanceFarads: 47e-9 },
      })
      const circuitComponents = [...components, capacitor]
      const connections = [
        wire('w1', 'pickup', 'hot', 'volume', 'in'),
        wire('w2', 'volume', 'out', 'jack', 'tip'),
        wire('w3', 'volume', 'out', 'tone', 'in'),
        wire('w4', 'tone', 'out', 'tone-capacitor', 'a'),
        wire('w5', 'tone-capacitor', 'b', 'ground', 'ground'),
        wire('w6', 'pickup', 'ground', 'ground', 'ground'),
        wire('w7', 'pickup', 'shield', 'ground', 'ground'),
        wire('w8', 'volume', 'ground', 'ground', 'ground'),
        wire('w9', 'tone', 'ground', 'ground', 'ground'),
        wire('w10', 'jack', 'sleeve', 'ground', 'ground'),
      ]
      const graph = buildCircuitGraph(circuitComponents, connections)

      return estimateOutputSignal({
        components: circuitComponents,
        connections,
        validation: validateCircuit({ components: circuitComponents, connections, graph }),
        sampleCount: 96,
      })
    }

    const toneOpen = readingWithTonePosition(1)
    const toneClosed = readingWithTonePosition(0)
    const waveformEnergy = (reading: typeof toneOpen) =>
      reading.points.slice(1).reduce((sum, point, index) => {
        return sum + Math.abs(point.voltage - reading.points[index].voltage)
      }, 0)

    expect(toneOpen.status).toBe('signal-ok')
    expect(toneClosed.status).toBe('signal-ok')
    expect(waveformEnergy(toneClosed)).toBeLessThan(waveformEnergy(toneOpen))
  })

  it('lets tone controls smooth white noise readings at the output', () => {
    const readingWithTonePosition = (position: number) => {
      const components = [
        createStringExciter({
          id: 'strings',
          params: { waveform: 'white_noise', frequencyHz: 440, amplitudeVolts: 1 },
        }),
        createPickup({ id: 'pickup' }),
        createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
        createPotentiometer({
          id: 'tone',
          label: 'Tono 250k',
          params: { position, resistanceOhms: 250000 },
        }),
        createCapacitor({
          id: 'tone-capacitor',
          label: 'Condensador de tono',
          params: { capacitanceFarads: 47e-9 },
        }),
        createMonoJack({ id: 'jack' }),
        createGround({ id: 'ground' }),
      ]
      const connections = [
        wire('w1', 'pickup', 'hot', 'volume', 'in'),
        wire('w2', 'volume', 'out', 'jack', 'tip'),
        wire('w3', 'volume', 'out', 'tone', 'in'),
        wire('w4', 'tone', 'out', 'tone-capacitor', 'a'),
        wire('w5', 'tone-capacitor', 'b', 'ground', 'ground'),
        wire('w6', 'pickup', 'ground', 'ground', 'ground'),
        wire('w7', 'pickup', 'shield', 'ground', 'ground'),
        wire('w8', 'volume', 'ground', 'ground', 'ground'),
        wire('w9', 'tone', 'ground', 'ground', 'ground'),
        wire('w10', 'jack', 'sleeve', 'ground', 'ground'),
      ]
      const graph = buildCircuitGraph(components, connections)

      return estimateOutputSignal({
        components,
        connections,
        validation: validateCircuit({ components, connections, graph }),
        sampleCount: 96,
      })
    }

    const toneOpen = readingWithTonePosition(1)
    const toneClosed = readingWithTonePosition(0)
    const waveformEnergy = (reading: typeof toneOpen) =>
      reading.points.slice(1).reduce((sum, point, index) => {
        return sum + Math.abs(point.voltage - reading.points[index].voltage)
      }, 0)

    expect(toneOpen.status).toBe('signal-ok')
    expect(toneClosed.status).toBe('signal-ok')
    expect(toneClosed.amplitudeVolts).toBe(toneOpen.amplitudeVolts)
    expect(toneClosed.referenceAmplitudeVolts).toBe(toneOpen.referenceAmplitudeVolts)
    expect(waveformEnergy(toneClosed)).toBeLessThan(waveformEnergy(toneOpen) * 0.35)
  })

  it('makes larger tone capacitors remove more high frequency content', () => {
    const readingWithCapacitor = (capacitanceFarads: number) => {
      const components = [
        createStringExciter({
          id: 'strings',
          params: { waveform: 'white_noise', frequencyHz: 440, amplitudeVolts: 1 },
        }),
        createPickup({ id: 'pickup' }),
        createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
        createPotentiometer({
          id: 'tone',
          label: 'Tono 250k',
          params: { position: 0, resistanceOhms: 250000 },
        }),
        createCapacitor({
          id: 'tone-capacitor',
          label: 'Condensador de tono',
          params: { capacitanceFarads },
        }),
        createMonoJack({ id: 'jack' }),
        createGround({ id: 'ground' }),
      ]
      const connections = [
        wire('w1', 'pickup', 'hot', 'volume', 'in'),
        wire('w2', 'volume', 'out', 'jack', 'tip'),
        wire('w3', 'volume', 'out', 'tone', 'in'),
        wire('w4', 'tone', 'out', 'tone-capacitor', 'a'),
        wire('w5', 'tone-capacitor', 'b', 'ground', 'ground'),
        wire('w6', 'pickup', 'ground', 'ground', 'ground'),
        wire('w7', 'pickup', 'shield', 'ground', 'ground'),
        wire('w8', 'volume', 'ground', 'ground', 'ground'),
        wire('w9', 'tone', 'ground', 'ground', 'ground'),
        wire('w10', 'jack', 'sleeve', 'ground', 'ground'),
      ]
      const graph = buildCircuitGraph(components, connections)

      return estimateOutputSignal({
        components,
        connections,
        validation: validateCircuit({ components, connections, graph }),
        sampleCount: 96,
      })
    }

    const smallCap = readingWithCapacitor(2.2e-9)
    const largeCap = readingWithCapacitor(47e-9)
    const waveformEnergy = (reading: typeof smallCap) =>
      reading.points.slice(1).reduce((sum, point, index) => {
        return sum + Math.abs(point.voltage - reading.points[index].voltage)
      }, 0)

    expect(smallCap.status).toBe('signal-ok')
    expect(largeCap.status).toBe('signal-ok')
    expect(largeCap.amplitudeVolts).toBe(smallCap.amplitudeVolts)
    expect(waveformEnergy(largeCap)).toBeLessThan(waveformEnergy(smallCap))
  })

  it('does not treat tone as a global volume control for a simple sine wave', () => {
    const readingWithTonePosition = (position: number) => {
      const components = [
        createStringExciter({
          id: 'strings',
          params: { waveform: 'sine', frequencyHz: 440, amplitudeVolts: 1 },
        }),
        createPickup({ id: 'pickup' }),
        createPotentiometer({ id: 'volume', params: { position: 1, resistanceOhms: 500000 } }),
        createPotentiometer({
          id: 'tone',
          label: 'Tono 250k',
          params: { position, resistanceOhms: 250000 },
        }),
        createCapacitor({
          id: 'tone-capacitor',
          label: 'Condensador de tono',
          params: { capacitanceFarads: 47e-9 },
        }),
        createMonoJack({ id: 'jack' }),
        createGround({ id: 'ground' }),
      ]
      const connections = [
        wire('w1', 'pickup', 'hot', 'volume', 'in'),
        wire('w2', 'volume', 'out', 'jack', 'tip'),
        wire('w3', 'volume', 'out', 'tone', 'in'),
        wire('w4', 'tone', 'out', 'tone-capacitor', 'a'),
        wire('w5', 'tone-capacitor', 'b', 'ground', 'ground'),
        wire('w6', 'pickup', 'ground', 'ground', 'ground'),
        wire('w7', 'pickup', 'shield', 'ground', 'ground'),
        wire('w8', 'volume', 'ground', 'ground', 'ground'),
        wire('w9', 'tone', 'ground', 'ground', 'ground'),
        wire('w10', 'jack', 'sleeve', 'ground', 'ground'),
      ]
      const graph = buildCircuitGraph(components, connections)

      return estimateOutputSignal({
        components,
        connections,
        validation: validateCircuit({ components, connections, graph }),
        sampleCount: 96,
      })
    }

    const toneOpen = readingWithTonePosition(1)
    const toneClosed = readingWithTonePosition(0)

    expect(toneOpen.status).toBe('signal-ok')
    expect(toneClosed.status).toBe('signal-ok')
    expect(toneClosed.amplitudeVolts).toBe(toneOpen.amplitudeVolts)
    expect(toneClosed.points).toEqual(toneOpen.points)
  })
})
