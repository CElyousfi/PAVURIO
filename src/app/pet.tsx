import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PetAvatar } from '../animation/PetAvatar';
import { Pet, ValidationError, archivePet, deletePet, getPet, listPets, petFileUris, updatePet } from '../data/repo';
import { removeStoredFile } from '../native/files';
import { dayKeyOf } from '../domain/time';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { DateField, Field, ModalScreen } from '../ui/forms';
import { Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback } from '../native/haptics';
import { t } from '../i18n';
import { Missing } from '../ui/Missing';

export default function PetEditor() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { db, bump, reload, pet: active, switchPet } = useApp();
  const [p, setP] = useState<Pet | null>(null);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<string | null>(null);
  const [adopt, setAdopt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getPet(db, params.id).then((x) => {
      if (!x) return router.back();
      setP(x);
      setName(x.name);
      setBirth(x.birthDate);
      setAdopt(x.adoptionDate);
    });
  }, [db, params.id]);

  if (!p) return params.id ? null : <Missing />;
  const today = dayKeyOf(new Date());

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updatePet(db, p.id, { name, birthDate: birth, adoptionDate: adopt });
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const leave = async () => {
    const left = await listPets(db);
    await reload();
    bump();
    // no pets left: start over with onboarding instead of an empty app
    if (left.length === 0) router.replace('/onboarding');
    else router.dismissTo('/pets');
  };

  return (
    <ModalScreen
      title={p.name}
      onClose={() => router.back()}
      error={error}
      footer={<Pill label={t('SAVE')} onPress={save} loading={saving} testID="save-pet" />}
    >
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ width: 120, height: 120, borderRadius: 40, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <PetAvatar species={p.species} appearance={p.appearance} size={110} />
        </View>
        <SoftPill
          label={t('Change look')}
          small
          onPress={async () => {
            if (active?.id !== p.id) await switchPet(p.id);
            router.push('/studio');
          }}
        />
      </View>
      <Field label={t('Name')} value={name} onChangeText={setName} maxLength={40} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateField label={t('Birthday')} value={birth} onChange={setBirth} allowClear maxDay={today} placeholder={t('Unknown')} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label={t('Adoption day')} value={adopt} onChange={setAdopt} allowClear maxDay={today} placeholder={t('Unknown')} />
        </View>
      </View>

      <View style={{ marginTop: 18, gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.canvasWarm }}>
        <T weight="black" style={{ fontSize: 16 }}>
          {t('Archive or delete')}
        </T>
        <T style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}>
          {t('Archiving hides {name} and stops reminders but keeps every record. Deleting removes {name} and all care, records and moments from this device for good.', { name: p.name })}
        </T>
        <SoftPill
          label={t('Archive {name}', { name: p.name })}
          color={colors.inkSoft}
          tint={colors.line}
          onPress={async () => {
            if (!(await confirmAsync(t('Archive {name}?', { name: p.name }), t('You can restore them from the Pets tab.'), t('Archive')))) return;
            await archivePet(db, p.id);
            await leave();
          }}
        />
        <SoftPill
          label={t('Delete {name} permanently', { name: p.name })}
          color={colors.danger}
          tint={colors.dangerSoft}
          onPress={async () => {
            if (!(await confirmAsync(t('Delete {name} forever?', { name: p.name }), t('All care logs, routines, records, photos and moments for this pet are erased. This cannot be undone.')))) return;
            const files = await petFileUris(db, p.id);
            await deletePet(db, p.id);
            files.forEach(removeStoredFile);
            await leave();
          }}
        />
      </View>
    </ModalScreen>
  );
}
