<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useCircuitStore } from '@/stores/circuit.store'

const circuitStore = useCircuitStore()
const { validation, components, connections } = storeToRefs(circuitStore)
</script>

<template>
  <section class="validation-panel" aria-labelledby="validation-title">
    <div class="validation-panel__summary">
      <div>
        <p>Validacion</p>
        <h2 id="validation-title">
          {{ validation.valid ? 'Circuito listo' : 'El circuito requiere atencion' }}
        </h2>
      </div>

      <div class="validation-panel__counts">
        <span>{{ components.length }} componentes</span>
        <span>{{ connections.length }} cables visibles</span>
        <span>{{ validation.issues.length }} avisos</span>
      </div>

      <button type="button" @click="circuitStore.validateCurrentCircuit">
        Validar
      </button>
      <button type="button" @click="circuitStore.clearWorkspace">
        Limpiar
      </button>
    </div>

    <div class="validation-panel__body">
      <p v-if="validation.issues.length === 0" class="validation-panel__empty">
        No hay errores ni advertencias.
      </p>

      <ul v-else>
        <li
          v-for="issue in validation.issues"
          :key="issue.id"
          :class="`validation-panel__issue--${issue.severity}`"
        >
          <strong>{{ issue.severity }}</strong>
          <span>{{ issue.message }}</span>
        </li>
      </ul>

      <div
        v-if="Object.keys(validation.bySwitchPosition).length > 0"
        class="validation-panel__switches"
      >
        <h3>Posiciones de selector</h3>
        <article
          v-for="(issues, positionId) in validation.bySwitchPosition"
          :key="positionId"
        >
          <strong>{{ positionId }}</strong>
          <span>{{ issues.length }} aviso(s)</span>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.validation-panel {
  display: grid;
  min-height: 150px;
  max-height: 220px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-panel);
}

.validation-panel__summary {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}

.validation-panel__summary p,
.validation-panel__summary h2,
.validation-panel__empty,
.validation-panel__switches h3 {
  margin: 0;
}

.validation-panel__summary p {
  color: var(--color-accent);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.validation-panel__summary h2 {
  color: var(--color-text);
  font-size: 1rem;
}

.validation-panel__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--color-muted);
  font-size: 0.82rem;
}

button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-panel-strong);
  font-weight: 700;
}

.validation-panel__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  gap: 16px;
  min-height: 0;
  padding: 10px 16px;
  overflow: auto;
}

ul {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

li,
.validation-panel__switches article {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel-strong);
}

li strong {
  font-size: 0.68rem;
  text-transform: uppercase;
}

li span,
.validation-panel__empty,
.validation-panel__switches span {
  color: var(--color-muted);
  font-size: 0.84rem;
}

.validation-panel__issue--error strong {
  color: var(--color-danger);
}

.validation-panel__issue--warning strong {
  color: var(--color-accent-strong);
}

.validation-panel__issue--info strong {
  color: var(--color-success);
}

.validation-panel__switches {
  display: grid;
  align-content: start;
  gap: 8px;
}

.validation-panel__switches h3 {
  color: var(--color-text);
  font-size: 0.9rem;
}

@media (max-width: 1000px) {
  .validation-panel__summary,
  .validation-panel__body {
    grid-template-columns: 1fr;
  }
}
</style>
