<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Container, PackingEntity } from '../../core/models';

const props = defineProps<{
  entity: PackingEntity | null;
  containers: Container[];
  mode: 'move' | 'delete';
  descendants: PackingEntity[];
  targetDescendants?: PackingEntity[];
  invalidTarget?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  target: [targetContainerId: string];
  confirm: [targetContainerId: string | null];
}>();
const targetId = ref<string>('');
watch(() => props.entity, (entity) => { targetId.value = entity?.containerId ?? ''; }, { immediate: true });
const title = computed(() => props.mode === 'delete' ? `删除容器：${props.entity?.name ?? ''}` : `移动：${props.entity?.name ?? ''}`);
const targetName = computed(() => props.containers.find((container) => container.id === targetId.value)?.name ?? '行李箱外层');
</script>

<template>
  <div v-if="entity" class="modal-backdrop" data-testid="container-modal" @click.self="emit('close')">
    <section class="modal-card" role="dialog" aria-modal="true">
      <header><h3>{{ title }}</h3><button type="button" aria-label="关闭" @click="emit('close')">×</button></header>
      <template v-if="mode === 'delete'">
        <p>容器本身会删除，以下内容不会丢失，将提升为行李箱外层的独立物品：</p>
      </template>
      <template v-else>
        <p>请选择新的归属位置。容器不能装入自己或自己的下级。</p>
        <label>新位置
          <select v-model="targetId" aria-label="目标容器" @change="emit('target', targetId)">
            <option value="">行李箱外层</option>
            <option v-for="container in containers" :key="container.id" :value="container.id">{{ container.name }}</option>
          </select>
        </label>
        <p class="impact-copy">确认后，{{ entity.name }} 将放入 <strong>{{ targetName }}</strong>，并重新计算各层摆放与重量。</p>
      </template>
      <h4>受影响内容</h4>
      <ul class="impact-list">
        <li v-for="item in descendants" :key="item.id">{{ item.name }} · {{ item.kind === 'container' ? '下级容器' : '物品' }}</li>
        <li v-if="!descendants.length" class="muted">{{ entity.name }} 当前没有下级内容</li>
      </ul>
      <template v-if="mode === 'move' && targetId">
        <h4>目标容器现有内容</h4>
        <ul class="impact-list">
          <li v-for="item in targetDescendants ?? []" :key="item.id">{{ item.name }}</li>
          <li v-if="!(targetDescendants ?? []).length" class="muted">目标容器当前为空</li>
        </ul>
      </template>
      <p v-if="invalidTarget" class="field-error">不能把容器移动到自己或自己的下级。</p>
      <footer>
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" class="danger" data-testid="confirm-container-action" @click="emit('confirm', targetId || null)">确认{{ mode === 'delete' ? '删除' : '移动' }}</button>
      </footer>
    </section>
  </div>
</template>
