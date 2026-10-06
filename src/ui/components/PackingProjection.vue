<script setup lang="ts">
import { computed } from 'vue';
import type { PackingEntity, PackingPlan, PackingSpace } from '../../core/models';
const props = defineProps<{ plan: PackingPlan; suitcase: PackingSpace; items: PackingEntity[]; view: 'top'|'side'; selectedId?: string }>();
const emit = defineEmits<{ select: [id: string] }>();
const colors = ['#df6d45', '#507d68', '#d8a84e', '#5978a7', '#9d6a83', '#6d7d86'];
const itemIndex = computed(() => new Map(props.items.map((item, index) => [item.id, index])));
const byId = computed(() => new Map(props.items.map((item) => [item.id, item])));
function styleFor(itemId: string, x: number, y: number, length: number, width: number) {
  const maxY = props.view === 'top' ? props.suitcase.width : props.suitcase.height;
  return { left: `${x / props.suitcase.length * 100}%`, top: `${y / maxY * 100}%`, width: `${length / props.suitcase.length * 100}%`, height: `${width / maxY * 100}%`, background: colors[(itemIndex.value.get(itemId) ?? 0) % colors.length] };
}
</script>

<template>
  <div class="projection-card">
    <header><span>{{ view === 'top' ? 'TOP VIEW' : 'SIDE VIEW' }}</span><b>{{ view === 'top' ? '俯视图' : '侧视图' }}</b></header>
    <div class="projection" :class="view">
      <button
        v-for="(placement, index) in plan.placements"
        :key="placement.itemId"
        type="button"
        :data-item-id="placement.itemId"
        :data-container="byId.get(placement.itemId)?.kind === 'container' ? 'true' : 'false'"
        :class="{ selected: placement.itemId === selectedId }"
        :style="styleFor(placement.itemId, placement.x, view === 'top' ? placement.y : placement.z, placement.dimensions.length, view === 'top' ? placement.dimensions.width : placement.dimensions.height)"
        :title="byId.get(placement.itemId)?.name"
        @click="emit('select', placement.itemId)"
      >
        <span>{{ byId.get(placement.itemId)?.kind === 'container' ? '▣ ' : '' }}{{ index + 1 }}</span>
      </button>
    </div>
  </div>
</template>
