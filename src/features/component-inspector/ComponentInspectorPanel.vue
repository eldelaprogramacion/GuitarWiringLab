<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import {
  capacitorValueOptions,
  pickupCoilCountOptions,
  pickupConductorModeOptions,
  potentiometerResistanceOptions,
  potentiometerTaperOptions,
  switchKindOptions,
  switchModeOptions,
} from '@/domain/components/catalog'
import type { SignalWaveform } from '@/domain/components/circuit-component'
import { useCircuitStore } from '@/stores/circuit.store'

const circuitStore = useCircuitStore()
const { selectedComponent } = storeToRefs(circuitStore)

const paramsEntries = computed(() => {
  if (!selectedComponent.value) {
    return []
  }

  if (selectedComponent.value.type === 'string_exciter') {
    const { waveform, amplitudeVolts, frequencyHz } = selectedComponent.value.params
    const entries: Array<[string, unknown]> = [
      ['waveform', waveform],
      ['amplitudeVolts', amplitudeVolts],
    ]

    if (waveform !== 'white_noise' && waveform !== 'pink_noise') {
      entries.push(['frequencyHz', frequencyHz])
    }

    return entries
  }

  return Object.entries(selectedComponent.value.params).filter(([key]) => {
    const hiddenParams = ['durationMs', 'target', 'poles', 'throws']

    if (selectedComponent.value?.type !== 'string_exciter') {
      hiddenParams.push('waveform')
    }

    if (selectedComponent.value?.type === 'switch' && selectedComponent.value.params.kind === 'DPDT') {
      hiddenParams.push('positions')
    }

    if (selectedComponent.value?.type === 'selector') {
      hiddenParams.push('positions', 'mode')
    }

    return !hiddenParams.includes(key)
  })
})

const paramLabels: Record<string, string> = {
  amplitudeVolts: 'Amplitud',
  capacitanceFarads: 'Capacitancia',
  coilCount: 'Bobinas',
  conductorMode: 'Conductores',
  frequencyHz: 'Frecuencia',
  hasShield: 'Malla',
  impedanceOhms: 'Impedancia',
  kind: 'Tipo',
  magnet: 'Iman',
  northResistanceOhms: 'Resistencia norte',
  poles: 'Polos',
  position: 'Posicion',
  referenceName: 'Referencia',
  resistanceOhms: 'Resistencia',
  southResistanceOhms: 'Resistencia sur',
  taper: 'Curva',
  throws: 'Tiros',
  tolerancePercent: 'Tolerancia',
  voltageRating: 'Voltaje maximo',
  waveform: 'Forma de onda',
}

const componentTypeLabels: Record<string, string> = {
  pickup: 'Pastilla',
  potentiometer: 'Potenciometro',
  capacitor: 'Condensador',
  resistor: 'Resistencia',
  mono_jack: 'Jack mono',
  ground: 'Tierra',
  switch: 'Switch',
  selector: 'Selector',
  oscilloscope_probe: 'Sonda de osciloscopio',
  signal_generator: 'Generador de senal',
  string_exciter: 'Excitador de cuerdas',
}

const componentCategoryLabels: Record<string, string> = {
  pickup: 'Pastillas',
  potentiometer: 'Pasivos',
  capacitor: 'Pasivos',
  resistor: 'Pasivos',
  jack: 'Conectores',
  ground: 'Conectores',
  switch: 'Switches',
  instrument: 'Herramientas',
}

const waveformOptions: Array<{ label: string; value: SignalWaveform }> = [
  { label: 'Senoidal', value: 'sine' },
  { label: 'Cuadrada', value: 'square' },
  { label: 'Triangular', value: 'triangle' },
  { label: 'Multifrecuencia', value: 'multi_frequency' },
  { label: 'Ruido blanco', value: 'white_noise' },
  { label: 'Ruido rosa', value: 'pink_noise' },
]

function updateLabel(event: Event): void {
  if (!selectedComponent.value) {
    return
  }

  circuitStore.updateComponentLabel(
    String(selectedComponent.value.id),
    (event.target as HTMLInputElement).value,
  )
}

