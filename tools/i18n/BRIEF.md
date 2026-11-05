# Translating Pavurio

Pavurio is a warm, friendly iPhone/Android app for dog and cat owners: logging daily care (meals, water, walks, medicine, grooming, play, litter), reminders, a pet pantry (food stock and shopping list), health records and vet visits, walks ("adventures") and photo memories. The pets are cute illustrated characters (Honey the dog, Tabby the cat). Tone: kind, short, encouraging, never clinical or guilt-inducing. Think of how Waterllama or Duolingo speak in your language.

## Input
`/home/claude/i18n_work/source.json`: a list of `{id, en, fr?, plural?}`. `en` is the source text; `fr` is the existing French translation (use it only to clarify meaning).

## Output
Write JSON objects mapping id → translation, in **part files**:
`/home/claude/i18n_work/out/<LANG>.part1.json`, `part2`, … (about 300 ids per part, in id order: 0–299, 300–599, …).
Then run `python3 /home/claude/i18n_work/merge.py <LANG>`. It merges the parts and validates. Fix every reported problem and run it again until it prints `0 problems`. Only finish when it does.

## Rules
- Every id must be translated (no empty strings, no English left unless it's a brand or a universal unit).
- Keep placeholders exactly as written, e.g. `{name}`, `{n}`, `{q}`, `{day}`: same names, same count. Never translate the text inside braces. You may move them within the sentence.
- Keep emoji, symbols (✓ · — • →), and line breaks (`\n`).
- Strings in ALL CAPS in English (button labels like "GET STARTED", "+ MEAL") stay ALL CAPS where the script has case.
- "Pavurio" and "Pavurio Pro" are never translated. Honey and Tabby are names: keep them.
- Units: g, kg, ml, L, min, h stay as international symbols unless your language normally writes them differently.
- Be concise: these are mobile UI labels and buttons. A translation should not be much longer than the English. Short labels (1–3 words) must stay short.
- Use one consistent, friendly register (e.g. German "du", Dutch "je", French already uses "vous"; pick what popular consumer apps use in your language) and consistent terms for the same thing across all strings (meal, walk, reminder, pantry, memory, moment, milestone, Paw Passport…).
- `{name}` is usually the pet's name; `{n}` a number; `{q}` a quantity with unit ("2.5 kg"); `{day}` a day name or short date; `{when}` a relative time; `{item}` a product name; `{label}` a lowercase care name.
- Medical content must stay accurate and never become advice beyond the English.

## Plurals
Items with `"plural": "one"` are the singular form, `"plural": "other"` the plural form of a counted phrase (the app picks one using the number). If your language has more plural forms (e.g. Russian/Ukrainian/Polish/Czech "few" and "many", Arabic "zero/two/few/many", Romanian "few"), put the general plural in the normal id and add extra keys `"<id>#few"`, `"<id>#many"`, `"<id>#two"`, `"<id>#zero"` (only for ids marked `plural: other`) with the correct grammatical forms. The app uses Unicode CLDR plural categories (Intl.PluralRules). For languages without plurals (Japanese, Chinese, Korean, Thai, Vietnamese, Indonesian, Malay), translate both the same natural way.
