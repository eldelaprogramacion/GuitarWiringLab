<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import ComponentCatalogPanel from '@/features/component-catalog/ComponentCatalogPanel.vue'
import ComponentInspectorPanel from '@/features/component-inspector/ComponentInspectorPanel.vue'
import OscilloscopePanel from '@/features/oscilloscope/OscilloscopePanel.vue'
import ValidationPanel from '@/features/validators/ValidationPanel.vue'
import WorkspaceView from '@/features/workspace/WorkspaceView.vue'
</script>

<template>
  <AppShell>
    <template #sidebar>
      <ComponentCatalogPanel />
    </template>

    <WorkspaceView />

    <template #inspector>
      <ComponentInspectorPanel />
      <OscilloscopePanel />
    </template>

    <template #validation>
      <ValidationPanel />
    </template>
  </AppShell>
</template>
