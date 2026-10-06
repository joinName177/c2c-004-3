<script setup lang="ts">
import { computed } from 'vue';
import type { Container, PackingPlan } from '../../core/models';

const props = defineProps<{ containers: Container[]; plan: PackingPlan; canMoveOut?: boolean }>();
const emit = defineEmits<{ open: [id: string]; move: [id: string]; remove: [id: string]; moveOut: [id: string]; toggle: [id: string, mustHave: boolean] }>();
const placedIds = computed(() => new Set(props.plan.placements.filter((placement) => placement.kind === 'container').map((placement) => placement.itemId)));
const reasons = computed(() => new Map(props.plan.unplaced.filter(({ object }) => object.kind === 'container').map(({ object, reason }) => [object.id, reason])));
const planById = computed(() => new Map(props.plan.containerPlans.map((containerPlan) => [containerPlan.container.id, containerPlan])));
</script>

<template>
  <div class="container-list layer-list">
    <article v-for="container in containers" :key="container.id" class="container-row" :class="{ pending: !placedIds.has(container.id), 'has-move-out': canMoveOut }">
      <button class="container-open" type="button" data-testid="open-container" @click="emit('open', container.id)">▣<span><strong>{{ container.name }}</strong><small>内 {{ container.innerLength }}×{{ container.innerWidth }}×{{ container.innerHeight }} · 自重 {{ container.weight }}kg</small><em v-if="!placedIds.has(container.id)">待处理 · {{ reasons.get(container.id) }}</em></span></button>
      <button class="must-button" :class="{ checked: planById.get(container.id)?.effectiveMustHave ?? container.mustHave }" type="button" @click="emit('toggle', container.id, !Boolean(planById.get(container.id)?.effectiveMustHave ?? container.mustHave))">{{ (planById.get(container.id)?.effectiveMustHave ?? container.mustHave) ? '必带' : '可选' }}</button>
      <button class="tiny-button" type="button" @click="emit('move', container.id)">移动</button>
      <button v-if="canMoveOut" class="tiny-button" type="button" @click="emit('moveOut', container.id)">移到上一层</button>
      <button class="icon-button" type="button" :aria-label="`删除 ${container.name}`" @click="emit('remove', container.id)">×</button>
    </article>
  </div>
</template>
