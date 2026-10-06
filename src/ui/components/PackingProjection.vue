<script setup lang="ts">
import { computed } from 'vue';
import type { Container, Dimensions, PackingItem, PackingPlan } from '../../core/models';
const props = defineProps<{ plan: PackingPlan; box: Dimensions; items: PackingItem[]; containers: Container[]; view: 'top'|'side'; selectedId?: string }>();
const emit = defineEmits<{ select: [id: string]; openContainer: [id: string] }>();
const colors = ['#df6d45', '#507d68', '#d8a84e', '#5978a7', '#9d6a83', '#6d7d86'];
const itemIndex = computed(() => new Map(props.items.map((item, index) => [item.id, index])));
const containerIndex = computed(() => new Map(props.containers.map((container, index) => [container.id, index])));
function placementColor(itemId: string, kind?: string) {
  const index = kind === 'container' ? containerIndex.value.get(itemId) : itemIndex.value.get(itemId);
  return colors[(index ?? 0) % colors.length];
}
function styleFor(itemId: string, kind: string | undefined, x: number, y: number, length: number, width: number) {
  const maxY = props.view === 'top' ? props.box.width : props.box.height;
  return { left: `${x / props.box.length * 100}%`, top: `${y / maxY * 100}%`, width: `${length / props.box.length * 100}%`, height: `${width / maxY * 100}%`, background: placementColor(itemId, kind) };
}
function choose(placement: { itemId: string; kind?: string }) {
  if (placement.kind === 'container') emit('openContainer', placement.itemId);
  else emit('select', placement.itemId);
}
</script>

<template>
  <div class="projection-card">
    <header><span>{{ view === 'top' ? 'TOP VIEW' : 'SIDE VIEW' }}</span><b>{{ view === 'top' ? '俯视图' : '侧视图' }}</b></header>
    <div class="projection" :class="view">
      <button v-for="(placement, index) in plan.placements" :key="placement.itemId" type="button" :data-item-id="placement.itemId" :data-kind="placement.kind ?? 'item'" :class="['placement-button', { selected: placement.itemId === selectedId, container: placement.kind === 'container' }]" :style="styleFor(placement.itemId, placement.kind, placement.x, view === 'top' ? placement.y : placement.z, placement.dimensions.length, view === 'top' ? placement.dimensions.width : placement.dimensions.height)" @click="choose(placement)"><span>{{ placement.kind === 'container' ? '▣' : index + 1 }}</span></button>
    </div>
  </div>
</template>
