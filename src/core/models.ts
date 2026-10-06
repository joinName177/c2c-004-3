export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';
export type PackingKind = 'item' | 'container';

export interface Suitcase extends Dimensions {
  maxWeight: number;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
  kind?: 'item';
  parentId?: string | null;
}

export interface Container extends Dimensions {
  id: string;
  name: string;
  category: '容器';
  /** 容器自重；参与外层重量计算。 */
  weight: number;
  priority: 1 | 2 | 3;
  mustHave?: boolean;
  fragile?: boolean;
  kind: 'container';
  parentId?: string | null;
  innerLength: number;
  innerWidth: number;
  innerHeight: number;
}

export type PackingObject = PackingItem | Container;

export interface Placement {
  itemId: string;
  kind?: PackingKind;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface UnplacedObject {
  object: PackingObject;
  reason: string;
}

export interface ContainerPlan {
  container: Container;
  innerPlan: PackingPlan;
  packedWeight: number;
  effectivePriority: 1 | 2 | 3;
  effectiveMustHave: boolean;
  /** 容器层级内所有归属的叶子物品。 */
  leafItemIds: string[];
  /** 当前容器已装入时，物理上确实在其中的叶子物品。 */
  loadedItemIds: string[];
  /** 已归属但因本层或下级未装入而无法带走的叶子物品。 */
  pendingItemIds: string[];
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: UnplacedObject[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
  containerPlans: ContainerPlan[];
  /** 已装入的叶子物品 ID（含已装入容器内的物品）。 */
  loadedItemIds: string[];
  /** 整趟行李中不能带走的叶子物品 ID。 */
  pendingItemIds: string[];
  /** 各层待处理对象数量；未装入容器的内部不再逐层展开。 */
  pendingObjectCount: number;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
}

export interface PackingSnapshot {
  suitcase: Suitcase;
  items: PackingItem[];
  containers: Container[];
  selectedPlan: PlanMode;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}

export function isContainer(object: PackingObject): object is Container {
  return object.kind === 'container';
}
