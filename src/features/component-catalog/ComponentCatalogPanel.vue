<script setup lang="ts">
import { computed, ref } from 'vue'

import { componentCatalog } from '@/domain/components/catalog'
import {
  applyPresetToStore,
  presetLibrary,
  type PresetCategory,
} from '@/features/presets/presetLibrary'
import { useCircuitStore } from '@/stores/circuit.store'

const circuitStore = useCircuitStore()

const groupedCatalog = computed(() =>
  componentCatalog.reduce<Record<string, typeof componentCatalog>>((groups, item) => {
    groups[item.category] ??= []
    groups[item.category].push(item)
    return groups
  }, {}),
)

const categoryLabels: Record<string, string> = {
  sources: 'Fuentes y herramientas',
  passives: 'Pasivos',
  connectors: 'Conectores',
  switches: 'Switches',
  selectors: 'Selectores',
}

const categoryOrder = [
  'sources',
  'passives',
  'connectors',
  'switches',
  'selectors',
]

const presetCategoryLabels: Record<PresetCategory, string> = {
  one_pickup: '1 pastilla',
  two_pickups: '2 pastillas',
  three_pickups: '3 pastillas',
}

const presetCategoryOrder: PresetCategory[] = [
  'one_pickup',
  'two_pickups',
  'three_pickups',
]

const collapsedCategories = ref<Set<string>>(new Set(categoryOrder))
const collapsedPresetCategories = ref<Set<PresetCategory>>(new Set(presetCategoryOrder))

const orderedCatalogGroups = computed(() =>
  categoryOrder
    .filter((category) => groupedCatalog.value[category]?.length)
    .map((category) => ({
      id: category,
      label: categoryLabels[category] ?? category,
      items: groupedCatalog.value[category],
    })),
)

const groupedPresets = computed(() =>
  presetLibrary.reduce<Record<PresetCategory, typeof presetLibrary>>((groups, preset) => {
    groups[preset.category] ??= []
    groups[preset.category].push(preset)
    return groups
  }, {} as Record<PresetCategory, typeof presetLibrary>),
)

const orderedPresetGroups = computed(() =>
  presetCategoryOrder
    .filter((category) => groupedPresets.value[category]?.length)
    .map((category) => ({
      id: category,
      label: presetCategoryLabels[category],
      items: groupedPresets.value[category],
    })),
)

function isCollapsed(category: string): boolean {
  return collapsedCategories.value.has(category)
}

function isPresetCollapsed(category: PresetCategory): boolean {
  return collapsedPresetCategories.value.has(category)
}

function toggleCategory(category: string): void {
  const nextCollapsed = new Set(collapsedCategories.value)

  if (nextCollapsed.has(category)) {
    nextCollapsed.delete(category)
  } else {
    nextCollapsed.add(category)
  }

  collapsedCategories.value = nextCollapsed
}

function togglePresetCategory(category: PresetCategory): void {
  const nextCollapsed = new Set(collapsedPresetCategories.value)

  if (nextCollapsed.has(category)) {
    nextCollapsed.delete(category)
  } else {
    nextCollapsed.add(category)
  }

  collapsedPresetCategories.value = nextCollapsed
}

function loadPreset(presetId: string): void {
  applyPresetToStore(circuitStore, presetId)
}
</script>

