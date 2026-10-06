<script setup lang="ts">
import { computed } from 'vue';
import type { Container, PackingItem, PackingPlan, Risk, Suitcase } from '../../core/models';
import PrintTree from './PrintTree.vue';

const props = defineProps<{ suitcase: Suitcase; items: PackingItem[]; containers: Container[]; plan: PackingPlan; risks: Risk[] }>();
const loadedSet = computed(() => new Set(props.plan.loadedItemIds));
const placedContainers = computed(() => {
  const ids = new Set<string>();
  const visit = (plan: PackingPlan) => {
    for (const placement of plan.placements) {
      if (placement.kind !== 'container') continue;
      ids.add(placement.itemId);
      const child = plan.containerPlans.find((candidate) => candidate.container.id === placement.itemId);
      if (child) visit(child.innerPlan);
    }
  };
  visit(props.plan);
  return ids;
});
</script>

<template><section class="print-sheet"><h1>行李箱空间规划单</h1><p>{{ suitcase.length }} × {{ suitcase.width }} × {{ suitcase.height }} cm · 限重 {{ suitcase.maxWeight }} kg · {{ plan.name }}</p><p>外层重量 {{ plan.totalWeight.toFixed(2) }} kg；容器内已装物品只随容器计入一次。</p><h2>分层清单</h2><PrintTree :items="items" :container-plans="plan.containerPlans" :loaded-item-ids="loadedSet" :placed-container-ids="placedContainers" /><h2>待处理对象</h2><p v-if="!plan.pendingObjectCount">无</p><p v-else>{{ plan.pendingObjectCount }} 个；只有明确移出容器的物品才会独立参与外层装箱。</p><h3>风险提示</h3><p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p></section></template>
