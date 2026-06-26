<script setup lang="ts">
import type { CircuitComponent } from '@/domain/components/circuit-component'

defineProps<{
  component: CircuitComponent
}>()

function switchModeLabel(component: CircuitComponent): string {
  if (
    component.type !== 'switch' &&
    component.type !== 'selector'
  ) {
    return ''
  }

  const mode = component.params.mode

  if (mode === 'on_off_on') {
    return 'ON-OFF-ON'
  }

  if (mode === 'on_on_on') {
    return 'ON-ON-ON'
  }

  if (mode === 'blade') {
    return '5 POS'
  }

  if (mode === 'toggle') {
    return '3 POS'
  }

  return 'ON-ON'
}

function isActivePosition(component: CircuitComponent, position: number): boolean {
  return Number(component.params.position ?? 1) === position
}
</script>

<template>
  <svg
    class="schematic-icon"
    viewBox="0 0 180 72"
    role="img"
    :aria-label="`${component.label} icono esquematico`"
  >
    <template v-if="component.type === 'potentiometer'">
      <circle cx="90" cy="25" r="18" class="schematic-icon__outline" />
      <circle cx="90" cy="25" r="6" class="schematic-icon__filled" />
      <path d="M 90 7 L 108 7" class="schematic-icon__signal" />
      <path d="M 108 7 L 104 4 M 108 7 L 104 10" class="schematic-icon__signal" />
      <path d="M 72 39 L 52 58" class="schematic-icon__ground" />
      <path d="M 90 43 L 90 60" class="schematic-icon__hot" />
      <path d="M 108 39 L 128 58" class="schematic-icon__output" />
      <text x="50" y="69">G</text>
      <text x="86" y="69">I</text>
      <text x="124" y="69">O</text>
    </template>

    <template v-else-if="component.type === 'switch' && component.params.poles === 1">
      <rect x="22" y="13" width="136" height="42" rx="8" class="schematic-icon__outline" />
      <circle cx="56" cy="28" r="6" class="schematic-icon__contact" />
      <circle cx="124" cy="28" r="6" class="schematic-icon__contact" />
      <circle cx="90" cy="45" r="7" class="schematic-icon__contact" />
      <path d="M 90 45 L 124 28" class="schematic-icon__switch-blade" />
      <path
        v-if="component.params.mode === 'on_off_on'"
        d="M 90 45 L 90 25"
        class="schematic-icon__switch-off"
      />
      <path d="M 50 28 L 16 28 M 130 28 L 164 28 M 90 52 L 90 70" class="schematic-icon__wire" />
      <path d="M 48 64 L 132 64" class="schematic-icon__position-rail" />
      <circle cx="60" cy="64" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 1) }" />
      <circle
        v-if="component.params.mode === 'on_off_on'"
        cx="90"
        cy="64"
        r="3"
        class="schematic-icon__position-dot"
        :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 2) }"
      />
      <circle cx="120" cy="64" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, component.params.positions) }" />
      <text x="49" y="19">A</text>
      <text x="118" y="19">B</text>
      <text x="87" y="40">C</text>
      <text x="62" y="10">{{ switchModeLabel(component) }}</text>
    </template>

    <template v-else-if="component.type === 'switch' && component.params.poles === 2">
      <rect x="18" y="12" width="144" height="48" rx="8" class="schematic-icon__outline" />
      <circle cx="50" cy="24" r="5.5" class="schematic-icon__contact" />
      <circle cx="124" cy="24" r="5.5" class="schematic-icon__contact" />
      <circle cx="87" cy="33" r="6.5" class="schematic-icon__contact" />
      <circle cx="50" cy="44" r="5.5" class="schematic-icon__contact" />
      <circle cx="124" cy="44" r="5.5" class="schematic-icon__contact" />
      <circle cx="87" cy="53" r="6.5" class="schematic-icon__contact" />
      <path
        v-if="component.params.mode === 'on_off_on'"
        d="M 87 33 L 87 18 M 87 53 L 87 38"
        class="schematic-icon__switch-off"
      />
      <path
        v-else
        d="M 87 33 L 124 24 M 87 53 L 124 44"
        class="schematic-icon__switch-blade"
      />
      <path d="M 44 24 L 14 24 M 130 24 L 166 24 M 44 44 L 14 44 M 130 44 L 166 44 M 87 59 L 87 70" class="schematic-icon__wire" />
      <path d="M 76 33 L 76 53 M 98 33 L 98 53" class="schematic-icon__coupler" />
      <path d="M 45 66 L 129 66" class="schematic-icon__position-rail" />
      <circle cx="57" cy="66" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 1) }" />
      <circle
        v-if="component.params.mode === 'on_off_on' || component.params.mode === 'on_on_on'"
        cx="87"
        cy="66"
        r="3"
        class="schematic-icon__position-dot"
        :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 2) }"
      />
      <circle cx="117" cy="66" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, component.params.positions) }" />
      <text x="64" y="10">{{ switchModeLabel(component) }}</text>
      <text x="44" y="19">A</text>
      <text x="118" y="19">B</text>
      <text x="80" y="29">C1</text>
      <text x="80" y="49">C2</text>
    </template>

    <template v-else-if="component.type === 'pickup' && component.params.coilCount === 1">
      <rect x="24" y="20" width="88" height="28" rx="14" class="schematic-icon__pickup" />
      <circle v-for="x in [40, 52, 64, 76, 88, 100]" :key="x" :cx="x" cy="34" r="5" class="schematic-icon__pole" />
      <path d="M 24 34 L 10 34 L 10 58 L 130 58" class="schematic-icon__ground" />
      <path d="M 112 34 L 154 34" class="schematic-icon__signal" />
      <circle cx="154" cy="34" r="3" class="schematic-icon__signal-fill" />
      <circle cx="130" cy="58" r="3" class="schematic-icon__ground-fill" />
      <text x="128" y="31">S</text>
      <text x="122" y="70">G</text>
      <text v-if="component.params.hasShield" x="18" y="18">SH</text>
    </template>

    <template v-else-if="component.type === 'pickup' && component.params.coilCount === 2">
      <rect x="22" y="12" width="92" height="22" rx="11" class="schematic-icon__pickup" />
      <rect x="22" y="38" width="92" height="22" rx="11" class="schematic-icon__humbucker-dark" />
      <circle v-for="x in [38, 50, 62, 74, 86, 98]" :key="`n-${x}`" :cx="x" cy="23" r="4" class="schematic-icon__pole" />
      <circle v-for="x in [38, 50, 62, 74, 86, 98]" :key="`s-${x}`" :cx="x" cy="49" r="4" class="schematic-icon__pole-light" />
      <path v-if="component.params.conductorMode === '2_conductor'" d="M 114 23 L 158 23 M 22 49 L 10 49 L 10 66 L 150 66" class="schematic-icon__wire" />
      <path v-else d="M 114 23 L 158 23 M 114 49 L 158 49 M 22 23 L 8 23 M 22 49 L 8 49" class="schematic-icon__wire" />
      <circle cx="158" cy="23" r="3" class="schematic-icon__signal-fill" />
      <circle v-if="component.params.conductorMode === '2_conductor'" cx="150" cy="66" r="3" class="schematic-icon__ground-fill" />
      <circle v-else cx="158" cy="49" r="3" class="schematic-icon__signal-fill" />
      <circle v-if="component.params.conductorMode === '4_conductor'" cx="8" cy="23" r="3" class="schematic-icon__signal-fill" />
      <circle v-if="component.params.conductorMode === '4_conductor'" cx="8" cy="49" r="3" class="schematic-icon__signal-fill" />
      <template v-if="component.params.conductorMode === '2_conductor'">
        <text x="124" y="20">S</text>
        <text x="120" y="63">G</text>
      </template>
      <template v-else>
        <text x="126" y="18">N+</text>
        <text x="126" y="44">S-</text>
        <text x="10" y="18">N-</text>
        <text x="10" y="44">S+</text>
      </template>
      <text v-if="component.params.hasShield" x="76" y="70">SH</text>
    </template>

    <template v-else-if="component.type === 'selector' && component.params.positions === 5">
      <rect x="16" y="14" width="148" height="42" rx="8" class="schematic-icon__outline" />
      <path d="M 34 28 L 146 28" class="schematic-icon__position-rail" />
      <circle cx="42" cy="28" r="4.5" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 1) }" />
      <circle cx="66" cy="28" r="4.5" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 2) }" />
      <circle cx="90" cy="28" r="4.5" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 3) }" />
      <circle cx="114" cy="28" r="4.5" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 4) }" />
      <circle cx="138" cy="28" r="4.5" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 5) }" />
      <circle cx="90" cy="45" r="6" class="schematic-icon__contact" />
      <path d="M 90 45 L 42 28" class="schematic-icon__switch-blade" />
      <path d="M 90 51 L 90 70 M 42 14 L 42 2 M 90 14 L 90 2 M 138 14 L 138 2" class="schematic-icon__wire" />
      <text x="38" y="11">B</text>
      <text x="82" y="11">M</text>
      <text x="134" y="11">N</text>
      <text x="88" y="42">C</text>
      <text x="35" y="66">1</text>
      <text x="59" y="66">2</text>
      <text x="83" y="66">3</text>
      <text x="107" y="66">4</text>
      <text x="131" y="66">5</text>
    </template>

    <template v-else-if="component.type === 'selector' && component.params.positions === 3">
      <rect x="26" y="12" width="128" height="46" rx="8" class="schematic-icon__outline" />
      <circle cx="54" cy="28" r="6" class="schematic-icon__contact" />
      <circle cx="126" cy="28" r="6" class="schematic-icon__contact" />
      <circle cx="90" cy="48" r="6" class="schematic-icon__contact" />
      <path d="M 90 48 L 54 28 M 90 48 L 126 28" class="schematic-icon__switch-blade" />
      <path d="M 48 28 L 14 28 M 132 28 L 166 28 M 90 54 L 90 70" class="schematic-icon__wire" />
      <path d="M 54 64 L 126 64" class="schematic-icon__position-rail" />
      <circle cx="62" cy="64" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 1) }" />
      <circle cx="90" cy="64" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 2) }" />
      <circle cx="118" cy="64" r="3" class="schematic-icon__position-dot" :class="{ 'schematic-icon__position-dot--active': isActivePosition(component, 3) }" />
      <text x="50" y="20">N</text>
      <text x="124" y="20">B</text>
      <text x="88" y="44">C</text>
      <text x="78" y="10">3 POS</text>
    </template>

    <template v-else-if="component.type === 'capacitor'">
      <path d="M 20 36 L 76 36 M 104 36 L 160 36" class="schematic-icon__wire" />
      <path d="M 78 18 L 78 54 M 102 18 L 102 54" class="schematic-icon__hot" />
      <text x="52" y="68">A</text>
      <text x="126" y="68">B</text>
    </template>

    <template v-else-if="component.type === 'resistor'">
      <path d="M 18 36 L 48 36 L 56 22 L 72 50 L 88 22 L 104 50 L 120 22 L 132 36 L 162 36" class="schematic-icon__hot" />
      <text x="42" y="68">A</text>
      <text x="132" y="68">B</text>
    </template>

    <template v-else-if="component.type === 'mono_jack'">
      <rect x="18" y="26" width="12" height="30" class="schematic-icon__jack-sleeve" />
      <path d="M 24 18 H 126" class="schematic-icon__wire" />
      <circle cx="126" cy="18" r="5.5" class="schematic-icon__contact" />
      <path d="M 82 54 L 96 40 L 112 54 H 126" class="schematic-icon__wire" />
      <circle cx="126" cy="54" r="5.5" class="schematic-icon__contact" />
      <path d="M 24 18 V 26" class="schematic-icon__lug-guide" />
      <text x="136" y="22">SL</text>
      <text x="136" y="58">T</text>
    </template>

    <template v-else-if="component.type === 'ground'">
      <path d="M 90 12 L 90 36 M 62 36 L 118 36 M 70 46 L 110 46 M 80 56 L 100 56" class="schematic-icon__ground" />
      <text x="86" y="70">G</text>
    </template>

    <template v-else-if="component.type === 'signal_generator'">
      <circle cx="90" cy="36" r="24" class="schematic-icon__outline" />
      <path d="M 66 36 C 74 18 82 18 90 36 S 106 54 114 36" class="schematic-icon__signal" />
      <path d="M 114 36 L 160 36" class="schematic-icon__signal" />
      <circle cx="160" cy="36" r="3" class="schematic-icon__signal-fill" />
      <text x="132" y="31">O</text>
      <text x="76" y="66">R</text>
    </template>

    <template v-else-if="component.type === 'string_exciter'">
      <path d="M 24 18 L 156 18 M 24 29 L 156 29 M 24 40 L 156 40" class="schematic-icon__wire" />
      <path d="M 30 18 C 42 6 54 30 66 18 S 90 30 102 18 S 126 30 138 18" class="schematic-icon__signal" />
      <rect x="42" y="48" width="96" height="14" rx="7" class="schematic-icon__pickup" />
      <circle v-for="x in [58, 72, 86, 100, 114, 128]" :key="`string-${x}`" :cx="x" cy="55" r="3" class="schematic-icon__pole" />
      <text x="58" y="12">Cuerdas</text>
    </template>

    <template v-else-if="component.type === 'oscilloscope_probe'">
      <rect x="40" y="16" width="80" height="42" rx="6" class="schematic-icon__outline" />
      <path d="M 52 38 C 60 22 68 22 76 38 S 92 54 100 38" class="schematic-icon__signal" />
      <path d="M 120 28 L 158 28 M 120 48 L 146 48" class="schematic-icon__wire" />
      <text x="150" y="31">+</text>
      <text x="148" y="51">Ref</text>
    </template>
  </svg>
