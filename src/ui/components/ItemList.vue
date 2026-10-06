<script setup lang="ts">
import type { Container, HierarchicalPlan, PackingEntity } from '../../core/models';
import EntityTreeNode from './EntityTreeNode.vue';

defineProps<{ items: PackingEntity[]; hierarchy: HierarchicalPlan; blockedId?: string }>();
const emit = defineEmits<{
  remove: [id: string];
  deleteContainer: [container: Container];
  toggle: [id: string, mustHave: boolean];
  move: [entity: PackingEntity];
  enter: [container: Container];
}>();
const roots = (items: PackingEntity[]) => items.filter((item) => !item.containerId || !items.some((candidate) => candidate.id === item.containerId));
</script>

<template>
  <div class="item-list">
    <EntityTreeNode
      v-for="entity in roots(items)"
      :key="entity.id"
      :entity="entity"
      :all-entities="items"
      :parent-id="null"
      :hierarchy="hierarchy"
      :depth="0"
      :blocked-id="blockedId"
      @remove="emit('remove', $event)"
      @delete-container="emit('deleteContainer', $event)"
      @toggle="(id, mustHave) => emit('toggle', id, mustHave)"
      @move="emit('move', $event)"
      @enter="emit('enter', $event)"
    />
  </div>
</template>
