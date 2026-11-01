# Pavurio — ASO & organic growth playbook (Google Play first)

Goal: most installs from **Play Store search and browse**, in four languages, without paid acquisition — the same discipline that worked for Les Épavistes Pro on Google (one intent = one page, exact wording people type, reviews as the ranking fuel), applied to the store.

## 1. How Play ranks us (what we can move)

| Lever | Weight | Where it lives |
|---|---|---|
| Title (30) | highest | `docs/store/listings.json` → `title` |
| Short description (80) | high | `short` |
| Full description (4000) | medium, all indexed | `full` |
| Rating & review velocity | high (and conversion) | in-app review prompt |
| Install → uninstall, crashes/ANRs (Android vitals) | high | Crashlytics, App Check, stable builds |
| Conversion rate of the listing (click → install) | high | icon, first 3 screenshots, feature graphic, short description |
| Localised listings | multiplies reach | 5 locales uploaded (en-US, fr-FR, es-ES, pt-BR, pt-PT) |

Everything in the three text fields is both a keyword and copy people read, so each field targets **one intent group** and reads naturally.

## 2. Keyword map

Primary intent (title + short): **pet care tracker / dog & cat care app**.
Secondary (short + opening of full): **reminders, vaccines, vet visits**.
Long tail (body of full): pet health tracker, pet medication reminder, vaccination record, puppy, kitten, litter, grooming, weight chart, pet sitter summary, streaks/habits.

| Locale | Title | Short description |
|---|---|---|
| en-US | Pavurio: Pet Care Tracker | Dog & cat care log with reminders, vaccines & vet visits. Your pet colours in! |
| fr-FR | Pavurio : soins chien et chat | Carnet de soins chien et chat : rappels, vaccins, véto. Votre animal se colore ! |
| es-ES | Pavurio: cuidado de mascotas | Cuidados de perro y gato: recordatorios, vacunas, veterinario. ¡Se colorea! |
| pt-BR | Pavurio: cuidados com pets | Cuidados de cão e gato: lembretes, vacinas e veterinário. Seu pet se colore! |
| pt-PT | Pavurio: cuidados de animais | Cuidados de cão e gato: lembretes, vacinas, veterinário. O seu animal colore-se! |

Rules we keep: never repeat the title in the short description; the differentiator ("your pet colours in") is always present because it is what makes the listing memorable; no competitor names; no "best/#1" claims (policy).

Competitor set to watch (same intent, Play): "Pet Care Tracker – Dog Cat App" (Nova Pet Health), "Pet Care Reminder & Tracker", "11pets", "PetDesk", "Petly". Their titles all stack "pet care tracker dog cat" — we rank for the same phrase and win on the icon/screenshots (character art) and rating.

## 3. Listing creatives (conversion)

- **Icon**: the paw + dog & cat square (512, full-bleed, no text). Same artwork as the adaptive icon on the phone, so what people tap in search is what they see on the home screen.
- **Screenshots** (8 per locale, 9:16 art frames and 1:2 real screens): 1 companion art → 2 real "pet colours in" → 3 reminders art → 4 real log → 5 real streaks → 6 health art → 7 real vet records → 8 real cat. The first three carry the whole story in search results.
- **Feature graphic**: EN/FR versions exist; ES/PT fall back to EN until ChatGPT makes localised ones.
- Not used on purpose: the "Interactive widgets" and "Sleep" art frames — the app has neither, and screenshots must show real features (Play policy: misleading claims = rejection, and 1-star reviews).

## 4. In-app growth loops (already in the build)

1. **Review prompt at the happy moment** (`src/native/review.ts`, fired from `CelebrationHost`): after the first 3 days, when a day is fully coloured in or a badge/challenge lands; at most every 60 days; uses the native in-app review dialog. Rating velocity is the biggest ranking input we control.
2. **Share from the app** (`settings.tsx`, stories, care summary): the share text carries the Play link, so every shared weekly story or vet summary is a referral.
3. **Streaks + evening nudge**: retention drives Play's "engagement" signal; low uninstall rate is a ranking factor.
4. **Newsletter opt-in at signup** (Resend segment): re-engagement without push spam.
5. **Website → store**: pavurio.com in 4 languages with hreflang, FAQ schema and MobileApplication schema, one CTA to the listing. Target web queries: "pet care app", "dog care app", "application soins animaux", "app cuidado mascotas", "app cuidados pet".

Next loops (after launch, in order): in-app "invite a friend" card after the first 7-day streak; Play Store listing experiments (A/B the first screenshot and the short description, 7 days each); Play "custom store listings" per keyword group (e.g. one listing answering "vaccination reminder" intent, one answering "cat litter tracker").

## 5. 90-day organic plan

| When | Action | Metric |
|---|---|---|
| Launch week | Closed test → production; all 5 listings live; reply to every review within 24 h (replies raise conversion) | listing conversion ≥ 25 % |
| Week 2 | Start first listing experiment (short description A/B) | +10 % CVR |
| Week 3–4 | Post weekly stories on Instagram/TikTok with the share link; ask the first 100 users for a review inside the app only when happy | 50 ratings, ≥ 4.6 ★ |
| Month 2 | Custom store listing for "pet vaccination reminder"; localised feature graphics ES/PT | keyword rank top 10 for primary terms per locale |
| Month 3 | Apple launch mirrors the same metadata (App Store keyword field = long-tail list from §2) | iOS organic ≥ 30 % of Android |

Measure in Play Console → Store performance → Store listing acquisitions (by search term) and → Conversion analysis. Re-tune the short description every 4–6 weeks from the search-term report; never change the title more than once a quarter.
