/**
 * Ready-made avatars people can pick instead of uploading a photo (DiceBear "Critters", CC0).
 * The files live in crm-frontend/public/avatars/critters; keep this list in step with them.
 */
export const AVATAR_PRESETS = ["0519e4e82d", "0b56302e92", "14ba02180a", "2c585198db", "2f0bacdf85", "406ed19d3e", "43a1a0ee07", "5392a6b63a", "5b6684b518", "6cbad34383", "6d6dcad445", "81b12c8b77", "8bddd9b575", "97d72d26ee", "9df5bf8104", "a4a0798bf4", "a5ebfbfddf", "afe3d4b8c0", "c09b61ab6c", "cac77e4427", "cfeafba0b9", "e7b131df96", "f0fe49b41e", "f4487e3a54"] as const;

export const presetUrl = (name: string) => `/avatars/critters/${name}.svg`;
export const isPreset = (name: unknown): name is string => typeof name === 'string' && (AVATAR_PRESETS as readonly string[]).includes(name);
