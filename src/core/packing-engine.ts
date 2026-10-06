import { intersects, rotationsOf } from './geometry';
import { itemVolume, suitcaseVolume, isContainer, type Dimensions, type PackingItem, type PackingObject, type PackingPlan, type Placement, type PlanMode, type Suitcase, type UnplacedObject } from './models';

const PLAN_NAMES: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };
export const RESERVE: Record<PlanMode, number> = { minimal: 0.8, comfort: 1, shopping: 0.65 };

type PackingBox = Dimensions & { maxWeight?: number };

interface PackingResult {
  placements: Placement[];
  unplaced: UnplacedObject[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export function validateSuitcase(suitcase: Suitcase): string[] {
  const errors: string[] = [];
  if (!(suitcase.length > 0)) errors.push('行李箱长度必须大于 0');
  if (!(suitcase.width > 0)) errors.push('行李箱宽度必须大于 0');
  if (!(suitcase.height > 0)) errors.push('行李箱高度必须大于 0');
  if (!(suitcase.maxWeight > 0)) errors.push('承重必须大于 0');
  return errors;
}

export function validateContainer(object: PackingObject): string[] {
  const errors: string[] = [];
  if (!(object.length > 0)) errors.push('外部长度必须大于 0');
  if (!(object.width > 0)) errors.push('外部宽度必须大于 0');
  if (!(object.height > 0)) errors.push('外部高度必须大于 0');
  if (!(object.weight >= 0)) errors.push('容器自重不能为负数');
  if (isContainer(object)) {
    if (!(object.innerLength > 0)) errors.push('内部长度必须大于 0');
    if (!(object.innerWidth > 0)) errors.push('内部宽度必须大于 0');
    if (!(object.innerHeight > 0)) errors.push('内部高度必须大于 0');
    if (object.innerLength > object.length || object.innerWidth > object.width || object.innerHeight > object.height) {
      errors.push('内部尺寸不能大于外部尺寸');
    }
  } else if (!(object.weight > 0)) {
    errors.push('物品重量必须大于 0');
  }
  return errors;
}

function ordered(objects: PackingObject[], mode: PlanMode): PackingObject[] {
  return [...objects].sort((a, b) => {
    const required = Number(Boolean(b.mustHave)) - Number(Boolean(a.mustHave));
    if (required) return required;
    const priority = b.priority - a.priority;
    if (priority) return priority;
    return mode === 'shopping' ? a.weight - b.weight : itemVolume(b) - itemVolume(a) || a.id.localeCompare(b.id);
  });
}

function candidatePoints(placements: Placement[]) {
  const points = [{ x: 0, y: 0, z: 0 }];
  for (const p of placements) {
    points.push(
      { x: p.x + p.dimensions.length, y: p.y, z: p.z },
      { x: p.x, y: p.y + p.dimensions.width, z: p.z },
      { x: p.x, y: p.y, z: p.z + p.dimensions.height },
    );
  }
  return points.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
}

function hasInvalidMeasurements(object: PackingObject): boolean {
  const values = [object.length, object.width, object.height, object.weight];
  if (isContainer(object)) values.push(object.innerLength, object.innerWidth, object.innerHeight);
  return values.some((value) => !Number.isFinite(value) || (isContainer(object) ? value < 0 : !(value > 0)));
}

export function packIntoBox(box: PackingBox, objects: PackingObject[], mode: PlanMode, reserveFactor = 1): PackingResult {
  const placements: Placement[] = [];
  const unplaced: UnplacedObject[] = [];
  const capacity = suitcaseVolume(box) * reserveFactor;
  const maxWeight = (box.maxWeight ?? Number.POSITIVE_INFINITY) * reserveFactor;
  let totalWeight = 0;
  let usedVolume = 0;

  for (const object of ordered(objects, mode)) {
    if (hasInvalidMeasurements(object)) {
      unplaced.push({ object, reason: '尺寸或重量无效' });
      continue;
    }
    if (totalWeight + object.weight > maxWeight) {
      unplaced.push({ object, reason: '超过当前方案承重预留' });
      continue;
    }
    if (usedVolume + itemVolume(object) > capacity) {
      unplaced.push({ object, reason: '超过当前方案空间预留' });
      continue;
    }

    let placement: Placement | undefined;
    for (const point of candidatePoints(placements)) {
      for (const dimensions of rotationsOf(object)) {
        const candidate: Placement = { itemId: object.id, kind: object.kind, ...point, dimensions };
        const inBounds = candidate.x + dimensions.length <= box.length
          && candidate.y + dimensions.width <= box.width
          && candidate.z + dimensions.height <= box.height;
        if (inBounds && placements.every((placed) => !intersects(candidate, placed))) {
          placement = candidate;
          break;
        }
      }
      if (placement) break;
    }

    if (!placement) {
      unplaced.push({ object, reason: '没有可用的连续空间' });
      continue;
    }
    placements.push(placement);
    totalWeight += object.weight;
    usedVolume += itemVolume(object);
  }

  return {
    placements,
    unplaced,
    totalWeight,
    usedVolume,
    capacityRatio: suitcaseVolume(box) ? usedVolume / suitcaseVolume(box) : 0,
  };
}

export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): PackingPlan {
  const result = packIntoBox(suitcase, items.map((item) => ({ ...item, kind: 'item' as const })), mode, RESERVE[mode]);
  return {
    id: mode,
    name: PLAN_NAMES[mode],
    ...result,
    containerPlans: [],
    loadedItemIds: result.placements.map((placement) => placement.itemId),
    pendingItemIds: result.unplaced.map(({ object }) => object.id),
    pendingObjectCount: result.unplaced.length,
  };
}