function updateParam(key: string, currentValue: unknown, event: Event): void {
  if (!selectedComponent.value) {
    return
  }

  const input = event.target as HTMLInputElement | HTMLSelectElement
  let value: string | number | boolean = input.value

  if (typeof currentValue === 'number') {
    value = Number(input.value)
  }

  if (typeof currentValue === 'boolean') {
    value = (input as HTMLInputElement).checked
  }

  if (selectedComponent.value.type === 'potentiometer' && key === 'position') {
    value = Number(input.value) / 10
  }

  circuitStore.updateComponentParams(String(selectedComponent.value.id), {
    [key]: value,
  })
}

function hasPresetOptions(key: string): boolean {
  return (
    (selectedComponent.value?.type === 'potentiometer' &&
      (key === 'resistanceOhms' || key === 'taper')) ||
    (selectedComponent.value?.type === 'capacitor' && key === 'capacitanceFarads') ||
    (selectedComponent.value?.type === 'pickup' &&
      (key === 'coilCount' || key === 'conductorMode')) ||
    (selectedComponent.value?.type === 'switch' &&
      (key === 'kind' || key === 'position' || key === 'mode')) ||
    (selectedComponent.value?.type === 'selector' && key === 'position') ||
    (selectedComponent.value?.type === 'string_exciter' && key === 'waveform')
  )
}

function optionsForParam(key: string): Array<{ label: string; value: string | number }> {
  if (selectedComponent.value?.type === 'string_exciter' && key === 'waveform') {
    return [...waveformOptions]
  }

  if (selectedComponent.value?.type === 'pickup' && key === 'coilCount') {
    return [...pickupCoilCountOptions]
  }

  if (selectedComponent.value?.type === 'pickup' && key === 'conductorMode') {
    return [...pickupConductorModeOptions]
  }

  if (selectedComponent.value?.type === 'potentiometer' && key === 'resistanceOhms') {
    return [...potentiometerResistanceOptions]
  }

  if (selectedComponent.value?.type === 'potentiometer' && key === 'taper') {
    return [...potentiometerTaperOptions]
  }

  if (selectedComponent.value?.type === 'capacitor' && key === 'capacitanceFarads') {
    return [...capacitorValueOptions]
  }

  if (
    (selectedComponent.value?.type === 'switch' || selectedComponent.value?.type === 'selector') &&
    key === 'position'
  ) {
    const maxPosition = selectedComponent.value.params.positions ?? 1

    return Array.from({ length: maxPosition }, (_, index) => ({
      label: `Posicion ${index + 1}`,
      value: index + 1,
    }))
  }

  if (selectedComponent.value?.type === 'switch' && key === 'kind') {
    return [...switchKindOptions]
  }

  if (selectedComponent.value?.type === 'switch' && key === 'mode') {
    return [...switchModeOptions]
  }

  return []
}

function isPotPosition(key: string): boolean {
  return selectedComponent.value?.type === 'potentiometer' && key === 'position'
}

function paramLabel(key: string): string {
  return paramLabels[key] ?? key
}

function typeLabel(type: string): string {
  return componentTypeLabels[type] ?? type
}

function categoryLabel(category: string): string {
  return componentCategoryLabels[category] ?? category
}

function pinRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    signal: 'senal',
    ground: 'tierra',
    shield: 'malla',
    pickup_coil_start: 'inicio de bobina',
    pickup_coil_finish: 'fin de bobina',
    pot_lug: 'terminal',
    pot_wiper: 'cursor',
    switch_common: 'comun',
    switch_throw: 'tiro',
    jack_tip: 'punta',
    jack_sleeve: 'manga',
    probe_positive: 'positivo',
    probe_reference: 'referencia',
  }

  return labels[role] ?? role
}

function electricalTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    passive_signal: 'senal pasiva',
    ground_reference: 'referencia a tierra',
    shield_drain: 'drenaje de malla',
    resistive: 'resistivo',
    capacitive: 'capacitivo',
    switch_contact: 'contacto',
    measurement: 'medicion',
  }

  return labels[type] ?? type
}

