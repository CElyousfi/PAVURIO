#!/usr/bin/env python3
"""Merge part files: python3 merge.py <lang>  (out/<lang>.part*.json -> out/<lang>.json), then runs check.py."""
import json, glob, os, sys, subprocess
here = os.path.dirname(os.path.abspath(__file__))
lang = sys.argv[1]
merged = {}
for p in sorted(glob.glob(os.path.join(here, 'out', f'{lang}.part*.json'))):
    try:
        merged.update(json.load(open(p, encoding='utf-8')))
    except Exception as e:
        print('INVALID JSON in', os.path.basename(p), e); sys.exit(1)
json.dump(merged, open(os.path.join(here, 'out', f'{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
sys.exit(subprocess.call([sys.executable, os.path.join(here, 'check.py'), lang]))
