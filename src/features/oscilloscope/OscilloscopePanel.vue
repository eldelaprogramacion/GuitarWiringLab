<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import type { CircuitComponent, PinRef } from '@/domain/components/circuit-component'
import { estimateOutputSignal } from './estimateOutputSignal'
import SignalGeneratorConfig from './SignalGeneratorConfig.vue'
import { useCircuitStore } from '@/stores/circuit.store'

const circuitStore = useCircuitStore()
const { components, activeConnections, selectedComponent, switchPositions, validation } =
  storeToRefs(circuitStore)

function pinRef(component: CircuitComponent, pinId: string): PinRef {
  return {
    componentId: String(component.id),
    pinId,
  }
}

function selectedMeasurementPin(component?: CircuitComponent): PinRef | undefined {
  if (!component) {
    return undefined
  }

  if (component.type === 'pickup') {
    return pinRef(
      component,
      component.params.coilCount === 1 || component.params.conductorMode === '2_conductor'
        ? 'hot'
        : 'north_start',
    )
  }

  if (component.type === 'potentiometer') {
    return pinRef(component, 'out')
  }

  if (component.type === 'mono_jack') {
    return pinRef(component, 'tip')
  }

  if (component.type === 'oscilloscope_probe') {
    return pinRef(component, 'positive')
  }

  if (component.type === 'signal_generator') {
    return pinRef(component, 'output')
  }

  if (
    component.type === 'switch' ||
    component.type === 'selector'
  ) {
    return pinRef(component, 'common')
  }

  const firstSignalPin = component.pins.find(
    (pin) =>
      pin.role === 'signal' ||
      pin.role === 'probe_positive' ||
      pin.role === 'pot_wiper' ||
      pin.role === 'switch_common',
  )

  return firstSignalPin ? pinRef(component, String(firstSignalPin.id)) : undefined
}

const measurementPin = computed(() => selectedMeasurementPin(selectedComponent.value))
const measureAtSource = computed(() => selectedComponent.value?.type === 'string_exciter')

function measurementPinLabel(pinId: string): string {
  const labels: Record<string, string> = {
    hot: 'Vivo',
    north_start: 'Norte inicio',
    output: 'Salida',
    out: 'Salida',
    tip: 'Punta',
    positive: 'Positivo',
    common: 'Comun',
  }

  return labels[pinId] ?? pinId
}

const measurementLabel = computed(() => {
  if (measureAtSource.value) {
    return 'Fuente'
  }

  if (selectedComponent.value && measurementPin.value) {
    return `${selectedComponent.value.label}.${measurementPinLabel(measurementPin.value.pinId)}`
  }

  return 'Salida'
})

const reading = computed(() =>
  estimateOutputSignal({
    components: components.value,
    connections: activeConnections.value,
    switchPositions: switchPositions.value,
    measurementPin: measurementPin.value,
    measureAtSource: measureAtSource.value,
    validation: validation.value,
  }),
)

const waveformPath = computed(() => {
  const width = 280
  const height = 96
  const centerY = height / 2
  const verticalScale = Math.max(0.001, reading.value.referenceAmplitudeVolts)

  return reading.value.points
    .map((point, index) => {
      const x = (point.timeMs / reading.value.durationMs) * width
      const normalizedVoltage = Math.max(-1, Math.min(1, point.voltage / verticalScale))
      const y = centerY - normalizedVoltage * (height * 0.42)

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
})
</script>

<template>
  <section class="oscilloscope-panel" aria-labelledby="scope-title">
    <div class="oscilloscope-panel__header">
      <p>Medicion virtual</p>
      <h2 id="scope-title">Osciloscopio</h2>
    </div>

    <div class="oscilloscope-panel__screen" :class="{ 'oscilloscope-panel__screen--flat': reading.isFlat }">
      <svg viewBox="0 0 280 96" role="img" aria-label="Onda del osciloscopio">
        <line x1="0" y1="48" x2="280" y2="48" class="oscilloscope-panel__axis" />
        <path :d="waveformPath" class="oscilloscope-panel__wave" />
      </svg>
    </div>

    <div class="oscilloscope-panel__status">
      <strong>{{ reading.statusLabel }}</strong>
      <span>{{ reading.message }}</span>
      <small>
        {{ measurementLabel }} ·
        {{ reading.frequencyHz }} Hz · {{ reading.amplitudeVolts.toFixed(3) }} V
      </small>
    </div>

    <SignalGeneratorConfig />
  </section>
</template>

<style scoped>
.oscilloscope-panel {
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.oscilloscope-panel__header p,
.oscilloscope-panel__header h2 {
  margin: 0;
}

.oscilloscope-panel__header p {
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.oscilloscope-panel__header h2 {
  color: var(--color-text);
  font-size: 1rem;
}

.oscilloscope-panel__screen {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #101614;
}

svg {
  display: block;
  width: 100%;
  height: auto;
}

.oscilloscope-panel__axis {
  stroke: rgb(244 239 229 / 18%);
  stroke-width: 1;
}

.oscilloscope-panel__wave {
  fill: none;
  stroke: var(--color-success);
  stroke-width: 2.2;
}

.oscilloscope-panel__screen--flat .oscilloscope-panel__wave {
  stroke: var(--color-muted);
}

.oscilloscope-panel__status {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel-strong);
}

.oscilloscope-panel__status strong {
  color: var(--color-success);
  font-size: 0.88rem;
}

.oscilloscope-panel__status span,
.oscilloscope-panel__status small {
  color: var(--color-muted);
  font-size: 0.82rem;
  line-height: 1.35;
}
</style>
