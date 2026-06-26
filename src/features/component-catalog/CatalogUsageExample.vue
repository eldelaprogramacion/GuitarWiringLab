<script setup lang="ts">
import { computed } from 'vue'

import {
  createComponentFromCatalogItem,
  getCatalogByCategory,
} from '@/domain/components/componentCatalog'
import { createId } from '@/utils/id'

const passives = computed(() => getCatalogByCategory('passives'))

function createFirstControlExample() {
  const firstControl = passives.value[0]

  if (!firstControl) {
    return undefined
  }

  return createComponentFromCatalogItem(firstControl, {
    id: createId(firstControl.id),
    position: { x: 160, y: 120 },
  })
}
</script>

<template>
  <section>
    <button type="button" @click="createFirstControlExample">
      Add first control
    </button>
  </section>
</template>
