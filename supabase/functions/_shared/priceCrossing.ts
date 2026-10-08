export function crosses(previous: number | null, current: number, target: number, direction: string): boolean {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(current)) return false;
  return direction === 'above' ? previous <= target && current > target : previous >= target && current < target;
}