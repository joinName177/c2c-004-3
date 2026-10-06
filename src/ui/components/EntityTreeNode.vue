<script setup lang="ts">
import { computed } from 'vue';
import { travelState } from '../../core/nested-packing';
import type { Container, HierarchicalPlan, PackingEntity } from '../../core/models';

const props = defineProps<{
  entity: PackingEntity;
  allEntities: PackingEntity[];
  parentId: string | null;
  hierarchy: HierarchicalPlan;
  depth: number;
  blockedId?: string;
}>();
const emit = defineEmits<{
  remove: [id: string];
  deleteContainer: [container: Container];
  toggle: [id: string, mustHave: boolean];
  move: [entity: PackingEntity];
  enter: [container: Container];
}>();
const status = computed(() => travelState(props.hierarchy, props.entity.id, props.allEntities));
const children = computed<PackingEntity[]>(() => props.entity.kind === 'container'
  ? props.allEntities.filter((candidate) => candidate.containerId === props.entity.id)
  : []);
</script>

<template>
  <article class="item-row entity-row" :class="{ container: entity.kind === 'container', pending: !status.placed }" :style="{ '--row-depth': depth }">
    <div class="item-icon">{{ entity.kind === 'container' ? '箱' : entity.category.slice(0, 1) }}</div>
    <div class="item-copy">
      <strong>
        {{ entity.name }}
        <span v-if="entity.kind === 'container'" class="kind-badge">容器</span>
        <span v-if="!status.placed" class="kind-badge warning">待处理</span>
      </strong>
      <span>
        {{ entity.length }}×{{ entity.width }}×{{ entity.height }} cm · {{ entity.weight }} kg
        <template v-if="entity.kind === 'container'"> · 内 {{ entity.innerLength }}×{{ entity.innerWidth }}×{{ entity.innerHeight }} cm</template>
      </span>
      <small v-if="!status.placed" class="pending-reason">{{ status.reason }}</small>
    </div>
    <button class="must-button" :class="{ checked: entity.mustHave }" type="button" @click="emit('toggle', entity.id, !entity.mustHave)">{{ entity.mustHave ? '必带' : '可选' }}</button>
    <b class="priority">P{{ entity.priority }}</b>
    <button v-if="entity.kind === 'container'" class="text-button" type="button" data-testid="enter-container" @click="emit('enter', entity)">打开</button>
    <button class="text-button" type="button" data-testid="move-entity" @click="emit('move', entity)">归属</button>
    <button v-if="entity.kind === 'container'" class="text-button danger-text" type="button" data-testid="delete-container" @click="emit('deleteContainer', entity)">删除容器</button>
    <button class="icon-button" type="button" :aria-label="`删除 ${entity.name}`" @click="emit('remove', entity.id)">×</button>
  </article>
  <div v-if="entity.kind === 'container' && children.length && entity.id !== blockedId" class="entity-children">
    <EntityTreeNode
      v-for="child in children"
      :key="child.id"
      :entity="child"
      :all-entities="allEntities"
      :parent-id="entity.id"
      :hierarchy="hierarchy"
      :depth="depth + 1"
      :blocked-id="blockedId"
      @remove="emit('remove', $event)"
      @delete-container="emit('deleteContainer', $event)"
      @toggle="(id, mustHave) => emit('toggle', id, mustHave)"
      @move="emit('move', $event)"
      @enter="emit('enter', $event)"
    />
  </div>
</template>
