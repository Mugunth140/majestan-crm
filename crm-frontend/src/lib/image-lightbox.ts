// crm/crm-frontend/src/lib/image-lightbox.ts

/**
 * Step through a gallery with wrap-around. dir is 1 (next) or -1 (prev).
 * Guards empty galleries so keyboard handlers never produce NaN indices.
 */
export function lightboxStep(index: number, total: number, dir: 1 | -1): number {
  if (total <= 0) return 0;
  return (index + dir + total) % total;
}
