import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInternalAdPath, MAX_AD_IMAGE_BYTES, validateAdImage, readAdImageRatio } from './ads-validation';

describe('advertisement image validation', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts a supported image: %s', (type) => {
    expect(validateAdImage({ type, size: MAX_AD_IMAGE_BYTES })).toBeNull();
  });
  it.each(['image/svg+xml', 'image/gif', 'text/plain', ''])('rejects unsupported file type: %s', (type) => {
    expect(validateAdImage({ type, size: 100 })).toMatch(/JPEG, PNG or WebP/);
  });
  it('rejects empty and oversized files before upload', () => {
    expect(validateAdImage({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(validateAdImage({ type: 'image/png', size: MAX_AD_IMAGE_BYTES + 1 })).toMatch(/5 MB/);
  });
});

describe('advertisement click destination validation', () => {
  it.each(['/offers/diwali', '/buy/coimbatore?type=villa', '/contact#enquiry'])('accepts internal destination %s', (path) => {
    expect(isInternalAdPath(path)).toBe(true);
  });
  it.each(['https://example.com', '//example.com', '/\\example.com', '/\n/evil.test', '/offer with spaces', 'javascript:alert(1)', '', '/'])('rejects invalid or external destination %s', (path) => {
    expect(isInternalAdPath(path)).toBe(false);
  });
});


describe('advertisement image decoding', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function mockImage(broken: boolean, height = 540) {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ad-validation');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('Image', class {
      naturalWidth = 1920;
      naturalHeight = height;
      onload?: () => void;
      onerror?: () => void;
      set src(_value: string) {
        queueMicrotask(() => broken ? this.onerror?.() : this.onload?.());
      }
    });
    return revoke;
  }

  it('reads the actual pixel ratio and releases the temporary URL', async () => {
    const revoke = mockImage(false);
    expect(await readAdImageRatio(new File(['image'], 'hero.png'))).toBeCloseTo(32 / 9);
    expect(revoke).toHaveBeenCalledWith('blob:ad-validation');
  });

  it('rejects corrupt images even when their MIME type is supported', async () => {
    const revoke = mockImage(true);
    expect(await readAdImageRatio(new File(['broken'], 'hero.png', { type: 'image/png' }))).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:ad-validation');
  });

  it('rejects images without valid dimensions', async () => {
    mockImage(false, 0);
    expect(await readAdImageRatio(new File(['empty'], 'hero.png'))).toBeNull();
  });
});
