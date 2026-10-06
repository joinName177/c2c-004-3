<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Container } from '../../core/models';
import { canContain, type ContainerImpact } from '../../core/container-structure';
import type { ContainerDeleteMode } from '../usePlanner';

const props = defineProps<{
  action: 'move' | 'remove';
  container: Container;
  containers: Container[];
  impact: ContainerImpact;
  initialTargetId?: string | null;
}>();
const emit = defineEmits<{
  confirmMove: [parentId: string | null];
  confirmRemove: [mode: ContainerDeleteMode];
  cancel: [];
}>();

const targetId = ref<string | null>(props.initialTargetId === undefined ? props.container.parentId ?? null : props.initialTargetId);
const deleteMode = ref<ContainerDeleteMode>('shell');
const isValidTarget = (targetId: string | null) => canContain(props.container.id, targetId, props.containers);
watch(() => [props.container.id, props.initialTargetId], () => {
  targetId.value = props.initialTargetId === undefined ? props.container.parentId ?? null : props.initialTargetId;
  deleteMode.value = 'shell';
});
</script>

<template>
  <div class="dialog-backdrop" role="dialog" aria-modal="true" :aria-label="`${action === 'move' ? '移动' : '删除'} ${container.name}`">
    <section class="confirm-dialog">
      <header><span>CONTAINER / CONFIRM</span><h3>{{ action === 'move' ? '移动容器' : '删除容器前确认' }}</h3><button type="button" aria-label="关闭确认窗口" @click="emit('cancel')">×</button></header>
      <div v-if="action === 'move'" class="dialog-body">
        <p>将 <strong>{{ container.name }}</strong> 放入新的归属层级。不能选择容器自身或其下级。</p>
        <label>新位置
          <select v-model="targetId"><option :value="null">行李箱外层</option><option v-for="option in containers" :key="option.id" :value="option.id" :disabled="!isValidTarget(option.id)">{{ option.name }}{{ !isValidTarget(option.id) ? '（自身或下级）' : '' }}</option></select>
        </label>
        <div class="impact-box"><b>受影响内容</b><p>{{ impact.descendants.length }} 个容器 · {{ impact.items.length }} 个物品；内层坐标会重新规划，外层只按容器外尺寸和实装重量计算。</p></div>
      </div>
      <div v-else class="dialog-body">
        <p>删除 <strong>{{ container.name }}</strong> 将影响以下归属关系：</p>
        <div class="impact-box">
          <b>{{ impact.descendants.length }} 个容器</b>
          <span v-for="candidate in impact.descendants" :key="candidate.id">{{ candidate.name }}</span>
          <b>{{ impact.items.length }} 个物品</b>
          <span v-for="candidate in impact.items" :key="candidate.id">{{ candidate.name }}</span>
        </div>
        <label class="radio-line"><input v-model="deleteMode" type="radio" name="delete-mode" value="shell"> 只删除容器，内部物品和子容器提升到上一层</label>
        <label class="radio-line"><input v-model="deleteMode" type="radio" name="delete-mode" value="contents"> 连同全部下级容器和物品一起删除</label>
      </div>
      <footer>
        <button type="button" @click="emit('cancel')">取消</button>
        <button class="danger" type="button" @click="action === 'move' ? emit('confirmMove', targetId) : emit('confirmRemove', deleteMode)">确认并保存各层结果</button>
      </footer>
    </section>
  </div>
</template>
