<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

import type { CircuitPin } from '@/domain/components/component-terminal'

defineProps<{
  pin: CircuitPin
  side: 'left' | 'right'
  type: 'source' | 'target'
}>()
</script>

<template>
  <Handle
    :id="pin.id"
    :type="type"
    :position="side === 'left' ? Position.Left : Position.Right"
    class="pin-handle"
  />
</template>

<style scoped>
.pin-handle {
  width: 18px;
  height: 18px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #111a17;
  opacity: 0.98;
}

.pin-handle::after {
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: #111a17;
  content: "";
}
</style>
