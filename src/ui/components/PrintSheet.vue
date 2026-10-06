<script setup lang="ts">
import { computed } from 'vue';
import type { HierarchicalPlan, PackingEntity, Risk, Suitcase } from '../../core/models';
const props = defineProps<{ suitcase: Suitcase; items: PackingEntity[]; plan: HierarchicalPlan; risks: Risk[] }>();

interface PrintedRow { entity: PackingEntity; state: '已装' | '待处理'; depth: number; reason?: string; weight: number }
const byId = computed(() => new Map(props.items.map((item) => [item.id, item])));
const rows = computed<PrintedRow[]>(() => {
  const result: PrintedRow[] = [];
  function addPlan(plan: HierarchicalPlan, depth: number) {
    for (const placement of plan.placements) {
      const entity = byId.value.get(placement.itemId);
      if (!entity) continue;
      const childPlan = entity.kind === 'container' ? plan.containerPlans[entity.id]?.plan : undefined;
      const effectiveWeight = childPlan?.totalWeight ?? entity.weight;
      result.push({ entity, state: '已装', depth, reason: undefined, weight: effectiveWeight });
      if (entity.kind === 'container' && childPlan) {
        addPlan({ ...childPlan, containerPlans: plan.containerPlans }, depth + 1);
      }
    }
    for (const unplaced of plan.unplaced) {
      const childPlan = unplaced.item.kind === 'container' ? plan.containerPlans[unplaced.item.id]?.plan : undefined;
      result.push({ entity: unplaced.item, state: '待处理', depth, reason: unplaced.reason, weight: childPlan?.totalWeight ?? unplaced.item.weight });
      if (unplaced.item.kind === 'container' && childPlan) {
        addPlan({ ...childPlan, containerPlans: plan.containerPlans }, depth + 1);
      }
    }
  }
  addPlan(props.plan, 0);
  return result;
});
</script>

<template><section class="print-sheet"><h1>行李箱空间规划单</h1><p>{{ suitcase.length }} × {{ suitcase.width }} × {{ suitcase.height }} cm · 限重 {{ suitcase.maxWeight }} kg · {{ plan.name }}</p><h2>分层装箱清单（重量只在直接外层计一次）</h2><ol><li v-for="row in rows" :key="`${row.state}-${row.entity.id}-${row.depth}`" :style="{ paddingLeft: `${row.depth * 14}mm` }">{{ row.state === '已装' ? '□' : '×' }} {{ row.entity.name }} <small v-if="row.entity.kind === 'container'">[容器，内 {{ row.entity.innerLength }}×{{ row.entity.innerWidth }}×{{ row.entity.innerHeight }} cm]</small> — {{ row.state === '已装' ? '计入重量' : '不计入外层重量' }} {{ row.weight.toFixed(2) }} kg<span v-if="row.reason">（{{ row.reason }}）</span></li></ol><p><strong>外层重量：</strong>{{ plan.totalWeight.toFixed(2) }} kg；待处理 {{ plan.unplaced.length }} 件直接子物。</p><h3>风险提示</h3><p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p></section></template>
