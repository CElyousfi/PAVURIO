/**
 * Memories photo import. Pickers hand out temporary URIs, so each photo is copied into the app's
 * document folder (`memories/`) together with a small thumbnail for the scrapbook grid. The camera's
 * capture date (EXIF DateTimeOriginal) decides which day the photo belongs to. Photos are never
 * altered: the original is kept byte for byte; only the thumbnail and exports are re-encoded.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { newId } from '../domain/ids';
import { exifCapturedAt } from '../domain/memories';
import { t } from '../i18n';
import { Db } from '../data/db';
import { MediaAsset, addMedia } from '../data/memoriesRepo';
import { resolveUri, setDocRoot, storedUri } from '../data/uris';

if (Platform.OS !== 'web') setDocRoot(Paths.document.uri);

export type PickedPhoto = { uri: string; width: number; height: number; mime: string; capturedAt: number | null; name: string | null };

const THUMB = 480;
const WEB_MAX = 1600; // web keeps photos as data: URLs in its local database (no file system)

export class MediaError extends Error {}

/** Opens the camera or the gallery (several photos at once from the gallery). Null when cancelled. */
export async function pickPhotos(from: 'camera' | 'library', multiple = true): Promise<PickedPhoto[] | null> {
  if (from === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new MediaError(t('Camera access is off for Pavurio. You can turn it on in Settings.'));
  }
  // the gallery uses the system photo picker (Android Photo Picker / iOS PHPicker): no library permission needed
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
    exif: true,
    allowsMultipleSelection: from === 'library' && multiple,
    selectionLimit: from === 'library' && multiple ? 10 : 1,
    orderedSelection: true,
  };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  return res.assets
    .filter((a) => !a.type || a.type === 'image')
    .map((a) => ({
      uri: a.uri,
      width: a.width || 0,
      height: a.height || 0,
      mime: a.mimeType ?? 'image/jpeg',
      // a fresh camera shot is "now" even if the platform drops EXIF
      capturedAt: exifCapturedAt(a.exif ?? null) ?? (from === 'camera' ? Date.now() : null),
      name: a.fileName ?? null,
    }));
}

function ext(p: PickedPhoto) {
  const m = p.name?.match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  return p.mime.includes('png') ? 'png' : p.mime.includes('heic') ? 'heic' : 'jpg';
}

async function webEncode(uri: string, max: number, compress: number) {
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const big = Math.max(probe.width, probe.height);
  let ref = probe;
  if (big > max) {
    const c2 = ImageManipulator.manipulate(uri);
    c2.resize(probe.width >= probe.height ? { width: max } : { height: max });
    ref = await c2.renderAsync();
  }
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  return { uri: `data:image/jpeg;base64,${out.base64}`, width: out.width, height: out.height };
}

/** Copies a picked photo somewhere durable, makes the thumbnail and records the media row. */
export async function importPhoto(db: Db, p: PickedPhoto): Promise<MediaAsset> {
  try {
    if (Platform.OS === 'web') {
      const full = await webEncode(p.uri, WEB_MAX, 0.88);
      const thumb = await webEncode(p.uri, THUMB, 0.8);
      return await addMedia(db, { uri: full.uri, thumbUri: thumb.uri, width: full.width, height: full.height, mime: 'image/jpeg', capturedAt: p.capturedAt });
    }
    const dir = new Directory(Paths.document, 'memories');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const thumbs = new Directory(dir, 'thumbs');
    if (!thumbs.exists) thumbs.create({ intermediates: true, idempotent: true });
    const id = newId();
    const dest = new File(dir, `${id}.${ext(p)}`);
    new File(p.uri).copy(dest);

    const ctx = ImageManipulator.manipulate(dest.uri);
    ctx.resize(p.width && p.height && p.height > p.width ? { height: THUMB } : { width: THUMB });
    const ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    const thumb = new File(thumbs, `${id}.jpg`);
    new File(saved.uri).move(thumb);

    let { width, height } = p;
    if (!width || !height) {
      const probe = await ImageManipulator.manipulate(dest.uri).renderAsync();
      width = probe.width;
      height = probe.height;
    }
    return await addMedia(db, { uri: storedUri(dest.uri), thumbUri: storedUri(thumb.uri), width, height, mime: p.mime, capturedAt: p.capturedAt });
  } catch (e) {
    console.warn('[pavurio] photo import failed', e);
    const msg = String((e as Error)?.message ?? '');
    if (/space|ENOSPC|full|quota/i.test(msg)) throw new MediaError(t('There isn’t enough storage left to save this photo.'));
    throw new MediaError(t('This photo couldn’t be saved. Please try another one.'));
  }
}

/** Removes files that nothing references any more (see memoriesRepo.releaseMedia). */
export function deleteFiles(uris: string[]) {
  if (Platform.OS === 'web') return;
  for (const u of uris) {
    const uri = resolveUri(u);
    if (!uri.startsWith('file:')) continue;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch (e) {
      console.warn('[pavurio] could not delete file', e);
    }
  }
}

/**
 * Shares a photo without its location: the image is re-encoded (which drops EXIF, GPS included)
 * into the cache first. The stored original is untouched.
 */
export async function sharePhoto(uri: string) {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = 'pavurio-moment.jpg';
    a.click();
    return;
  }
  const ref = await ImageManipulator.manipulate(uri).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out.uri, { mimeType: 'image/jpeg', dialogTitle: t('Share moment') });
}

/** Saves an exported card to the photo library (write-only permission). */
export async function saveImageToLibrary(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = `pavurio-memory-${Date.now()}.jpg`;
    a.click();
    return;
  }
  const p = await MediaLibrary.requestPermissionsAsync(true);
  if (!p.granted) throw new MediaError(t('Photo access is off for Pavurio. You can turn it on in Settings.'));
  await MediaLibrary.saveToLibraryAsync(uri);
}

export async function shareImage(uri: string, title: string) {
  if (Platform.OS === 'web') {
    try {
      const blob = await (await fetch(uri)).blob();
      const file = new window.File([blob], 'pavurio-memory.jpg', { type: 'image/jpeg' });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] })) return await nav.share({ files: [file], title });
    } catch {
      // falls through to a download
    }
    return saveImageToLibrary(uri);
  }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: title, UTI: 'public.jpeg' });
}

/** "Erase everything": removes the Memories photo folder (originals and thumbnails). */
export function removeAllMemoryFiles() {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, 'memories');
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('[pavurio] could not remove memories folder', e);
  }
}
