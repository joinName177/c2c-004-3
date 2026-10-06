<script setup lang="ts">
import { computed, ref } from 'vue';
import { LocalPlannerRepository } from '../adapters/local-planner.repository';
import { BrowserPrintAdapter } from '../adapters/browser-print.adapter';
import { validateSuitcase } from '../core/packing-engine';
import { createEntityGraph, descendantIds, getChildren, getPlanForPath } from '../core/nested-packing';
import { innerDimensions, isContainer, type Container, type PackingEntity, type PackingPlan, type PackingSpace } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';
import { usePlanner } from './usePlanner';
import SuitcaseForm from './components/SuitcaseForm.vue';
import ItemEditor from './components/ItemEditor.vue';
import ItemList from './components/ItemList.vue';
import PackingMap from './components/PackingMap.vue';
import PlanCompare from './components/PlanCompare.vue';
import RiskPanel from './components/RiskPanel.vue';
import PrintSheet from './components/PrintSheet.vue';
import ContainerActionModal from './components/ContainerActionModal.vue';

const props = defineProps<{ repository?: PlannerRepository; printPort?: PrintPort }>();
const planner = usePlanner({ repository: props.repository ?? new LocalPlannerRepository(window.localStorage), printPort: props.printPort ?? new BrowserPrintAdapter() });
const selectedItem = ref('');
const openPath = ref<string[]>([]);
const actionEntity = ref<PackingEntity | null>(null);
const actionMode = ref<'move' | 'delete'>('move');
const selectedTargetId = ref<string>('');
const invalidTarget = ref(false);
const errors = computed(() => validateSuitcase(planner.state.suitcase));
const graph = computed(() => createEntityGraph(planner.state.items.map((entity) => ({ ...entity }))));
const currentHierarchy = computed(() => planner.currentPlan.value);
const layerPlan = computed<PackingPlan>(() => getPlanForPath(currentHierarchy.value, openPath.value, planner.state.items));
const currentContainer = computed<Container | null>(() => {
  const id = openPath.value[openPath.value.length - 1];
  const entity = id ? graph.value.entities.get(id) : undefined;
  return entity && isContainer(entity) ? entity : null;
});
const layerSpace = computed<PackingSpace>(() => currentContainer.value ? { ...innerDimensions(currentContainer.value), maxWeight: Number.MAX_SAFE_INTEGER } : planner.state.suitcase);
const layerEntities = computed(() => getChildren(graph.value, currentContainer.value?.id ?? null));
const containerOptions = computed<Container[]>(() => {
  if (!actionEntity.value) return planner.state.items.filter((item): item is Container => item.kind === 'container');
  const blocked = new Set([actionEntity.value.id, ...descendantIds(graph.value, actionEntity.value.id)]);
  return planner.state.items.filter((item): item is Container => item.kind === 'container' && !blocked.has(item.id));
});
const actionImpact = computed(() => {
  if (!actionEntity.value || actionEntity.value.kind !== 'container') return [];
  const impact = planner.containerImpact(actionEntity.value.id, selectedTargetId.value || null);
  return impact?.descendants ?? [];
});
const targetImpact = computed(() => {
  if (!selectedTargetId.value) return [];
  const target = graph.value.entities.get(selectedTargetId.value);
  if (!target || target.kind !== 'container') return [];
  return planner.containerImpact(target.id, null)?.descendants ?? [];
});

