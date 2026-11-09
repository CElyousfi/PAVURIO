import React, { useState } from 'react';
import { View } from 'react-native';
import type { LostItem } from '../data/mediaBackup';
import { useCloud } from '../state/Cloud';
import { SoftPill, T } from '../ui/primitives';
import { formatDateLong } from '../ui/forms';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';

const SHOWN = 5;

function label(i: LostItem): string {
  if (i.kind === 'adventure') return t('Adventure on {date}', { date: formatDateLong(i.date) });
  const kind = i.kind === 'record' ? t('Record') : t('Memory');
  const title = i.title.trim();
  const date = i.date ? formatDateLong(i.date) : '';
  return [kind, title, date].filter(Boolean).join(' · ');
}

/**
 * Photos or documents missing from this phone and from the backup. They stay listed (nothing is
 * deleted or replaced for the owner); "Look again" asks the cloud for them once more. The owner
 * resolves the rest from the memory or record itself (add the photo again, or remove it).
 */
export function LostFiles() {
  const { files, lostList, lookForLost, busy } = useCloud();
  const [result, setResult] = useState<string | null>(null);
  if (files.lost === 0) return null;
  const look = async () => {
    if (busy) return; // one search at a time
    setResult(null);
    try {
      const r = await lookForLost();
      setResult(r.found > 0 ? tn(r.found, '1 found and backed up again.', '{n} found and backed up again.') : t('Not found in your backup either.'));
    } catch {
      // offline or storage unavailable: nothing changed, the list stays as it was
      setResult(t('Something went wrong'));
    }
  };
  return (
    <View style={{ marginTop: 6, gap: 6 }} testID="backup-lost">
      <T weight="xbold" style={{ color: colors.danger, fontSize: 13, lineHeight: 18 }}>
        {tn(files.lost, '1 photo or document is missing from this phone and from the backup, so it can’t be saved. Open the memory or record it belongs to and add it again or remove it.', '{n} photos or documents are missing from this phone and from the backup, so they can’t be saved. Open the memories or records they belong to and add them again or remove them.')}
      </T>
      {lostList.slice(0, SHOWN).map((i) => (
        <T key={`${i.kind}:${i.id}`} style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} testID="backup-lost-item">
          {`• ${label(i)}`}
        </T>
      ))}
      {lostList.length > SHOWN ? <T style={{ color: colors.muted, fontSize: 13 }}>{tn(lostList.length - SHOWN, '+1 more', '+{n} more')}</T> : null}
      <View testID="backup-look-again" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        <SoftPill label={busy ? t('Backing up…') : t('Look again')} small onPress={() => void look()} />
      </View>
      {result ? (
        <T weight="xbold" style={{ fontSize: 13, color: colors.muted }} testID="backup-look-result">
          {result}
        </T>
      ) : null}
    </View>
  );
}
