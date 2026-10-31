/**
 * Photos and documents the owner attaches. On iOS/Android picked files are copied into the app's
 * document folder (pickers hand out temporary URIs). On web they become data: URLs so they survive
 * reloads inside the local database.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { newId } from '../domain/ids';

export type PickedFile = { uri: string; mime: string | null; name: string | null };
const WEB_MAX_BYTES = 6 * 1024 * 1024;

async function toDataUrl(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  if (blob.size > WEB_MAX_BYTES) throw new Error('That file is larger than 6 MB.');
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function extOf(name: string | null, mime: string | null) {
  const m = name?.match(/\.([a-z0-9]{1,5})$/i);
  if (m) return m[1].toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.startsWith('image/')) return mime.slice(6).replace('jpeg', 'jpg');
  return 'bin';
}

/** Makes a picked file durable and returns where it now lives. */
export async function persistFile(f: PickedFile, folder = 'attachments'): Promise<PickedFile> {
  if (Platform.OS === 'web') return { ...f, uri: await toDataUrl(f.uri) };
  const dir = new Directory(Paths.document, folder);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${newId()}.${extOf(f.name, f.mime)}`);
  new File(f.uri).copy(dest);
  return { ...f, uri: dest.uri };
}

export function removeStoredFile(uri: string) {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn('[pavurio] could not delete file', e);
  }
}

export async function pickPhoto(from: 'library' | 'camera' = 'library'): Promise<PickedFile | null> {
  if (from === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Camera access is off for Pavurio. You can turn it on in Settings.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: false, exif: false };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? null };
}

export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, mime: a.mimeType ?? null, name: a.name ?? null };
}

/** Opens / shares a stored file with the system sheet (or a new tab on web). */
export async function openFile(f: { uri: string; mime: string | null; name: string | null }) {
  if (Platform.OS === 'web') {
    const w = window.open();
    if (w) {
      if (f.mime?.startsWith('image/')) w.document.write(`<img src="${f.uri}" style="max-width:100%">`);
      else w.location.href = f.uri;
    }
    return;
  }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: f.mime ?? undefined, dialogTitle: f.name ?? 'Attachment' });
}

/** Shares plain text as a file (summary, CSV); falls back to a download on web. */
export async function shareText(text: string, filename: string, mime: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const f = new File(Paths.cache, filename);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: filename });
}