function selectOnMap(id: string) {
  selectedItem.value = id;
  if (layerEntities.value.some((entity) => entity.id === id && entity.kind === 'container')) {
    openPath.value = pathTo(id);
  }
}
function pathTo(containerId: string) {
  const path: string[] = [];
  let current: string | null = containerId;
  while (current) {
    path.unshift(current);
    current = graph.value.entities.get(current)?.containerId ?? null;
  }
  return path;
}
function enterContainer(container: Container) {
  selectedItem.value = container.id;
  openPath.value = pathTo(container.id);
}
function goLayer(depth: number) {
  openPath.value = openPath.value.slice(0, depth);
  selectedItem.value = openPath.value[openPath.value.length - 1] ?? '';
}
function requestMove(entity: PackingEntity) {
  actionEntity.value = entity;
  actionMode.value = 'move';
  selectedTargetId.value = entity.containerId ?? '';
  invalidTarget.value = false;
}
function requestDelete(entity: PackingEntity) {
  planner.removeItem(entity.id);
}
function requestContainerDelete(container: Container) {
  actionEntity.value = container;
  actionMode.value = 'delete';
  selectedTargetId.value = '';
  invalidTarget.value = false;
}
function movePendingOut(entity: PackingEntity) {
  planner.moveEntity(entity.id, null);
}
function confirmAction(target: string | null) {
  const entity = actionEntity.value;
  if (!entity) return;
  if (actionMode.value === 'delete') {
    planner.removeContainer(entity.id);
  } else if (planner.canMove(entity.id, target)) {
    planner.moveEntity(entity.id, target);
  } else {
    invalidTarget.value = true;
    return;
  }
  actionEntity.value = null;
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand"><span class="brand-mark">PACK<br><b>WISE</b></span><div><small>TRAVEL LAB / 004</small><h1>行李箱空间规划师</h1></div></div><div class="header-actions"><span :class="{ stale: planner.isStale.value }">{{ planner.isStale.value ? '方案待更新' : '规划已同步' }}</span><button type="button" data-testid="print-button" @click="planner.print">打印清单</button><button type="button" class="primary" :disabled="errors.length > 0" @click="planner.regenerate()">智能装箱 ↗</button></div></header>
    <main>
      <section class="hero"><div><small>SPACE, WEIGHT & NESTED CONTAINERS</small><h2>先收纳进包，<em>再整体装箱。</em></h2><p>相机包、收纳盒按内尺寸规划子物品；外层只使用外尺寸和“自重＋实装内容”的合计重量。</p></div><div class="hero-stamp"><b>{{ planner.state.items.length }}</b><span>ITEMS &<br>CONTAINERS</span></div></section>
      <PlanCompare :plans="planner.plans.value" :selected="planner.state.selectedPlan" :suitcase="planner.state.suitcase" @select="planner.selectPlan" />
      <div class="workspace">
        <aside class="left-column">
          <SuitcaseForm :suitcase="planner.state.suitcase" :errors="errors" @update="planner.updateSuitcase" />
          <section class="panel inventory"><div class="section-title"><div><span>02 / INVENTORY</span><h2>物品与容器</h2></div><b>{{ planner.state.items.length }} 条</b></div><ItemEditor @add="planner.addItem" /><ItemList :items="planner.state.items" :hierarchy="currentHierarchy" :blocked-id="actionEntity?.id" @remove="(id) => requestDelete(graph.entities.get(id)!)" @delete-container="requestContainerDelete" @toggle="(id, mustHave) => planner.updateItem(id, { mustHave })" @move="requestMove" @enter="enterContainer" /></section>
        </aside>
        <section class="right-column">
          <PackingMap
            :plan="layerPlan"
            :space="layerSpace"
            :entities="layerEntities"
            :hierarchy="currentHierarchy"
            :path="openPath"
            :all-entities="planner.state.items"
            :selected-id="selectedItem"
            @select="selectOnMap"
            @enter="enterContainer"
            @move-out="movePendingOut"
            @back="goLayer"
          />
          <RiskPanel :risks="planner.risks.value" />
        </section>
      </div>
      <p class="notice" aria-live="polite">{{ planner.notice.value }}</p>
    </main>
    <PrintSheet :suitcase="planner.state.suitcase" :items="planner.state.items" :plan="currentHierarchy" :risks="planner.risks.value" />
    <ContainerActionModal
      :entity="actionEntity"
      :containers="containerOptions"
      :mode="actionMode"
      :descendants="actionImpact"
      :target-descendants="targetImpact"
      :invalid-target="invalidTarget"
      @close="actionEntity = null"
      @target="selectedTargetId = $event"
      @confirm="confirmAction"
    />
  </div>
</template>