<template>
  <section class="catalog-panel" aria-labelledby="catalog-title">
    <div class="catalog-panel__header">
      <p>Catalogo</p>
      <h2 id="catalog-title">Componentes</h2>
    </div>

    <div class="catalog-panel__tree">
      <section
        v-for="group in orderedCatalogGroups"
        :key="group.id"
        class="catalog-group"
      >
        <button
          type="button"
          class="catalog-group__toggle"
          :aria-expanded="!isCollapsed(group.id)"
          :aria-controls="`catalog-group-${group.id}`"
          @click="toggleCategory(group.id)"
        >
          <span class="catalog-group__chevron">{{ isCollapsed(group.id) ? '>' : 'v' }}</span>
          <span>{{ group.label }}</span>
          <small>{{ group.items.length }}</small>
        </button>

        <div
          v-show="!isCollapsed(group.id)"
          :id="`catalog-group-${group.id}`"
          class="catalog-panel__list"
        >
          <article
            v-for="component in group.items"
            :key="component.id"
            class="catalog-item"
          >
            <div>
              <h4>{{ component.label }}</h4>
              <p>{{ component.description }}</p>
            </div>

            <button
              type="button"
              :aria-label="`Add ${component.label}`"
              title="Agregar componente"
              @click="circuitStore.addComponent(component)"
            >
              +
            </button>
          </article>
        </div>
      </section>
    </div>

    <section class="preset-panel" aria-labelledby="preset-title">
      <div class="preset-panel__header">
        <p>Presets</p>
        <h2 id="preset-title">Circuitos prearmados</h2>
      </div>

      <section
        v-for="group in orderedPresetGroups"
        :key="group.id"
        class="catalog-group"
      >
        <button
          type="button"
          class="catalog-group__toggle"
          :aria-expanded="!isPresetCollapsed(group.id)"
          :aria-controls="`preset-group-${group.id}`"
          @click="togglePresetCategory(group.id)"
        >
          <span class="catalog-group__chevron">
            {{ isPresetCollapsed(group.id) ? '>' : 'v' }}
          </span>
          <span>{{ group.label }}</span>
          <small>{{ group.items.length }}</small>
        </button>

        <div
          v-show="!isPresetCollapsed(group.id)"
          :id="`preset-group-${group.id}`"
          class="preset-panel__list"
        >
          <article
            v-for="preset in group.items"
            :key="preset.id"
            class="preset-item"
            :title="preset.description"
          >
            <div>
              <h3>{{ preset.name }}</h3>
            </div>

            <button
              type="button"
              :aria-label="`Cargar ${preset.name}`"
              :title="preset.description"
              @click="loadPreset(preset.id)"
            >
              Cargar
            </button>
          </article>
        </div>
      </section>
    </section>
  </section>
</template>

<style scoped>
.catalog-panel,
.catalog-panel__tree,
.catalog-group,
.catalog-panel__list,
.preset-panel,
.preset-panel__list {
  display: grid;
  gap: 12px;
}

.catalog-panel__header p,
.catalog-panel__header h2,
.preset-panel__header p,
.preset-panel__header h2,
.catalog-item h4,
.catalog-item p,
.preset-item h3,
.preset-item p {
  margin: 0;
}

.catalog-panel__header p,
.preset-panel__header p {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.catalog-panel__header h2,
.preset-panel__header h2 {
  color: var(--color-text);
  font-size: 1rem;
}

.catalog-group {
  gap: 8px;
}

.catalog-group__toggle {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-panel-strong);
  text-align: left;
}

.catalog-group__toggle span {
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
}

.catalog-group__toggle small {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.catalog-group__chevron {
  text-align: center;
}

.catalog-item,
.preset-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel-strong);
}

.catalog-item h4 {
  color: var(--color-text);
  font-size: 0.92rem;
}

.preset-item h3 {
  color: var(--color-text);
  font-size: 0.9rem;
}

.catalog-item p,
.preset-item p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 0.8rem;
  line-height: 1.35;
}

.catalog-item button,
.preset-item button {
  width: 36px;
  height: 36px;
  border: 1px solid rgb(214 168 79 / 50%);
  border-radius: 8px;
  color: #17130c;
  background: var(--color-accent);
  font-size: 1.15rem;
  font-weight: 800;
}

.preset-item button {
  width: auto;
  min-width: 58px;
  padding: 0 10px;
  font-size: 0.74rem;
}

.catalog-item button:hover,
.preset-item button:hover {
  border-color: #f7df9b;
  background: #f7d987;
}

.preset-panel {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
</style>
