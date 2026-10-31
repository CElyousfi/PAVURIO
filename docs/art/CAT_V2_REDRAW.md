# Cat v2: bring every drawing in line with the new cat

On 31 Oct the owner approved Gemini's cat (from the first cat videos) as **the** Pavurio cat, replacing the round-faced v1 Tabby.

## Reference (attach these to every request)
- `docs/art/gpt-cat/source/v2/master_tabby.png`: the cat, transparent, full body
- `docs/art/gpt-cat/source/v2/master_{ginger,tuxedo,cream}.png`: the other coats (in-app only; drawings use tabby)
- `docs/art/gpt-cat/start-frames/v2_idle.png`: the same cat in its video framing

**Character:** slim grey tabby kitten with darker grey stripes, a white muzzle, chest and paws, pink inner ears, pink cheeks, big glossy black eyes with small lashes, thin whiskers, and a **red collar with a gold bell**. The dog (Honey) is unchanged.

## Done in the app (Claude)
- Home, onboarding and every pet stage: the animated cat (all coats and collars)
- Pet avatars (quick-add row, pet switcher): cut from the video (`tools/art/cat_avatars.py`)

## To redraw (ChatGPT): same scene, same size and transparency, only the cat swapped for v2
| File | What it shows |
|---|---|
| `assets/art/scenes/{appointments,bath,bed,brushing,duo,meals,medication,moments,night,play,premium,records,trophy,vaccine,vet,walk,water,weigh}.webp` | 18 scene cards with Honey and the cat (also used for the challenge and tip art) |
| `assets/art/badges/{family,moment,streak3,streak7}.webp` | 4 medals that include the cat |
| litter scene (still pending) | the cat proudly next to a clean litter tray with a scoop, **v2 cat** |

Deliver as before: high-resolution PNG sheets or single images on a PR. Claude reviews against the v2 reference and integrates.
