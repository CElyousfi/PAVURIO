/**
 * Stored photo locations. On iOS the app's container path can change (updates, reinstall, device
 * restore), so Memories stores files relative to the documents folder as `pv-doc:<path>` and resolves
 * them when read. Older absolute `file://` URIs and web `data:` URLs pass through unchanged.
 */
export const DOC_PREFIX = 'pv-doc:';
let docRoot: string | null = null;

export function setDocRoot(uri: string) {
  docRoot = uri.endsWith('/') ? uri : `${uri}/`;
}

export function resolveUri(u: string): string;
export function resolveUri(u: string | null): string | null;
export function resolveUri(u: string | null): string | null {
  if (u && u.startsWith(DOC_PREFIX)) return docRoot ? docRoot + u.slice(DOC_PREFIX.length) : u;
  return u;
}

/** The stored form of a file inside the documents folder (absolute URIs elsewhere stay as they are). */
export function storedUri(absolute: string): string {
  if (docRoot && absolute.startsWith(docRoot)) return DOC_PREFIX + absolute.slice(docRoot.length);
  return absolute;
}

/** Memory rows keep a copy of the photo location for older readers — never a whole data: URL. */
export const rowPhotoUri = (stored: string | null) => (stored && stored.startsWith('data:') ? null : stored);
