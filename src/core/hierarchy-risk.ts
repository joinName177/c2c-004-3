import { createEntityGraph, effectiveMustHave, getChildren, travelState } from './nested-packing';
import { detectRisks } from './risk-engine';
import { innerDimensions, isContainer, type HierarchicalPlan, type PackingEntity, type PackingSpace, type Risk } from './models';

function unique(risks: Risk[]): Risk[] {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    if (seen.has(risk.id)) return false;
    seen.add(risk.id);
    return true;
  });
}

export function detectHierarchyRisks(suitcase: PackingSpace, items: PackingEntity[], hierarchical: HierarchicalPlan): Risk[] {
  const graph = createEntityGraph(items.map((item) => ({ ...item })));
  const risks: Risk[] = [];
  const reachableContainers = new Set<string>();

  function markReachable(plan: HierarchicalPlan | undefined) {
    if (!plan) return;
    for (const placement of plan.placements) {
      if (graph.entities.get(placement.itemId)?.kind === 'container') reachableContainers.add(placement.itemId);
    }
  }

  markReachable(hierarchical);
  let changed = true;
  while (changed) {
    changed = false;
    for (const containerId of [...reachableContainers]) {
      const childPlan = hierarchical.containerPlans[containerId]?.plan as HierarchicalPlan | undefined;
      const before = reachableContainers.size;
      markReachable(childPlan);
      if (reachableContainers.size !== before) changed = true;
    }
  }

  function unitsFor(containerId: string | null): PackingEntity[] {
    return getChildren(graph, containerId).map((entity) => {
      if (!isContainer(entity)) return entity;
      return {
        ...entity,
        weight: hierarchical.containerPlans[entity.id]?.plan.totalWeight ?? entity.weight,
        mustHave: effectiveMustHave(graph, entity),
      };
    });
  }

  for (const risk of detectRisks(hierarchical, suitcase, unitsFor(null))) {
    // Concrete mandatory descendants get their own hierarchy risk below.
    const item = risk.itemId ? graph.entities.get(risk.itemId) : undefined;
    if (risk.id.startsWith('missing-') && item?.kind === 'container') continue;
    risks.push(risk);
  }

  for (const entity of items) {
    if (!isContainer(entity) || !reachableContainers.has(entity.id)) continue;
    const containerPlan = hierarchical.containerPlans[entity.id]?.plan;
    if (!containerPlan) continue;
    const inner = innerDimensions(entity);
    const directRisks = detectRisks(containerPlan, { ...inner, maxWeight: Number.MAX_SAFE_INTEGER }, unitsFor(entity.id))
      .filter((risk) => risk.severity !== 'info' && !risk.id.startsWith('missing-'));
    risks.push(...directRisks.map((risk) => ({
      ...risk,
      id: risk.id.startsWith('missing-') || risk.id.startsWith('oversized-') || risk.id.startsWith('fragile-') || risk.id.startsWith('high-')
        ? `${risk.id}-in-${entity.id}`
        : `${risk.id}-${entity.id}`,
      title: `${entity.name} · ${risk.title}`,
    })));
  }

  // A mandatory item only completes the trip when every ancestor is actually
  // placed. This is the complete-trip verdict across the ownership tree.
  for (const entity of items) {
    if (!entity.mustHave) continue;
    const state = travelState(hierarchical, entity.id, items);
    if (state.placed) continue;
    const blockerName = state.blockingContainerId ? graph.entities.get(state.blockingContainerId)?.name ?? '容器' : '行李箱';
    risks.push({
      id: `missing-${entity.id}-hierarchy`,
      severity: 'critical',
      title: `必需品未随行：${entity.name}`,
      message: `被 ${blockerName} 的「${state.reason}」阻塞；请调整摆放或将其明确移出容器。`,
      itemId: entity.id,
    });
  }

  const materialRisks = unique(risks).filter((risk) => risk.severity !== 'info');
  if (!materialRisks.length) {
    return [{ id: 'all-clear', severity: 'info', title: '装载状态良好', message: '各层重量、空间和必带物品均已检查。' }];
  }
  return materialRisks;
}
