<script setup lang="ts">
import type { CircuitPin, PinRole } from '@/domain/components/component-terminal'
import type { CircuitNodeData } from '@/features/circuit-engine/circuit-node-data'
import { useCircuitStore } from '@/stores/circuit.store'
import ComponentSchematicIcon from './ComponentSchematicIcon.vue'
import PinHandle from './PinHandle.vue'

const props = defineProps<{
  data: CircuitNodeData
  selected?: boolean
}>()

const circuitStore = useCircuitStore()

const pinRoleLabels: Record<PinRole, string> = {
  signal: 'S',
  ground: 'G',
  shield: 'SH',
  pickup_coil_start: 'S',
  pickup_coil_finish: 'G',
  pot_lug: 'L',
  pot_wiper: 'W',
  switch_common: 'C',
  switch_throw: 'T',
  jack_tip: 'T',
  jack_sleeve: 'SL',
  probe_positive: '+',
  probe_reference: 'REF',
}

function pinRoleCode(pin: CircuitPin): string {
  return pinRoleLabels[pin.role]
}

function pinRoleClass(pin: CircuitPin): string {
  return `pin-symbol--${pin.role.replaceAll('_', '-')}`
}

function pinNameColor(pin: CircuitPin, data: CircuitNodeData): string {
  if (isGroundBusPin(pin)) {
    return '#000000'
  }

  return data.pinConnectionColors[String(pin.id)] ?? '#000000'
}

function isGroundBusPin(pin: CircuitPin): boolean {
  const pinId = String(pin.id)

  return (
    pinId === 'ground' ||
    pinId === 'sleeve' ||
    pinId === 'shield' ||
    pin.role === 'ground' ||
    pin.role === 'shield' ||
    pin.role === 'jack_sleeve' ||
    pin.electricalType === 'ground_reference' ||
    pin.electricalType === 'shield_drain'
  )
}

function pinDisplayName(pin: CircuitPin): string {
  const pinId = String(pin.id)
  const displayNames: Record<string, string> = {
    hot: 'signal',
    north_start: 'north start',
    north_finish: 'north finish',
    south_start: 'south start',
    south_finish: 'south finish',
    shield: 'shield',
    ground: 'ground',
    sleeve: 'sleeve',
    tip: 'tip',
    positive: 'positive',
    reference: 'reference',
    output: 'out',
    common: 'common',
    throw_a: 'throw A',
    throw_b: 'throw B',
    pole_a_common: 'common 1',
    pole_a_throw_a: 'throw A1',
    pole_a_throw_b: 'throw B1',
    pole_b_common: 'common 2',
    pole_b_throw_a: 'throw A2',
    pole_b_throw_b: 'throw B2',
    bridge: 'bridge',
    middle: 'middle',
    neck: 'neck',
    in: 'in',
    out: 'out',
    a: 'A',
    b: 'B',
  }

  return displayNames[pinId] ?? pin.name
}

function componentTooltip(data: CircuitNodeData): string {
  return `${data.component.label}\n${data.component.type} - ${data.component.category}`
}

function isPotentiometer(data: CircuitNodeData): boolean {
  return data.component.type === 'potentiometer'
}

function isSwitchLike(data: CircuitNodeData): boolean {
  return (
    data.component.type === 'switch' ||
    data.component.type === 'selector'
  )
}

function switchPositionOptions(data: CircuitNodeData): number[] {
  if (!isSwitchLike(data)) {
    return []
  }

  return Array.from({ length: data.component.params.positions }, (_, index) => index + 1)
}

function potDisplayPosition(position?: number): number {
  const normalizedPosition = Math.min(1, Math.max(0, position ?? 1))

  return Number((normalizedPosition * 10).toFixed(1))
}

function updatePotPosition(event: Event): void {
  const input = event.target as HTMLInputElement

  circuitStore.updateComponentParams(String(props.data.component.id), {
    position: Number(input.value) / 10,
  })
}

function updateSwitchPosition(event: Event): void {
  const input = event.target as HTMLSelectElement

  circuitStore.updateComponentParams(String(props.data.component.id), {
    position: Number(input.value),
  })
}
</script>