</template>

<style scoped>
.schematic-icon {
  display: block;
  width: 100%;
  height: 52px;
  color: #17201d;
  background: #ffffff;
  border: 1px solid #e0e2dc;
  border-radius: 5px;
}

text {
  fill: #17201d;
  font-size: 9px;
  font-weight: 700;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.schematic-icon__outline,
.schematic-icon__pickup {
  fill: #ffffff;
  stroke: #111a17;
  stroke-width: 2;
}

.schematic-icon__filled-outline {
  fill: #111a17;
  stroke: #111a17;
  stroke-width: 2;
}

.schematic-icon__jack-sleeve {
  fill: #111a17;
  stroke: #111a17;
  stroke-width: 1.4;
}

.schematic-icon__humbucker-dark {
  fill: #111a17;
  stroke: #111a17;
  stroke-width: 2;
}

.schematic-icon__contact,
.schematic-icon__pole {
  fill: #ffffff;
  stroke: #111a17;
  stroke-width: 1.8;
}

.schematic-icon__pole-light {
  fill: #ffffff;
  stroke: #111a17;
  stroke-width: 1.8;
}

.schematic-icon__filled {
  fill: #050706;
}

.schematic-icon__wire {
  fill: none;
  stroke: #111a17;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__switch-blade {
  fill: none;
  stroke: #111a17;
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__switch-off {
  fill: none;
  stroke: #111a17;
  stroke-dasharray: 3 3;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__coupler {
  fill: none;
  stroke: #111a17;
  stroke-opacity: 0.55;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__lug-guide,
.schematic-icon__position-rail {
  fill: none;
  stroke: #111a17;
  stroke-opacity: 0.45;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__position-dot {
  fill: #ffffff;
  stroke: #111a17;
  stroke-width: 1.6;
}

.schematic-icon__position-dot--active {
  fill: #111a17;
}

.schematic-icon__signal,
.schematic-icon__signal-fill {
  fill: none;
  stroke: #111a17;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__signal-fill {
  fill: #111a17;
}

.schematic-icon__hot {
  fill: none;
  stroke: #111a17;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__output {
  fill: none;
  stroke: #111a17;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__ground,
.schematic-icon__ground-fill {
  fill: none;
  stroke: #111a17;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.schematic-icon__ground-fill {
  fill: #111a17;
}
</style>
