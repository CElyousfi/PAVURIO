/**
 * Add or edit a pantry item. Pick a category (illustrated), and smart defaults come from the pet's own
 * plan: dry food follows logged meals, medicine follows logged doses (when the plan has medicine), poop
 * bags follow the number of walks; the rest asks the one thing that matters — how long a pack lasts.
 * With several pets, an item can be just for this pet or for everyone.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SupplyKind, SupplyUnit, perDayFromLasting } from '../domain/supplies';
import type { CareType } from '../domain/care';
import { ValidationError } from '../data/repo';
import { archiveSupply, createSupply, getDefaults, getSupply, setDefault, updateSupply } from '../data/suppliesRepo';
import { KIND_META, PantryIcon, qty, templatesFor, useSupplies } from '../features/supplies';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, Field, ModalScreen } from '../ui/forms';
import { DarkTile } from '../ui/Tiles';
import { Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback } from '../native/haptics';
import { requestPermission } from '../native/notifications';
import { t, tn } from '../i18n';

const LEFT = [1, 0.75, 0.5, 0.25];
const LEAD = [1, 2, 3, 5, 7];

export default function SupplyEditor() {
  const p = useLocalSearchParams<{ id?: string; template?: string; name?: string }>();
  const { pet, pets, db, bump, plan, portions } = useApp();
  const { forecasts } = useSupplies();
  const templates = useMemo(() => (pet ? templatesFor(pet.species, plan) : []), [pet, plan]);
  const [tplId, setTplId] = useState<string>(p.template ?? 'food');
  const tpl = templates.find((x) => x.id === tplId) ?? templates[0];
  const [kind, setKind] = useState<SupplyKind>(tpl?.kind ?? 'food');
  const [shared, setShared] = useState(false);
  // a second food for a pet that already has one: ask whether meals should come out of this one now
  const [hasDefault, setHasDefault] = useState(false);
  const [makeDefault, setMakeDefault] = useState(false);
  const [name, setName] = useState(p.name ?? tpl?.name() ?? '');
  const [nameTouched, setNameTouched] = useState(!!p.name || !!p.id);
  const [unit, setUnit] = useState<SupplyUnit>(tpl?.unit ?? 'g');
  const [packSize, setPackSize] = useState(tpl?.packSize ?? 1000);
  const [packText, setPackText] = useState('');
  const [leftShare, setLeftShare] = useState<number | null>(1);
  const [link, setLink] = useState<CareType | null>(tpl?.link ?? null);
  const [lasting, setLasting] = useState<number | null>(21);
  const [perDayN, setPerDayN] = useState<number | null>(null);
  const [lead, setLead] = useState(2);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!p.id);

  // a template (or a kind tile) sets sensible defaults, until the owner changes them
  const applyKind = (id: string) => {
    const x = templates.find((y) => y.id === id);
    if (!x) return;
    setTplId(id);
    setKind(x.kind);
    if (!nameTouched) setName(x.name());
    setUnit(x.unit);
    setPackSize(x.packSize);
    setPackText('');
    setLink(x.link);
    const pd = pet ? x.perDay({ plan, portions }) : null;
    setPerDayN(x.lasting && x.lasting.length === 0 ? pd : null);
    setLasting(x.lasting && x.lasting.length ? 21 : null);
  };
  useEffect(() => {
    if (!p.id && p.template) applyKind(p.template);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.length]);

  useEffect(() => {
    if (!p.id) return;
    getSupply(db, p.id).then((s) => {
      if (!s) return router.back();
      setKind(s.kind);
      setShared(s.shared);
      const match = templates.find((y) => y.kind === s.kind);
      if (match) setTplId(match.id);
      setName(s.name);
      setUnit(s.unit);
      setPackSize(s.packSize);
      setLink(s.link);
      setLead(s.leadDays);
      setPrice(s.price != null ? String(s.price) : '');
      if (!s.link && s.perDay) {
        const days = Math.round(s.packSize / s.perDay);
        if (match?.lasting && match.lasting.length === 0) setPerDayN(s.perDay);
        else setLasting(days);
      }
      setLeftShare(null);
      setLoaded(true);
    });
  }, [db, p.id, templates]);

  useEffect(() => {
    if (!pet || !link) return setHasDefault(false);
    void getDefaults(db).then((d) => setHasDefault(!!d[pet.id]?.[link] && d[pet.id]?.[link] !== p.id));
  }, [db, pet, link, p.id]);

  if (!pet || !loaded) return null;
  const meta = KIND_META[kind];
  const editingF = p.id ? forecasts?.find((f) => f.supply.id === p.id) : undefined;
  const effectivePack = packText ? Number(packText.replace(',', '.')) * (unit === 'g' ? 1000 : 1) : packSize;
  const presets = (tpl?.presets ?? [packSize]).filter((v, i, a) => a.indexOf(v) === i);
  const lastingOptions = tpl?.lasting;
  const perDay = link ? null : perDayN != null ? perDayN : lasting ? perDayFromLasting(effectivePack, lasting) : null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        petId: pet.id,
        shared,
        kind,
        name,
        unit,
        packSize: effectivePack,
        stock: leftShare != null ? effectivePack * leftShare : editingF?.left ?? effectivePack,
        link,
        perDay,
        leadDays: lead,
        price: price.trim() ? Number(price.replace(',', '.')) : null,
      };
      if (p.id) await updateSupply(db, p.id, { ...input, resetStock: leftShare != null });
      else {
        const created = await createSupply(db, input);
        if (link && makeDefault) await setDefault(db, pet.id, link, created.id);
      }
      requestPermission(db).catch(() => null);
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save. Please try again.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!p.id) return;
    if (!(await confirmAsync(t('Remove this item?'), t('Its reminders stop. Your care logs stay as they are.')))) return;
    await archiveSupply(db, p.id);
    bump();
    router.dismissTo('/supplies');
  };

  return (
    <ModalScreen
      title={p.id ? t('Edit item') : t('Add to pantry')}
      onClose={() => router.back()}
      error={error}
      footer={
        <>
          <Pill label={p.id ? t('Save') : t('Add to pantry')} color={meta.color} onPress={save} loading={saving} testID="supply-save" />
          {p.id ? <SoftPill label={t('Remove item')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} /> : null}
        </>
      }
    >
      {!p.id ? (
        <View style={{ gap: 8 }}>
          <Label>{t('What')}</Label>
          <View style={styles.kinds}>
            {templates.map((x) => (
              <DarkTile
                key={x.id}
                title={x.name()}
                selected={x.id === tplId}
                accent={KIND_META[x.kind].color}
                accessibilityRole="radio"
                art={<PantryIcon kind={x.kind} size={58} />}
                onPress={() => applyKind(x.id)}
                height={82}
                style={styles.kind}
                testID={`kind-${x.id}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Field
        label={t('Name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setNameTouched(true);
        }}
        placeholder={t('e.g. Royal Canin Medium Adult')}
        maxLength={60}
      />

      {pets.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Label>{t('Who uses it')}</Label>
          <View style={styles.chips}>
            <Chip label={t('Just {name}', { name: pet.name })} on={!shared} onPress={() => setShared(false)} />
            <Chip label={t('Everyone')} on={shared} onPress={() => setShared(true)} />
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Label>{t('One pack')}</Label>
        <View style={styles.chips}>
          {presets.map((v) => (
            <Chip key={v} label={qty(v, unit)} on={!packText && packSize === v} onPress={() => (setPackSize(v), setPackText(''))} />
          ))}
        </View>
        <Field label="" value={packText} onChangeText={setPackText} keyboardType="decimal-pad" placeholder={t('Other size ({unit})', { unit: unit === 'g' ? 'kg' : unit === 'dose' ? t('doses') : unit === 'pcs' ? t('pcs') : unit })} />
      </View>

      <View style={{ gap: 8 }}>
        <Label>{p.id ? t('What’s left now (optional)') : t('What’s left now')}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <PantryIcon kind={kind} level={leftShare ?? editingF?.level ?? 1} size={62} />
          <View style={[styles.chips, { flex: 1 }]}>
            {LEFT.map((v) => (
              <Chip key={v} label={v === 1 ? t('Full') : v === 0.75 ? '¾' : v === 0.5 ? '½' : '¼'} on={leftShare === v} onPress={() => setLeftShare(leftShare === v && p.id ? null : v)} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.box}>
        {link ? (
          <>
            <T weight="black" style={{ fontSize: 16 }}>
              {link === 'meal' ? t('Follows {name}’s logged meals', { name: pet.name }) : t('Follows {name}’s logged doses', { name: pet.name })}
            </T>
            <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              {link === 'meal'
                ? t('Every meal you log takes its grams out of the bag. After a few days Pavurio learns how much {name} really eats.', { name: pet.name })
                : t('Every dose you log comes out of the box.')}
            </T>
            {hasDefault && !p.id ? (
              <View style={styles.chips}>
                <Chip label={link === 'meal' ? t('Use it for meals from now on') : t('Use it for doses from now on')} on={makeDefault} onPress={() => setMakeDefault(true)} />
                <Chip label={t('Keep the current one')} on={!makeDefault} onPress={() => setMakeDefault(false)} />
              </View>
            ) : null}
          </>
        ) : lastingOptions && lastingOptions.length ? (
          <>
            <T weight="black" style={{ fontSize: 16 }}>
              {t('A pack lasts about')}
            </T>
            <View style={styles.chips}>
              {lastingOptions.map((d) => (
                <Chip key={d} label={d % 7 === 0 && d < 30 ? tn(d / 7, '{n} week', '{n} weeks') : tn(Math.round(d / 30) || 1, '{n} month', '{n} months')} on={lasting === d} onPress={() => setLasting(d)} />
              ))}
            </View>
          </>
        ) : (
          <>
            <T weight="black" style={{ fontSize: 16 }}>
              {t('How many a day?')}
            </T>
            <View style={styles.chips}>
              {(tplId === 'flea' || kind === 'medicine' || kind === 'other' ? [1 / 30, 1 / 7, 1, 2] : [1, 2, 3, 4]).map((v) => (
                <Chip key={v} label={v === 1 / 30 ? t('Once a month') : v === 1 / 7 ? t('Once a week') : tn(v, '{n} a day', '{n} a day')} on={perDayN != null && Math.abs(perDayN - v) < 1e-6} onPress={() => setPerDayN(v)} />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Label>{t('Remind me to buy')}</Label>
        <View style={styles.chips}>
          {LEAD.map((d) => (
            <Chip key={d} label={tn(d, '{n} day before', '{n} days before')} on={lead === d} onPress={() => setLead(d)} />
          ))}
        </View>
      </View>

      <Field label={t('Price of one pack (optional)')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { width: '48.5%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { backgroundColor: colors.canvasWarm, borderRadius: 20, padding: 14, gap: 8 },
});
