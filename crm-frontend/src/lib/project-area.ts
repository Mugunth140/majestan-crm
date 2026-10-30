/** Project area is stored in square feet regardless of the editor's unit. */
export function formatProjectArea(value: string | number | null | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  const sqft = Number(value);
  if (!Number.isFinite(sqft) || sqft <= 0) return undefined;
  if (sqft >= 43560) {
    const acres = sqft / 43560;
    return `${acres.toLocaleString('en-IN', { maximumFractionDigits: 4 })} ${acres === 1 ? 'acre' : 'acres'}`;
  }
  return `${sqft.toLocaleString('en-IN', { maximumFractionDigits: 2 })} sqft`;
}
