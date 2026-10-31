const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_AD_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateAdImage(file: Pick<File, 'size' | 'type'>): string | null {
  if (!IMAGE_TYPES.has(file.type)) return 'Choose a JPEG, PNG or WebP image.';
  if (!file.size) return 'This image is empty. Choose another file.';
  if (file.size > MAX_AD_IMAGE_BYTES) return 'This image exceeds 5 MB. Choose a smaller file.';
  return null;
}

export function isInternalAdPath(value: string): boolean {
  // Browsers normalize backslashes and control characters before resolving URLs.
  if (!/^\/[^/\s]/.test(value) || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    return new URL(value, 'https://advertisement.invalid').origin === 'https://advertisement.invalid';
  } catch {
    return false;
  }
}

// Catch a wrong-size creative before uploading; the server re-checks.
export function readAdImageRatio(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
