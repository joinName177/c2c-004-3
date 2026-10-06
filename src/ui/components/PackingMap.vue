<script setup lang="ts">
import { computed } from 'vue';
import PackingProjection from './PackingProjection.vue';
import type { Container, HierarchicalPlan, PackingEntity, PackingPlan, PackingSpace } from '../../core/models';

const props = defineProps<{
  plan: PackingPlan;
  space: PackingSpace;
  entities: PackingEntity[];
  hierarchy: HierarchicalPlan;
  path: string[];
  allEntities: PackingEntity[];
  selectedId?: string;
}>();
const emit = defineEmits<{ select: [id: string]; enter: [container: Container]; back: [depth: number]; moveOut: [entity: PackingEntity] }>();
const byId = computed(() => new Map(props.allEntities.map((entity) => [entity.id, entity])));
const crumbs = computed<Array<{ id: string | null; name: string }>>(() => {
  const result: Array<{ id: string | null; name: string }> = [{ id: null, name: '行李箱' }];
  for (const id of props.path) {
    const entity = byId.value.get(id);
    if (entity) result.push({ id, name: entity.name });
  }
  return result;
});
const layerName = computed(() => props.path.length ? byId.value.get(props.path[props.path.length - 1])?.name ?? '容器内部' : '行李箱外层');
function entityAt(placementId: string) { return byId.value.get(placementId); }
</script>

<template>
  <div class="canvas-panel">
    <div class="canvas-head">
      <div>
        <span>03 / PACKING MAP</span>
        <h2>{{ layerName }}摆放方案</h2>
        <nav class="breadcrumbs" aria-label="容器层级">
          <button v-for="(crumb, index) in crumbs" :key="crumb.id ?? 'root'" type="button" data-testid="layer-crumb" :disabled="index === crumbs.length - 1" @click="emit('back', index)">{{ crumb.name }}</button>
        </nav>
      </div>
      <div class="metrics">
        <span><b>{{ Math.round(plan.capacityRatio * 100) }}%</b>空间利用</span>
        <span><b>{{ plan.totalWeight.toFixed(2) }}</b>kg 本层实装</span>
        <span><b>{{ plan.unplaced.length }}</b>件待处理</span>
      </div>
    </div>
    <div class="projections">
      <PackingProjection
        view="top"
        :plan="plan"
        :suitcase="space"
        :items="entities"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
      <PackingProjection
        view="side"
        :plan="plan"
        :suitcase="space"
        :items="entities"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
    </div>
    <div class="container-tools">
      <p>点击带 ▣ 的色块可逐层打开容器；待处理子物品保留在原容器中，不会重复参与外层装箱。</p>
      <button v-if="path.length" type="button" data-testid="move-out-container" @click="emit('back', path.length - 1)">返回上一层</button>
    </div>
    <ul v-if="plan.unplaced.length" class="unplaced-list">
      <li v-for="{ item, reason } in plan.unplaced" :key="item.id" :class="{ container: item.kind === 'container' }">
        <strong>{{ item.name }}</strong><span>{{ reason }}</span>
        <button v-if="item.kind === 'container'" type="button" @click="emit('enter', item as Container)">仍可打开查看内容</button>
        <button type="button" data-testid="move-out-pending" @click="emit('moveOut', item)">明确移出到外层</button>
      </li>
    </ul>
  </div>
</template>
