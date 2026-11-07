# Native UI flows (Maestro)

These flows drive the real Android/iOS app through the first-use journey with the app's `testID`s.
They need a device or emulator with a build installed (`com.pavurio.app`), and the Maestro CLI:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
maestro test .maestro/onboarding_dog.yaml
maestro test .maestro/onboarding_cat.yaml
maestro test .maestro/   # all flows
```

What they check (the tester-reported blockers):
- the name field stays visible and editable with the keyboard open, and the keyboard's Next continues;
- coat and collar/bandana choices are reachable and change the pet;
- "Use this look" is always visible and advances once;
- setup reaches Home without a paywall, Home shows the intro, care can be logged, Pantry and Memories open.

Each step takes a screenshot (`takeScreenshot`) into `~/.maestro/tests/…` for the visual record.
These flows were written alongside the fix but have NOT been run yet: run them on a compact phone
(e.g. 360×640 dp emulator), a Samsung with Samsung Keyboard and a Pixel with Gboard.
