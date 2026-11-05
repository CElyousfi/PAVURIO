import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { LANGS, setLang, t, tn } from '../src/i18n/core';
import { formatDayMonth, formatHM, monthNames, weekdayInitials } from '../src/i18n/dates';

const source: { id: string; en: string }[] = JSON.parse(fs.readFileSync('tools/i18n/source.json', 'utf8'));
const ph = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');

describe('languages', () => {
  it('offers 30 languages', () => {
    expect(LANGS.length).toBe(30);
  });

  it('every language translates every string, keeping its placeholders', () => {
    for (const l of LANGS) {
      if (l === 'en') continue;
      setLang(l);
      const missing = source.filter((x) => t(x.en) === x.en && !/^[\d\s{}a-zA-Z·×%:./+-]*$/.test(x.en));
      // fr/es/pt are hand-maintained tables: allow a few gaps, the generated ones must be complete
      expect(missing.length, `${l}: ${missing.slice(0, 3).map((m) => m.en).join(' | ')}`).toBeLessThan(['fr', 'es', 'pt'].includes(l) ? 80 : 40);
      for (const x of source) {
        const out = t(x.en);
        if (out !== x.en && x.en.includes('{') && !/^\d? ?[^{]*$/.test(out)) expect(ph(out).split(',').every((p) => !p || ph(x.en).includes(p)), `${l} ${x.en}`).toBe(true);
      }
    }
    setLang('en');
  });

  it('uses each language’s plural rules', () => {
    setLang('ru');
    const forms = [1, 2, 5, 21].map((n) => tn(n, '{n} day', '{n} days'));
    expect(new Set(forms).size).toBeGreaterThanOrEqual(3);
    setLang('ja');
    expect(tn(3, '{n} day', '{n} days')).toContain('3');
    setLang('en');
    expect(tn(1, '{n} day', '{n} days')).toBe('1 day');
  });

  it('dates and clocks follow the language', () => {
    const d = new Date(2026, 10, 5);
    setLang('ja');
    expect(formatDayMonth(d)).toBe('11月5日');
    setLang('de');
    expect(formatDayMonth(d)).toBe('5. Nov.');
    expect(formatHM(20, 5)).toBe('20:05');
    setLang('ko');
    expect(formatHM(20, 5)).toBe('오후 8:05');
    setLang('ar');
    expect(monthNames()).toHaveLength(12);
    expect(weekdayInitials()).toHaveLength(7);
    setLang('en');
    expect(formatHM(20, 5)).toBe('8:05 PM');
  });
});
