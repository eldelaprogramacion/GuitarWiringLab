<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import type { CircuitComponent, SignalWaveform } from '@/domain/components/circuit-component'
import { useCircuitStore } from '@/stores/circuit.store'

const circuitStore = useCircuitStore()
const { selectedComponent } = storeToRefs(circuitStore)

const activeGenerator = computed(
  (): CircuitComponent<'signal_generator'> | undefined => {
    if (selectedComponent.value?.type === 'signal_generator') {
      return selectedComponent.value
    }

    return undefined
  },
)

const waveformOptions: Array<{ label: string; value: SignalWaveform }> = [
  { label: 'Senoidal', value: 'sine' },
  { label: 'Cuadrada', value: 'square' },
  { label: 'Triangular', value: 'triangle' },
  { label: 'Multifrecuencia', value: 'multi_frequency' },
  { label: 'Ruido blanco', value: 'white_noise' },
  { label: 'Ruido rosa', value: 'pink_noise' },
]

function updateParam(key: 'waveform' | 'frequencyHz' | 'amplitudeVolts', event: Event): void {
  if (!activeGenerator.value) {
    return
  }

  const input = event.target as HTMLInputElement | HTMLSelectElement
  const value = key === 'waveform' ? input.value : Number(input.value)

  circuitStore.updateComponentParams(String(activeGenerator.value.id), {
    [key]: value,
  })
}
</script>

<template>
  <section v-if="activeGenerator" class="signal-generator-config">
    <h3>Generador de señal</h3>

    <div class="signal-generator-config__fields">
      <p>Fuente electrica virtual: conecta salida a la señal y referencia a tierra.</p>

      <label>
        <span>Forma de onda</span>
        <select
          :value="activeGenerator.params.waveform"
          @change="updateParam('waveform', $event)"
        >
          <option
            v-for="option in waveformOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label>
        <span>Frecuencia</span>
        <input
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          :value="activeGenerator.params.frequencyHz"
          @input="updateParam('frequencyHz', $event)"
        />
      </label>

      <label>
        <span>Amplitud</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          :value="activeGenerator.params.amplitudeVolts"
          @input="updateParam('amplitudeVolts', $event)"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.signal-generator-config,
.signal-generator-config__fields {
  display: grid;
  gap: 10px;
}

h3,
p {
  margin: 0;
}

h3 {
  color: var(--color-text);
  font-size: 0.95rem;
}

p {
  color: var(--color-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

label {
  display: grid;
  gap: 5px;
}

label span {
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

input,
select {
  width: 100%;
  min-height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  background: #151513;
}
</style>
