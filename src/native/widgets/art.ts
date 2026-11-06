/**
 * The widget illustrations live in the app bundle; widgets (a separate process) can only read files
 * from the shared widgets folder. Copy them there once per app version and hand out their file URIs.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import type { WidgetArt } from '../../domain/widgets';

const SOURCES: Record<WidgetArt | 'walk_wide' | 'restock_wide', number> = {
  care: require('../../../assets/art/widgets/care.png'),
  walk: require('../../../assets/art/widgets/walk.png'),
  moment: require('../../../assets/art/widgets/moment.png'),
  pantry: require('../../../assets/art/widgets/pantry.png'),
  done: require('../../../assets/art/widgets/done.png'),
  sleep: require('../../../assets/art/widgets/sleep.png'),
  walk_wide: require('../../../assets/art/widgets/walk_wide.png'),
  restock_wide: require('../../../assets/art/widgets/restock_wide.png'),
};
export type ArtName = keyof typeof SOURCES;

// bump when an illustration changes, so phones copy the new file
const VERSION = 2;
let ready: Promise<Record<ArtName, string>> | null = null;

const dir = () => (widgetsDirectory ? (widgetsDirectory.endsWith('/') ? widgetsDirectory : `${widgetsDirectory}/`) : null);

export function widgetArt(): Promise<Record<ArtName, string>> {
  ready ??= (async () => {
    const base = dir();
    const out = {} as Record<ArtName, string>;
    if (!base) return out;
    for (const [name, mod] of Object.entries(SOURCES) as [ArtName, number][]) {
      const dest = new File(`${base}pv_${name}_v${VERSION}.png`);
      try {
        if (!dest.exists) {
          const a = Asset.fromModule(mod);
          await a.downloadAsync();
          if (a.localUri) new File(a.localUri).copy(dest);
        }
        out[name] = dest.uri;
      } catch (e) {
        console.warn('[pavurio] widget art', name, e);
      }
    }
    return out;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
