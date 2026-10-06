import { generateHierarchicalPlans } from './nested-packing';
import type { HierarchicalPlan, PackingEntity, PlanMode, Suitcase } from './models';

export function generatePlans(suitcase: Suitcase, items: PackingEntity[]): Record<PlanMode, HierarchicalPlan> {
  return generateHierarchicalPlans({ suitcase, items });
}
