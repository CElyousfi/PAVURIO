#!/usr/bin/env python3
"""Validate a translation file: python3 check.py <lang>  (reads out/<lang>.json)."""
import json, re, sys, os
here = os.path.dirname(os.path.abspath(__file__))
lang = sys.argv[1]
src = json.load(open(os.path.join(here, 'source.json')))
byid = {x['id']: x for x in src}
try:
    out = json.load(open(os.path.join(here, 'out', f'{lang}.json'), encoding='utf-8'))
except Exception as e:
    print('INVALID JSON:', e); sys.exit(1)
ph = lambda s: sorted(re.findall(r'\{[a-zA-Z]+\}', s))
errs = []
for x in src:
    v = out.get(x['id'])
    if not isinstance(v, str) or not v.strip():
        errs.append(f"missing {x['id']}: {x['en'][:60]}")
        continue
    if ph(v) != ph(x['en']):
        # plural "one" forms may drop {n} (e.g. "1 day" -> "un jour"); others must keep every placeholder
        if not (x.get('plural') == 'one' and set(ph(v)) <= set(ph(x['en']))):
            errs.append(f"placeholders {x['id']}: {ph(x['en'])} vs {ph(v)} :: {v[:60]}")
for k, v in out.items():
    if '#' in k:
        base, cat = k.split('#', 1)
        if base not in byid or byid[base].get('plural') != 'other' or cat not in ('zero', 'two', 'few', 'many'):
            errs.append(f'bad plural variant key {k}')
        elif ph(v) != ph(byid[base]['en']):
            errs.append(f'placeholders {k}: {v[:60]}')
    elif k not in byid:
        errs.append(f'unknown id {k}')
for e in errs[:40]:
    print(e)
print(f'{lang}: {len(src) - len([e for e in errs if e.startswith("missing")])}/{len(src)} translated, {len(errs)} problems')
sys.exit(1 if errs else 0)
