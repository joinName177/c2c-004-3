<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LocalPlannerRepository } from '../adapters/local-planner.repository';
import { BrowserPrintAdapter } from '../adapters/browser-print.adapter';
import { validateSuitcase } from '../core/packing-engine';
import { getActivePlan } from '../core/container-plan';
import { canContain } from '../core/container-structure';
import type { Container, Dimensions } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';
import type { ContainerDeleteMode } from './usePlanner';
import { usePlanner } from './usePlanner';
import SuitcaseForm from './components/SuitcaseForm.vue';
import ItemEditor from './components/ItemEditor.vue';
import ContainerEditor from './components/ContainerEditor.vue';
import ItemList from './components/ItemList.vue';
import ContainerList from './components/ContainerList.vue';
import PackingProjection from './components/PackingProjection.vue';
import PlanCompare from './components/PlanCompare.vue';
import RiskPanel from './components/RiskPanel.vue';
import PrintSheet from './components/PrintSheet.vue';
import ConfirmContainerDialog from './components/ConfirmContainerDialog.vue';

const props = defineProps<{ repository?: PlannerRepository; printPort?: PrintPort }>();
const planner = usePlanner({ repository: props.repository ?? new LocalPlannerRepository(window.localStorage), printPort: props.printPort ?? new BrowserPrintAdapter() });
const selectedItem = ref('');
const openPath = ref<string[]>([]);
const errors = computed(() => validateSuitcase(planner.state.suitcase));
const containerById = computed(() => new Map(planner.state.containers.map((container) => [container.id, container])));
const pathContainers = computed(() => openPath.value.map((id) => containerById.value.get(id)).filter((container): container is Container => Boolean(container)));
const activeContainerId = computed(() => openPath.value[openPath.value.length - 1] ?? null);
const activeContainer = computed(() => activeContainerId.value ? containerById.value.get(activeContainerId.value) : undefined);
const activePlan = computed(() => getActivePlan(planner.currentPlan.value, activeContainerId.value));
const activeBox = computed<Dimensions>(() => activeContainer.value
  ? { length: activeContainer.value.innerLength, width: activeContainer.value.innerWidth, height: activeContainer.value.innerHeight }
  : planner.state.suitcase);
const activeItems = computed(() => planner.state.items.filter((item) => (item.parentId ?? null) === activeContainerId.value));
const activeContainers = computed(() => planner.state.containers.filter((container) => (container.parentId ?? null) === activeContainerId.value));
const activeContainerPlan = computed(() => activeContainerId.value ? planner.currentPlan.value.containerPlans.find((plan) => plan.container.id === activeContainerId.value) : undefined);
watch(containerById, () => {
  if (activeContainerId.value && !containerById.value.has(activeContainerId.value)) openPath.value = [];
});
const dialog = ref<{ action: 'move' | 'remove'; containerId: string; initialTargetId?: string | null } | null>(null);
const dialogContainer = computed(() => dialog.value ? containerById.value.get(dialog.value.containerId) : undefined);
const dialogInitialTargetId = computed(() => dialog.value && dialog.value.initialTargetId !== undefined ? dialog.value.initialTargetId : dialogContainer.value?.parentId ?? null);
const dialogImpact = computed(() => dialogContainer.value ? planner.previewContainerRemoval(dialogContainer.value.id) : undefined);

