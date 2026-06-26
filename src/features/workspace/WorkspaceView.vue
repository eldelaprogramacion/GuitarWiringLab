<script setup lang="ts">
import type { EdgeChange, EdgeMouseEvent, EdgeUpdateEvent, Node } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { VueFlow } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted } from 'vue'

import CircuitNode from './nodes/CircuitNode.vue'
import { useCircuitStore } from '@/stores/circuit.store'

const circuitStore = useCircuitStore()
const { nodes, edges, components, selectedComponentId, selectedConnectionId } =
  storeToRefs(circuitStore)

const hasGroundBus = computed(() =>
  components.value.some((component) => component.type === 'ground'),
)

function onNodeClick(event: { node: Node }): void {
  circuitStore.selectComponent(event.node.id)
}

function onPaneClick(): void {
  circuitStore.selectComponent(undefined)
  circuitStore.selectConnection(undefined)
}

function onNodeDragStop(event: { node: Node }): void {
  circuitStore.updateComponentPosition(event.node.id, event.node.position)
}

function onEdgeClick(event: EdgeMouseEvent): void {
  event.event.stopPropagation()
  circuitStore.selectConnection(event.edge.id)
}

function onEdgeDoubleClick(event: EdgeMouseEvent): void {
  event.event.stopPropagation()
  circuitStore.removeConnection(event.edge.id)
}

function onEdgeUpdate(event: EdgeUpdateEvent): void {
  circuitStore.updateConnection(event.edge.id, event.connection)
}

function onEdgesChange(changes: EdgeChange[]): void {
  for (const change of changes) {
    if (change.type === 'remove') {
      circuitStore.removeConnection(change.id)
    }

    if (change.type === 'select') {
      circuitStore.selectConnection(change.selected ? change.id : undefined)
    }
  }
}

function removeSelectedConnection(): void {
  if (selectedConnectionId.value) {
    circuitStore.removeConnection(selectedConnectionId.value)
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    ? Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    : false
}

function onKeydown(event: KeyboardEvent): void {
  if (!selectedConnectionId.value || isEditableTarget(event.target)) {
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeSelectedConnection()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section class="workspace" aria-label="Area de trabajo del circuito">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      class="workspace__flow"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      fit-view-on-init
      :nodes-draggable="true"
      :nodes-connectable="true"
      :elements-selectable="true"
      :edge-updater-radius="12"
      @connect="circuitStore.addConnection"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
      @edges-change="onEdgesChange"
      @edge-click="onEdgeClick"
      @edge-double-click="onEdgeDoubleClick"
      @edge-update="onEdgeUpdate"
    >
      <template #node-circuit-node="nodeProps">
        <CircuitNode
          v-bind="nodeProps"
          :selected="nodeProps.id === selectedComponentId"
        />
      </template>

      <Background pattern-color="#d7dfda" :gap="18" />
      <Controls />
      <MiniMap v-if="nodes.length > 0" pannable zoomable />
    </VueFlow>

    <div v-if="selectedConnectionId" class="workspace__connection-actions">
      <button type="button" title="Eliminar cable seleccionado" @click="removeSelectedConnection">
        Eliminar cable
      </button>
    </div>

    <div
      v-if="hasGroundBus"
      class="workspace__ground-bus"
      title="Tierra une automaticamente pines de tierra, manga, malla y referencias."
    >
      Bus de tierra activo
    </div>
  </section>
</template>

<style scoped>
.workspace {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background: #ffffff;
}

.workspace__flow {
  width: 100%;
  height: 100%;
}

.workspace__connection-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
}

.workspace__ground-bus {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
  padding: 8px 10px;
  border: 1px solid rgb(214 168 79 / 45%);
  border-radius: 8px;
  color: #17130c;
  background: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 850;
}

.workspace__connection-actions button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid rgb(238 118 93 / 55%);
  border-radius: 7px;
  color: #17130c;
  background: var(--color-danger);
  font-size: 0.78rem;
  font-weight: 800;
}

</style>
