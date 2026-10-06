import { planHierarchy } from './container-plan';
import type { Container, PackingItem, PackingPlan, PlanMode, Suitcase } from './models';

export function generatePlans(
  suitcase: Suitcase,
  items: PackingItem[],
  containers: Container[] = [],
): Record<PlanMode, PackingPlan> {
  return {
    minimal: planHierarchy(suitcase, items, containers, 'minimal'),
    comfort: planHierarchy(suitcase, items, containers, 'comfort'),
    shopping: planHierarchy(suitcase, items, containers, 'shopping'),
  };
}
