<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem, PackingPlan } from '../../core/models';

const props = defineProps<{ items: PackingItem[]; plan: PackingPlan; insideContainer?: boolean }>();
const emit = defineEmits<{ remove: [id: string]; toggle: [id: string, mustHave: boolean]; moveOut: [id: string] }>();
const placedIds = computed(() => new Set(props.plan.placements.map((placement) => placement.itemId)));
const reasons = computed(() => new Map(props.plan.unplaced.map(({ object, reason }) => [object.id, reason])));
</script>

<template>
  <div class="item-list layer-list">
    <article v-for="item in items" :key="item.id" class="item-row" :class="{ pending: !placedIds.has(item.id), 'has-move-out': insideContainer }">
      <div class="item-icon">{{ item.category.slice(0, 1) }}</div>
      <div class="item-copy"><strong>{{ item.name }}</strong><span>{{ item.length }}×{{ item.width }}×{{ item.height }} cm · {{ item.weight }} kg <em v-if="!placedIds.has(item.id)">待处理 · {{ reasons.get(item.id) }}</em></span></div>
      <button class="must-button" :class="{ checked: item.mustHave }" type="button" @click="emit('toggle', item.id, !item.mustHave)">{{ item.mustHave ? '必带' : '可选' }}</button>
      <b class="priority">P{{ item.priority }}</b>
      <button v-if="insideContainer" class="tiny-button" type="button" @click="emit('moveOut', item.id)">移到上一层</button>
      <button class="icon-button" type="button" :aria-label="`删除 ${item.name}`" @click="emit('remove', item.id)">×</button>
    </article>
  </div>
</template>
