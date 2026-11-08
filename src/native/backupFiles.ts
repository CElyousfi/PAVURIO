/**
 * The phone side of photo/document backup: the documents folder (expo-file-system) and Cloud Storage
 * (through the cloud API), shaped for src/data/mediaBackup.ts.
 */
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { cloud } from '../cloud/firebase';
import type { LocalFiles, RemoteFiles } from '../data/mediaBackup';

const docRoot = () => (Paths.document.uri.endsWith('/') ? Paths.document.uri : `${Paths.document.uri}/`);
export const documentsRoot = () => (Platform.OS === 'web' ? '' : docRoot());
const fileAt = (path: string) => new File(docRoot() + path);
const mimeOf = (path: string) => (/\.png$/i.test(path) ? 'image/png' : /\.heic$/i.test(path) ? 'image/heic' : /\.pdf$/i.test(path) ? 'application/pdf' : /\.(jpe?g)$/i.test(path) ? 'image/jpeg' : null);

function ensureParent(path: string) {
  const parts = path.split('/').slice(0, -1);
  if (!parts.length) return;
  const dir = new Directory(Paths.document, ...parts);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

export const localFiles: LocalFiles = {
  // null only when the file is really not there; any error reading it is thrown, so the backup
  // counts it as waiting (never as "lost", which would let sign-out go ahead)
  size(path) {
    const f = fileAt(path);
    return f.exists ? (f.size ?? 0) : null;
  },
  remove(path) {
    try {
      const f = fileAt(path);
      if (f.exists) f.delete();
    } catch {
      // nothing to remove
    }
  },
  async rebuildThumb(thumbPath, originalPath) {
    ensureParent(thumbPath);
    const ctx = ImageManipulator.manipulate(fileAt(originalPath).uri);
    const probe = await ctx.renderAsync();
    const c2 = ImageManipulator.manipulate(fileAt(originalPath).uri);
    c2.resize(probe.height > probe.width ? { height: 480 } : { width: 480 });
    const saved = await (await c2.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    new File(saved.uri).move(fileAt(thumbPath));
    return true;
  },
};

export function remoteFiles(uid: string): RemoteFiles {
  return {
    put: (path) => cloud.putFile(uid, path, fileAt(path).uri, mimeOf(path)),
    async get(path) {
      ensureParent(path);
      // download next to the destination, then move into place: a cut-off download never looks like a file
      const tmp = `${path}.part`;
      const f = fileAt(tmp);
      if (f.exists) f.delete();
      const r = await cloud.getFile(uid, path, f.uri);
      const dest = fileAt(path);
      if (dest.exists) dest.delete();
      new File(f.uri).move(dest);
      return r;
    },
    remove: (path) => cloud.removeFile(uid, path),
  };
}
