import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetAvatar } from '../../animation/PetAvatar';
import { Pet, listArchivedPets, unarchivePet } from '../../data/repo';
import { FREE_PET_LIMIT } from '../../native/purchases';
import { useApp } from '../../state/AppState';
import { Card, TabTitle } from '../../ui/forms';
import { CircleButton, Icon, SoftPill, T } from '../../ui/primitives';
import { colors } from '../../ui/theme';
import { successFeedback } from '../../native/haptics';
import { t, tn } from '../../i18n';

function ageLabel(birth: string | null): string | null {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
  if (now.getDate() < d) months -= 1;
  if (months < 0) return null;
  if (months < 1) return t('Under a month');
  if (months < 24) return tn(months, '{n} month', '{n} months');
  return t('{n} years', { n: Math.floor(months / 12) });
}

export default function PetsTab() {
  const { pet, pets, db, pro, switchPet, bump, version } = useApp();
  const insets = useSafeAreaInsets();
  const [archived, setArchived] = useState<Pet[]>([]);
  useEffect(() => {
    listArchivedPets(db).then(setArchived);
  }, [db, version]);

  const addPet = () => {
    if (!pro && pets.length >= FREE_PET_LIMIT) router.push({ pathname: '/paywall', params: { reason: 'pets' } });
    else router.push({ pathname: '/onboarding', params: { add: '1' } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <TabTitle
        title={t('Pets')}
        subtitle={pets.length === 1 ? t('Your family') : t('{n} in the family', { n: pets.length })}
        right={<CircleButton icon="plus" label={t('Add a pet')} onPress={addPet} size={50} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }} showsVerticalScrollIndicator={false}>
        {pets.map((p, pi) => {
          const active = p.id === pet?.id;
          const age = ageLabel(p.birthDate);
          return (
            <Card
              key={p.id}
              enter={pi}
              onPress={async () => {
                if (!active) {
                  await switchPet(p.id);
                  successFeedback();
                }
                router.navigate('/');
              }}
              accessibilityLabel={active ? t('{name}, active. Open Home', { name: p.name }) : t('Switch to {name}', { name: p.name })}
              style={[styles.pet, active && { borderColor: colors.brand }]}
            >
              <View style={styles.av}>
                <PetAvatar species={p.species} appearance={p.appearance} size={64} />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="black" style={{ fontSize: 19 }} numberOfLines={1}>
                  {p.name}
                </T>
                <T style={{ color: colors.muted, fontSize: 14 }}>
                  {p.species === 'dog' ? t('Dog') : t('Cat')}
                  {age ? ` · ${age}` : ''}
                </T>
                {active ? (
                  <T weight="black" style={{ color: colors.brand, fontSize: 12, letterSpacing: 1, marginTop: 2 }}>
                    {t('ON HOME NOW')}
                  </T>
                ) : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Edit {title}', { title: p.name })} onPress={() => router.push({ pathname: '/pet', params: { id: p.id } })} style={styles.edit} hitSlop={6}>
                <Icon name="more" size={20} color={colors.inkSoft} />
              </Pressable>
            </Card>
          );
        })}

        <Pressable accessibilityRole="button" accessibilityLabel={t('Add a pet')} onPress={addPet} style={styles.add}>
          <Icon name="plus" size={20} color={colors.brand} />
          <T weight="black" style={{ color: colors.brand, fontSize: 16 }}>
            {t('Add a pet')}
          </T>
          {!pro && pets.length >= FREE_PET_LIMIT ? (
            <View style={styles.proTag}>
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 11, letterSpacing: 1 }}>
                PRO
              </T>
            </View>
          ) : null}
        </Pressable>

        {archived.length ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            <T weight="black" style={{ fontSize: 17 }}>
              {t('Archived')}
            </T>
            <T style={{ color: colors.muted, fontSize: 13, marginTop: -4 }}>{t('Their history is kept. Bring them back any time.')}</T>
            {archived.map((p) => (
              <View key={p.id} style={styles.arch}>
                <PetAvatar species={p.species} appearance={p.appearance} size={40} />
                <T weight="black" style={{ flex: 1, fontSize: 16, color: colors.inkSoft }}>
                  {p.name}
                </T>
                <SoftPill
                  label={t('Restore')}
                  small
                  onPress={async () => {
                    if (!pro && pets.length >= FREE_PET_LIMIT) return router.push({ pathname: '/paywall', params: { reason: 'pets' } });
                    await unarchivePet(db, p.id);
                    bump();
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

        <Card onPress={() => router.push('/settings')} accessibilityLabel={t('Open settings')} style={[styles.pet, { marginTop: 16 }]}>
          <View style={[styles.av, { backgroundColor: colors.line, width: 48, height: 48 }]}>
            <Icon name="menu" size={22} color={colors.inkSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="black" style={{ fontSize: 16 }}>
              {t('Settings')}
            </T>
            <T style={{ color: colors.muted, fontSize: 13 }}>
              {t('Plan, units, language, export')}
              {pro ? ' · Pro' : ''}
            </T>
          </View>
          <Icon name="chevR" size={18} color={colors.faint} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, borderColor: 'transparent' },
  av: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  edit: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 60, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line },
  proTag: { backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  arch: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, backgroundColor: colors.canvasWarm },
});
