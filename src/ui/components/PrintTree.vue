<script setup lang="ts">
import type { ContainerPlan, PackingItem } from '../../core/models';

defineProps<{
  items: PackingItem[];
  containerPlans: ContainerPlan[];
  loadedItemIds: Set<string>;
  placedContainerIds: Set<string>;
  parentId?: string | null;
  depth?: number;
}>();

function mark(id: string, loaded: Set<string>) {
  return loaded.has(id) ? '□' : '×';
}
</script>

<template>
  <ul>
    <li v-for="item in items.filter(candidate => (candidate.parentId ?? null) === (parentId ?? null))" :key="item.id" :style="{ marginLeft: `${(depth ?? 0) * 10}px` }">
      {{ mark(item.id, loadedItemIds) }} {{ item.name }} — {{ item.weight }} kg{{ item.mustHave ? ' · 必带' : '' }}
    </li>
    <li v-for="container in containerPlans.filter(candidate => (candidate.container.parentId ?? null) === (parentId ?? null))" :key="container.container.id" :style="{ marginLeft: `${(depth ?? 0) * 10}px` }">
      {{ placedContainerIds.has(container.container.id) ? '▣' : '×' }} {{ container.container.name }} — 自重 {{ container.container.weight }} kg · 实装 {{ container.packedWeight.toFixed(2) }} kg · {{ container.innerPlan.unplaced.length }} 个本层待处理
      <PrintTree v-if="placedContainerIds.has(container.container.id)" :items="items" :container-plans="containerPlans" :loaded-item-ids="loadedItemIds" :placed-container-ids="placedContainerIds" :parent-id="container.container.id" :depth="(depth ?? 0) + 1" />
    </li>
  </ul>
</template>
