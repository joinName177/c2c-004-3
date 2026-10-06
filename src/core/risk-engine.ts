import { rotationsOf } from './geometry';
import { isContainer, type Container, type Dimensions, type PackingItem, type PackingPlan, type Risk, type Suitcase } from './models';

interface BoxLike extends Dimensions {
  maxWeight?: number;
}

interface PositionedItem {
  item: PackingItem;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

function fitsNowhere(object: Dimensions, box: BoxLike): boolean {
  return rotationsOf(object).every((d) => d.length > box.length || d.width > box.width || d.height > box.height);
}

function boxForContainer(container: Container | undefined): BoxLike {
  if (!container) return { length: Number.POSITIVE_INFINITY, width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY };
  return {
    length: container.innerLength,
    width: container.innerWidth,
    height: container.innerHeight,
  };
}

function addUnplacedRisks(
  plan: PackingPlan,
  suitcase: Suitcase,
  items: PackingItem[],
  containers: Container[],
  risks: Risk[],
) {
  const containerById = new Map(containers.map((container) => [container.id, container]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const { object } of plan.unplaced) {
    if (isContainer(object)) {
      const containerPlan = plan.containerPlans.find((candidate) => candidate.container.id === object.id);
      const box = boxForContainer(containerById.get(object.id));
      if (fitsNowhere(object, suitcase)) {
        risks.push({ id: `oversized-container-${object.id}`, severity: 'critical', title: `${object.name} 尺寸越界`, message: '容器任意外部朝向都无法放入当前行李箱。', itemId: object.id });
      }
      if (containerPlan?.effectiveMustHave) {
        risks.push({ id: `missing-container-${object.id}`, severity: 'critical', title: `必需容器未装入：${object.name}`, message: '容器或其内部包含必带物品，请调整外层摆放。', itemId: object.id });
      }
      continue;
    }

    if (fitsNowhere(object, suitcase)) {
      risks.push({ id: `oversized-${object.id}`, severity: 'critical', title: `${object.name} 尺寸越界`, message: '任意旋转方向都无法放入当前行李箱。', itemId: object.id });
    }
  }

  for (const containerPlan of plan.containerPlans) {
    for (const { object } of containerPlan.innerPlan.unplaced) {
      if (isContainer(object)) continue;
      if (fitsNowhere(object, boxForContainer(containerPlan.container)) && !risks.some((risk) => risk.itemId === object.id)) {
        risks.push({ id: `oversized-${object.id}`, severity: 'critical', title: `${object.name} 无法放入 ${containerPlan.container.name}`, message: '该物品任意旋转方向都超过容器内尺寸。', itemId: object.id });
      }
    }
  }
  for (const itemId of plan.pendingItemIds) {
    const item = itemById.get(itemId);
    if (item?.mustHave) {
      risks.push({ id: `missing-${item.id}`, severity: 'critical', title: `必需品未装入：${item.name}`, message: '请调整清单、容器归属或改用更大行李箱；容器内待处理物品需明确移出后才会独立参加外层装箱。', itemId: item.id });
    }
  }
}

function collectPositionedItems(
  plan: PackingPlan,
  containers: Container[],
  items: PackingItem[],
): PositionedItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const containerPlansById = new Map(plan.containerPlans.map((containerPlan) => [containerPlan.container.id, containerPlan]));
  const result: PositionedItem[] = [];

  function walk(currentPlan: PackingPlan, origin: { x: number; y: number; z: number }) {
    for (const placement of currentPlan.placements) {
      if (placement.kind === 'container') {
        const childPlan = containerPlansById.get(placement.itemId);
        if (!childPlan) continue;
        walk(childPlan.innerPlan, {
          x: origin.x + placement.x,
          y: origin.y + placement.y,
          z: origin.z + placement.z,
        });
      } else {
        const item = itemById.get(placement.itemId);
        if (item) result.push({ item, ...origin, x: origin.x + placement.x, y: origin.y + placement.y, z: origin.z + placement.z, dimensions: placement.dimensions });
      }
    }
  }

  walk(plan, { x: 0, y: 0, z: 0 });
  return result;
}

function addPhysicalRisks(plan: PackingPlan, suitcase: Suitcase, items: PackingItem[], containers: Container[], risks: Risk[]) {
  const positioned = collectPositionedItems(plan, containers, items);
  for (const current of positioned) {
    if (current.item.weight >= suitcase.maxWeight * 0.25 && current.z > suitcase.height * 0.5) {
      risks.push({ id: `high-${current.item.id}`, severity: 'warning', title: `${current.item.name} 重心偏高`, message: '将重物移到箱体底部，降低翻倒和挤压风险。', itemId: current.item.id });
    }
    if (!current.item.fragile) continue;
    const hasLoadAbove = positioned.some((other) => other.item.id !== current.item.id
      && other.z >= current.z + current.dimensions.height
      && other.x < current.x + current.dimensions.length && other.x + other.dimensions.length > current.x
      && other.y < current.y + current.dimensions.width && other.y + other.dimensions.width > current.y);
    if (hasLoadAbove) risks.push({ id: `fragile-${current.item.id}`, severity: 'warning', title: `${current.item.name} 受到上方挤压`, message: '请移到上层或增加缓冲保护。', itemId: current.item.id });
  }
}

function legacyPlan(plan: PackingPlan): PackingPlan {
  const unplaced = plan.unplaced.map((entry) => {
    const source = entry as { item?: PackingItem };
    const object = ('object' in entry ? entry.object : source.item) as PackingItem;
    return { object: { ...object, kind: object.kind ?? 'item' }, reason: entry.reason };
  });
  return {
    ...plan,
    placements: plan.placements.map((placement) => ({ ...placement, kind: placement.kind ?? 'item' })),
    containerPlans: plan.containerPlans ?? [],
    loadedItemIds: plan.loadedItemIds ?? plan.placements.map((placement) => placement.itemId),
    pendingItemIds: [...new Set([...(plan.pendingItemIds ?? []), ...unplaced.map(({ object }) => object.id)])],
    pendingObjectCount: plan.pendingObjectCount ?? unplaced.length,
    unplaced,
  };
}

export function detectRisks(inputPlan: PackingPlan, suitcase: Suitcase, items: PackingItem[], containers: Container[] = []): Risk[] {
  const plan = legacyPlan(inputPlan);
  const risks: Risk[] = [];

  if (plan.totalWeight > suitcase.maxWeight) risks.push({ id: 'overweight', severity: 'critical', title: '行李超重', message: `超出承重 ${(plan.totalWeight - suitcase.maxWeight).toFixed(1)} kg，请移除重物。` });
  else if (plan.totalWeight / suitcase.maxWeight > 0.9) risks.push({ id: 'near-weight', severity: 'warning', title: '接近承重上限', message: '建议预留至少 10% 承重余量。' });
  if (plan.capacityRatio > 0.9) risks.push({ id: 'high-volume', severity: 'warning', title: '空间接近满载', message: '空间利用率超过 90%，返程新增物品可能无法装入。' });

  addUnplacedRisks(plan, suitcase, items, containers, risks);
  addPhysicalRisks(plan, suitcase, items, containers, risks);

  if (!risks.length) risks.push({ id: 'all-clear', severity: 'info', title: '装载状态良好', message: '重量、空间、容器嵌套和摆放风险均在合理范围内。' });
  return risks;
}
