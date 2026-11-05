/**
 * Choose the app's language: every language Pavurio speaks, each written in itself, in a sheet.
 * Used by onboarding (the globe button) and Settings.
 */
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Sheet } from './forms';
import { Bouncy } from './motion';
import { Icon, T } from './primitives';
import { colors } from './theme';
import { tapFeedback } from '../native/haptics';
import { LANGS, LANG_FLAGS, LANG_NAMES, Lang, t } from '../i18n';

export function LanguagePicker({ visible, value, onChange, onClose }: { visible: boolean; value: Lang; onChange: (l: Lang) => void; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Language')}>
      <ScrollView style={{ maxHeight: height * 0.62 }} showsVerticalScrollIndicator={false} testID="language-list">
        <View style={styles.grid}>
          {LANGS.map((l) => {
            const on = l === value;
            return (
              <Bouncy
                key={l}
                scaleTo={0.95}
                onPress={() => {
                  tapFeedback();
                  onChange(l);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={LANG_NAMES[l]}
                style={[styles.item, on && styles.on]}
                testID={`lang-${l}`}
              >
                <T style={{ fontSize: 24 }} accessibilityElementsHidden importantForAccessibility="no">
                  {LANG_FLAGS[l]}
                </T>
                <T weight="black" style={{ flex: 1, fontSize: 15, textAlign: 'left', color: on ? '#FFFFFF' : colors.ink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {LANG_NAMES[l]}
                </T>
                {on ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** Short label for the language button: the flag and "EN", "FR", "简"… */
export const langShort = (l: Lang) => `${LANG_FLAGS[l]} ${l === 'zh-Hans' ? '简' : l === 'zh-Hant' ? '繁' : l.toUpperCase()}`;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  item: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card },
  on: { backgroundColor: colors.ink },
});