<template>
  <div
    class="circuit-node"
    :class="{ 'circuit-node--selected': selected }"
    :title="componentTooltip(data)"
  >
    <div class="circuit-node__header">
      <span class="circuit-node__label">{{ data.component.label }}</span>
      <ComponentSchematicIcon :component="data.component" />
    </div>

    <div
      v-if="isPotentiometer(data) || isSwitchLike(data)"
      class="circuit-node__controls nodrag"
      @click.stop
      @dblclick.stop
      @mousedown.stop
      @pointerdown.stop
    >
      <label v-if="isPotentiometer(data)" class="circuit-node__control">
        <span>{{ potDisplayPosition(data.component.params.position) }}</span>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          :value="potDisplayPosition(data.component.params.position)"
          title="Nivel del potenciometro"
          @input="updatePotPosition"
        />
      </label>

      <label v-else class="circuit-node__control">
        <span>Pos</span>
        <select
          :value="data.component.params.position ?? 1"
          title="Posicion activa"
          @change="updateSwitchPosition"
        >
          <option
            v-for="position in switchPositionOptions(data)"
            :key="position"
            :value="position"
          >
            {{ position }}
          </option>
        </select>
      </label>
    </div>

    <div class="circuit-node__pins">
      <div v-for="pin in data.component.pins" :key="pin.id" class="circuit-node__pin">
        <PinHandle :pin="pin" type="target" side="left" />
        <span
          class="pin-symbol pin-symbol--inline"
          :class="[pinRoleClass(pin), { 'pin-symbol--ground-bus': isGroundBusPin(pin) }]"
          :title="`${pin.name}: ${pin.role}`"
        >
          {{ pinRoleCode(pin) }}
        </span>
        <span class="circuit-node__pin-name" :style="{ color: pinNameColor(pin, data) }">
          {{ pinDisplayName(pin) }}
        </span>
        <PinHandle :pin="pin" type="source" side="right" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.circuit-node {
  min-width: 140px;
  max-width: 170px;
  overflow: hidden;
  border: 1px solid #aebbb5;
  border-radius: 7px;
  color: #17201d;
  background: #ffffff;
  box-shadow: 0 10px 24px rgb(23 32 29 / 12%);
}

.circuit-node--selected {
  border-color: #2c8067;
  box-shadow: 0 0 0 3px rgb(44 128 103 / 18%);
}

.circuit-node__header {
  display: grid;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid #d8dfda;
  background: #f8faf8;
}

.circuit-node__label {
  min-width: 0;
  overflow: hidden;
  color: #17201d;
  font-size: 0.62rem;
  font-weight: 850;
  line-height: 1.1;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.circuit-node__schematic {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.pin-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid #aebbb5;
  border-radius: 6px;
  color: #17201d;
  background: #ffffff;
  font-size: 0.56rem;
  font-weight: 900;
  line-height: 1;
}

.pin-symbol--inline {
  flex: 0 0 auto;
  min-width: 24px;
  height: 19px;
}

.pin-symbol--ground,
.pin-symbol--jack-sleeve,
.pin-symbol--probe-reference {
  border-color: #6c7a75;
  color: #ffffff;
  background: #46534e;
}

.pin-symbol--shield {
  border-style: dashed;
  border-color: #7a8890;
  color: #324047;
  background: #eef3f5;
}

.pin-symbol--ground-bus {
  border-color: #000000;
  color: #ffffff;
  background: #000000;
}

.pin-symbol--pickup-coil-start,
.pin-symbol--pickup-coil-finish,
.pin-symbol--signal,
.pin-symbol--jack-tip,
.pin-symbol--probe-positive {
  border-color: #9bc0b2;
  color: #0f513f;
  background: #e8f7f1;
}

.pin-symbol--pot-lug,
.pin-symbol--pot-wiper {
  border-color: #d5bf82;
  color: #664d03;
  background: #fff7d6;
}

.pin-symbol--switch-common,
.pin-symbol--switch-throw {
  border-color: #b9b4dc;
  color: #3d3473;
  background: #f0eefe;
}

.circuit-node__controls {
  padding: 5px 10px;
  border-bottom: 1px solid #d8dfda;
  background: #ffffff;
}

.circuit-node__control {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: #17201d;
  font-size: 0.62rem;
  font-weight: 850;
}

.circuit-node__control input,
.circuit-node__control select {
  width: 100%;
  min-width: 0;
  accent-color: #2c8067;
}

.circuit-node__control select {
  min-height: 24px;
  border: 1px solid #aebbb5;
  border-radius: 5px;
  color: #17201d;
  background: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
}

.circuit-node__pins {
  display: grid;
  min-width: 0;
  max-height: 190px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5px 0;
}

.circuit-node__pin {
  position: relative;
  min-height: 24px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 2px 20px;
  color: #394742;
  font-size: 0.68rem;
}

.circuit-node__pin-name {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.circuit-node__pin:hover {
  background: #eef5f2;
}
</style>
