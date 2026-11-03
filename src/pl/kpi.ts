// Splitting the order's net profit into sales KPI by deal stage: Thiết kế 13.3 (the Excel's Define B79:F86).
import type { ContractType, PlConfig, PlOrderInput, WeightSet } from './types';

export function chooseWeightSet(applied: ContractType | null, isNewOrder: boolean): WeightSet {
  const service = applied === 'dv_once' || applied === 'dv_recurring';
  if (service) return isNewOrder ? 'new_dvdk' : 'dvdk';
  return isNewOrder ? 'new_tm' : 'tmdk';
}

// Each person gets the weights of the stages they hold, plus the Lead weight for whoever brought a new logo.
// netProfit is after the provision fund draw (Thiết kế 13.6). People keep the order they first appear in, lead first.
export function splitKpi(input: PlOrderInput, weights: PlConfig['dealStageWeights'], netProfit: number,
  applied: ContractType | null): { weightSet: WeightSet; split: { person: string; weight: number; amount: number }[] } {
  const weightSet = chooseWeightSet(applied, input.isNewOrder);
  const set = weights[weightSet];
  const byPerson = new Map<string, number>();
  const add = (person: string | null, weight: number) => {
    if (!person || weight === 0) return;
    byPerson.set(person, (byPerson.get(person) ?? 0) + weight);
  };
  if (input.isNewLogo) add(input.leadPerson, set.lead);
  for (const { stage, person } of input.dealStages) add(person, set[stage] ?? 0);
  return {
    weightSet,
    split: [...byPerson].map(([person, weight]) => ({ person, weight, amount: netProfit * weight })),
  };
}