function openContainer(id: string) {
  if (!openPath.value.includes(id)) openPath.value = [...openPath.value, id];
}
function closeTo(index: number) {
  openPath.value = index < 0 ? [] : openPath.value.slice(0, index + 1);
}
function requestMove(id: string, initialTargetId?: string | null) { dialog.value = { action: 'move', containerId: id, initialTargetId }; }
function requestRemove(id: string) { dialog.value = { action: 'remove', containerId: id }; }
function cancelDialog() { dialog.value = null; }
function confirmMove(parentId: string | null) {
  if (!dialogContainer.value || !canContain(dialogContainer.value.id, parentId, planner.state.containers)) return;
  planner.moveContainer(dialogContainer.value.id, parentId);
  dialog.value = null;
  openPath.value = [];
}
function confirmRemove(mode: ContainerDeleteMode) {
  if (!dialogContainer.value) return;
  planner.removeContainer(dialogContainer.value.id, mode);
  dialog.value = null;
  openPath.value = [];
}
function moveOutActiveItem(id: string) {
  planner.moveItem(id, activeContainer.value?.parentId ?? null);
}
function moveOutActiveContainer(id: string) {
  const container = containerById.value.get(id);
  if (container) requestMove(id, activeContainer.value?.parentId ?? null);
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand"><span class="brand-mark">PACK<br><b>WISE</b></span><div><small>TRAVEL LAB / 004</small><h1>行李箱空间规划师</h1></div></div><div class="header-actions"><span :class="{ stale: planner.isStale.value }">{{ planner.isStale.value ? '方案待更新' : '规划已同步' }}</span><button type="button" data-testid="print-button" @click="planner.print">打印清单</button><button type="button" class="primary" :disabled="errors.length > 0" @click="planner.regenerate">智能装箱 ↗</button></div></header>
    <main>
      <section class="hero"><div><small>NESTED CONTAINERS · SPACE · WEIGHT</small><h2>先装满相机包，<em>再把它装进箱。</em></h2><p>按容器内尺寸规划子物品，外层只使用容器外尺寸、自重与内部实装重量。</p></div><div class="hero-stamp"><b>{{ planner.state.containers.length }}</b><span>CONTAINERS<br>NESTED</span></div></section>
      <PlanCompare :plans="planner.plans.value" :selected="planner.state.selectedPlan" :suitcase="planner.state.suitcase" @select="planner.selectPlan" />
      <div class="workspace">
        <aside class="left-column">
          <SuitcaseForm :suitcase="planner.state.suitcase" :errors="errors" @update="planner.updateSuitcase" />
          <section class="panel inventory">
            <div class="section-title"><div><span>02 / NESTED INVENTORY</span><h2>{{ activeContainer ? activeContainer.name : '待装物品' }}</h2></div><b>{{ activeItems.length }} 物 · {{ activeContainers.length }} 盒</b></div>
            <nav class="breadcrumbs" aria-label="容器层级"><button type="button" @click="closeTo(-1)">行李箱</button><template v-for="(container, index) in pathContainers" :key="container.id"><span>/</span><button type="button" @click="closeTo(index)">{{ container.name }}</button></template></nav>
            <ContainerEditor :parent-id="activeContainerId" @add="planner.addContainer" />
            <ItemEditor :containers="planner.state.containers" :parent-id="activeContainerId" @add="planner.addItem" />
            <ContainerList v-if="activeContainers.length" :containers="activeContainers" :plan="activePlan" :can-move-out="Boolean(activeContainer)" @open="openContainer" @move="requestMove" @remove="requestRemove" @move-out="moveOutActiveContainer" @toggle="(id, mustHave) => planner.updateContainer(id, { mustHave })" />
            <ItemList :items="activeItems" :plan="activePlan" :inside-container="Boolean(activeContainer)" @remove="planner.removeItem" @toggle="(id, mustHave) => planner.updateItem(id, { mustHave })" @move-out="moveOutActiveItem" />
            <p v-if="activeContainer && activeContainerPlan" class="container-summary">实装 {{ activeContainerPlan.packedWeight.toFixed(2) }} kg（自重 {{ activeContainer.weight.toFixed(2) }} kg + 内部 {{ activeContainerPlan.innerPlan.totalWeight.toFixed(2) }} kg）；{{ activeContainerPlan.innerPlan.pendingObjectCount }} 个待处理对象。</p>
          </section>
        </aside>
        <section class="right-column">
          <div class="canvas-panel">
            <div class="canvas-head"><div><span>03 / LAYERED PACKING MAP</span><h2>{{ planner.currentPlan.value.name }} · {{ activeContainer ? activeContainer.name + '内部摆放' : '行李箱摆放' }}</h2><nav class="map-breadcrumbs"><button type="button" @click="closeTo(-1)">行李箱</button><template v-for="(container, index) in pathContainers" :key="container.id"><span>/</span><button type="button" :class="{ current: index === pathContainers.length - 1 }" @click="closeTo(index)">{{ container.name }}</button></template></nav></div><div class="metrics"><span><b>{{ Math.round(activePlan.capacityRatio * 100) }}%</b>本层空间</span><span><b>{{ activePlan.totalWeight.toFixed(2) }}</b>{{ activeContainer ? '内部 kg' : 'kg 已装' }}</span><span><b>{{ activePlan.pendingObjectCount }}</b>本层待处理</span></div></div>
            <div class="projections"><PackingProjection view="top" :plan="activePlan" :box="activeBox" :items="planner.state.items" :containers="planner.state.containers" :selected-id="selectedItem" @select="selectedItem = $event" @open-container="openContainer" /><PackingProjection view="side" :plan="activePlan" :box="activeBox" :items="planner.state.items" :containers="planner.state.containers" :selected-id="selectedItem" @select="selectedItem = $event" @open-container="openContainer" /></div>
            <p class="canvas-note">点击 ▣ 容器色块可逐层打开内部摆放图；返回上层后，容器内部物品不会在外层重复计数。</p>
          </div>
          <RiskPanel :risks="planner.risks.value" />
        </section>
      </div>
      <p class="notice" aria-live="polite">{{ planner.notice.value }}</p>
    </main>
    <PrintSheet :suitcase="planner.state.suitcase" :items="planner.state.items" :containers="planner.state.containers" :plan="planner.currentPlan.value" :risks="planner.risks.value" />
    <ConfirmContainerDialog v-if="dialogContainer && dialogImpact && dialog" :action="dialog.action" :container="dialogContainer" :containers="planner.state.containers" :impact="dialogImpact" :initial-target-id="dialogInitialTargetId" @confirm-move="confirmMove" @confirm-remove="confirmRemove" @cancel="cancelDialog" />
  </div>
</template>
