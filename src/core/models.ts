export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface PackingSpace extends Dimensions {
  maxWeight: number;
}

export interface Suitcase extends PackingSpace {}

interface PackingEntityBase extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
  /** Parent container. null means the entity can participate in the outer suitcase. */
  containerId?: string | null;
}

export interface PackingItem extends PackingEntityBase {
  kind?: 'item';
}

export interface Container extends PackingEntityBase {
  kind: 'container';
  innerLength: number;
  innerWidth: number;
  innerHeight: number;
}

export type PackingEntity = PackingItem | Container;

export function isContainer(entity?: PackingEntity | null): entity is Container {
  return entity?.kind === 'container';
}

export function innerDimensions(container: Container): Dimensions {
  return { length: container.innerLength, width: container.innerWidth, height: container.innerHeight };
}

export interface Placement {
  itemId: string;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: Array<{ item: PackingEntity; reason: string }>;
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface ContainerPlan {
  containerId: string;
  containerName: string;
  plan: PackingPlan;
}

export interface HierarchicalPlan extends PackingPlan {
  containerPlans: Record<string, ContainerPlan>;
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
  items: PackingEntity[];
  selectedPlan: PlanMode;
  plans?: Record<PlanMode, HierarchicalPlan>;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}
