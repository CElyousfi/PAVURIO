/** Web and other platforms: no home-screen widgets. Native builds use index.ios.tsx / index.android.tsx. */
import type { Db } from '../../data/db';

export const widgetsSupported = false;
export async function syncWidgets(_db: Db): Promise<void> {}
export function listenToWidgetActions(_db: Db, _onChange: () => void): () => void {
  return () => {};
}