function potDisplayPosition(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : 1
  const normalizedValue = Math.min(1, Math.max(0, numericValue))

  return Number((normalizedValue * 10).toFixed(1))
}
</script>

<template>
  <section class="inspector-panel" aria-labelledby="inspector-title">
    <div class="inspector-panel__header">
      <p>Inspector</p>
      <h2 id="inspector-title">Componente</h2>
    </div>

    <p v-if="!selectedComponent" class="inspector-panel__empty">
      Selecciona un nodo para editar sus propiedades.
    </p>

    <div v-else class="inspector-panel__content">
      <label>
        <span>Nombre</span>
        <input :value="selectedComponent.label" @input="updateLabel" />
      </label>

      <div class="inspector-panel__meta">
        <strong>{{ typeLabel(selectedComponent.type) }}</strong>
        <span>{{ categoryLabel(selectedComponent.category) }}</span>
      </div>

      <div class="inspector-panel__section">
        <h3>Valores electricos</h3>
        <label v-for="[key, value] in paramsEntries" :key="key">
          <span>{{ paramLabel(key) }}</span>
          <select
            v-if="hasPresetOptions(key)"
            :value="String(value)"
            @change="updateParam(key, value, $event)"
          >
            <option
              v-for="option in optionsForParam(key)"
              :key="String(option.value)"
              :value="String(option.value)"
            >
              {{ option.label }}
            </option>
          </select>
          <input
            v-else-if="typeof value === 'boolean'"
            type="checkbox"
            class="inspector-panel__checkbox"
            :checked="value"
            @change="updateParam(key, value, $event)"
          />
          <input
            v-else-if="isPotPosition(key)"
            type="range"
            min="0"
            max="10"
            step="0.1"
            :value="potDisplayPosition(value)"
            @input="updateParam(key, value, $event)"
          />
          <input
            v-else-if="typeof value === 'number'"
            type="number"
            :value="value"
            :min="key === 'position' ? 0 : undefined"
            :max="key === 'position' ? 10 : undefined"
            step="any"
            @input="updateParam(key, value, $event)"
          />
          <input
            v-else
            :value="String(value)"
            @input="updateParam(key, value, $event)"
          />
        </label>
      </div>

      <div v-if="selectedComponent.category === 'switch'" class="inspector-panel__section">
        <h3>Switch</h3>
        <p>La posicion actual tambien se puede cambiar desde el nodo del workspace.</p>
      </div>

      <div class="inspector-panel__section">
        <h3>Pins</h3>
        <ul>
          <li v-for="pin in selectedComponent.pins" :key="pin.id">
            <strong>{{ pin.name }}</strong>
            <span>{{ pinRoleLabel(pin.role) }} - {{ electricalTypeLabel(pin.electricalType) }}</span>
          </li>
        </ul>
      </div>

      <button type="button" @click="circuitStore.removeComponent(String(selectedComponent.id))">
        Eliminar componente
      </button>
    </div>
  </section>
</template>

<style scoped>
.inspector-panel,
.inspector-panel__content,
.inspector-panel__section {
  display: grid;
  gap: 12px;
}

.inspector-panel__header p,
.inspector-panel__header h2,
.inspector-panel__empty,
.inspector-panel__section h3 {
  margin: 0;
}

.inspector-panel__header p {
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.inspector-panel__header h2,
.inspector-panel__section h3 {
  color: var(--color-text);
  font-size: 1rem;
}

.inspector-panel__empty,
.inspector-panel__meta span,
.inspector-panel li span {
  color: var(--color-muted);
  font-size: 0.84rem;
}

label {
  display: grid;
  gap: 5px;
}

label span {
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

input,
select {
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  background: #151513;
}

.inspector-panel__checkbox {
  justify-self: start;
  width: 18px;
  min-height: 18px;
  accent-color: var(--color-accent);
}

.inspector-panel__meta {
  display: grid;
  gap: 2px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel-strong);
}

ul {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

li {
  display: grid;
  gap: 2px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel-strong);
}

button {
  min-height: 36px;
  border: 1px solid rgb(238 118 93 / 55%);
  border-radius: 8px;
  color: #17130c;
  background: var(--color-danger);
  font-weight: 700;
}
</style>
