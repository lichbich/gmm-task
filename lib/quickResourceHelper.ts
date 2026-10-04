export interface CustomQuickLink {
  id: string;
  name: string;
  url: string;
  tool?: string; // 'Figma' | 'Draw.io' | 'Sheet' | 'Doc' | 'AI Studio' | 'Github' | 'Other'
  note?: string;
  createdAt: string;
}

const PINNED_STORAGE_KEY_PREFIX = 'saho_pinned_resources_';
const CUSTOM_LINKS_STORAGE_KEY_PREFIX = 'saho_custom_quick_links_';
export const QUICK_RESOURCE_UPDATE_EVENT = 'saho-quick-resources-updated';

export function getPinnedResourceIds(account?: string): string[] {
  if (typeof window === 'undefined') return [];
  const key = `${PINNED_STORAGE_KEY_PREFIX}${account || 'guest'}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePinnedResourceIds(account: string | undefined, ids: string[]): void {
  if (typeof window === 'undefined') return;
  const key = `${PINNED_STORAGE_KEY_PREFIX}${account || 'guest'}`;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(QUICK_RESOURCE_UPDATE_EVENT));
  } catch (e) {
    console.error('Failed to save pinned resources', e);
  }
}

export function togglePinResourceId(account: string | undefined, resourceId: string): boolean {
  const current = getPinnedResourceIds(account);
  const exists = current.includes(resourceId);
  const next = exists ? current.filter((id) => id !== resourceId) : [...current, resourceId];
  savePinnedResourceIds(account, next);
  return !exists;
}

export function isResourcePinned(account: string | undefined, resourceId: string): boolean {
  const current = getPinnedResourceIds(account);
  return current.includes(resourceId);
}

export function getCustomQuickLinks(account?: string): CustomQuickLink[] {
  if (typeof window === 'undefined') return [];
  const key = `${CUSTOM_LINKS_STORAGE_KEY_PREFIX}${account || 'guest'}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomQuickLinks(account: string | undefined, links: CustomQuickLink[]): void {
  if (typeof window === 'undefined') return;
  const key = `${CUSTOM_LINKS_STORAGE_KEY_PREFIX}${account || 'guest'}`;
  try {
    localStorage.setItem(key, JSON.stringify(links));
    window.dispatchEvent(new CustomEvent(QUICK_RESOURCE_UPDATE_EVENT));
  } catch (e) {
    console.error('Failed to save custom quick links', e);
  }
}

export function addCustomQuickLink(
  account: string | undefined,
  link: Omit<CustomQuickLink, 'id' | 'createdAt'>
): CustomQuickLink {
  const current = getCustomQuickLinks(account);
  const newLink: CustomQuickLink = {
    ...link,
    id: 'cql-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString(),
  };
  saveCustomQuickLinks(account, [newLink, ...current]);
  return newLink;
}

export function removeCustomQuickLink(account: string | undefined, id: string): void {
  const current = getCustomQuickLinks(account);
  const next = current.filter((l) => l.id !== id);
  saveCustomQuickLinks(account, next);
}

export function updateCustomQuickLink(
  account: string | undefined,
  id: string,
  updates: Partial<CustomQuickLink>
): void {
  const current = getCustomQuickLinks(account);
  const next = current.map((l) => (l.id === id ? { ...l, ...updates } : l));
  saveCustomQuickLinks(account, next);
}

export function normalizeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
