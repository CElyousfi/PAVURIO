# PAVURIO — The production master plan

Building with Claude Opus 5.5 + GPT image generation + Refero MCP · iOS and Android

We're going to structure Pavurio as a real consumer mobile product, with the same attention to animation, interactions, and presentation demonstrated by Jason Lee, but with a much larger scope than his tutorials.

The two videos establish a particularly useful development pattern: reference-driven design → functional prototype → animation refinement → real-device testing.

There's one important technical correction: GPT image generation, Claude's code-generated animations, and AI-generated video are different capabilities. We can use GPT to design the characters and Claude to animate their parts, but that doesn't automatically produce the same complex character videos as a dedicated video-generation tool. I'll build that limitation into the workflow rather than promise an impossible one-click process.

## 1. What I verified from the videos

[iPhone Kilit Ekranı Canlı Aktiviteleri Nedir? Nasıl Açılır? - Getmobil](https://images.openai.com/static-rsc-4/A8MgOtwFsrTH05hAvp4qtRM3SgHosl65Wi4Hr5E-58tn48lJSusmIZaMjGs5SjsLg5CQWBYJd9BHOTuJhwCcoxRwP9s7t6HobqH6UvUKJZoFPUntu8qeUAA6-oGI31j5lCr135sWjLwYt-usdLZcxKNShXefTb0y_cUz73Yikhk?purpose=inline)

[Claude Opus 5.5 Is INSANE for Mobile App Animations (Apple's Dynamic Island)](https://www.youtube.com/watch?v=ncQUil5c2Gw\&t=425s\&utm_source=chatgpt.com)

Published October 2026. This explores animated native mobile experiences, including Dynamic Island and Lock Screen widgets.

I could verify its title and general subject, but not retrieve its complete timestamped transcript or playback frames. I won't invent a precise step-by-step account of scenes I couldn't independently inspect.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://youtu.be\&sz=32)

YouTube+1



[Apple's favorite iPhone and iPad apps of the year revealed — all the 2022 winners | Tom's Guide](https://images.openai.com/static-rsc-4/jHOidG5_D-BCVJpLDEHGt8DpjehMu3OA1Kbs4Wu0jV-u6OEXzyCGvF3VaBPQciHc-0-RNtw2DhHG9dl3nmSoz8qvfXiKItX8KqLFJkYANqjcKu5kGu4EEvmpa8zCr8zN3y8IIYV9k9WWBLOD8G1VcAA9D-ZAOkGi6Q9Mg6Z3b2I?purpose=inline)

[Watch Me Vibe Code an Animated App with Claude Opus 5.5](https://www.youtube.com/watch?v=Rk6t9Uq1y9M\&t=1s\&utm_source=chatgpt.com)

Published October 14, 2026. Detailed timestamped breakdowns establish his process: study Waterllama, inspect UI references, provide screen recordings, generate the interface, test interactions, identify stiff character animations, replace selected movements with generated clips, and build a phone-tilt interaction.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://videohighlight.com\&sz=32)

Video Highlight+1



### The video workflow, adapted to Pavurio

| Jason's technique                         | Our implementation                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Analyze a successful app                  | Study Waterllama, Finch, pet trackers and other appropriate interfaces                |
| Gather reference screens                  | Your existing Refero MCP connection                                                   |
| Provide an exact character reference      | Original GPT-generated dog and cat character sheets                                   |
| Build UI and basic animations with Claude | Expo + React Native + Reanimated + SVG/Skia where appropriate                         |
| Replace stiff character motion            | GPT-generated layered art, code-driven rigging and carefully prepared frame sequences |
| Test interactive movement                 | Touch, drag, swipe, long press, optional device tilt                                  |
| Implement native surfaces                 | iOS widgets/Live Activities and Android widgets                                       |
| Record and refine glitches                | Real phone recordings with reproducible bug descriptions                              |
| Build a commercial product                | Persistent data, notifications, paywalls, purchases, privacy and store distribution   |

The particularly relevant news is that Expo SDK 56 supports iOS widgets and Live Activities through stable `expo-widgets`, with Android home-screen widget support as well. That makes native companion experiences more approachable than they were in older Expo versions. These require development builds, not Expo Go.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://expo.dev\&sz=32)

Expo+1



## 2. Your complete build kit is ready

I've organized the development plan into five Markdown documents, designed to be given directly to Claude Code.

## Pavurio Full Production Kit

Five Markdown specifications · ZIP archive · Ready for Claude Code

&#x20;Download complete production kit

Individual documents

00 — Start Here

Initial instructions and the first Claude prompt

Open

01 — Product Master Blueprint

Features, screens, states, data, subscriptions, roadmap

Open

02 — Refero + Claude Playbook

Design research and ten phased coding prompts

Open

03 — GPT Art & Animation Bible

Character prompts, layered art, rigging and animations

Open

04 — Release, QA & Business

Native widgets, testing, paywalls, launch and revenue

Open

These are implementation specifications and working prompts, not completed application code or finished animation assets.

## 3. The animation workflow I recommend

The most important technical decision is how to create a highly interactive character without Higgsfield.

We'll combine three distinct techniques.

[Modular Mascot Character Sheet Generator Gemini Image Prompt | PromptBase](https://images.openai.com/static-rsc-4/OrvMBFm3suRu1q_OrW2MMWfRmnoy55ebC9nVH37Z28DKYdlWiAoQtRtawq4v47La3dpLoAotkSgxdMgnFBHr_vZCHX4JiKzXfYRb7Gc0E7RzphkG9bkb_doqx-jM4oWZb74efqMYUYziary3ytWCgrdl_8NIDE1w8ysfbBVH8pI?purpose=inline)

Layered character animation

GPT creates the original character and pose references. We prepare separate head, eye, ear, tail and body layers.

Claude uses Reanimated and SVG transforms to make the eyes follow touches, the head tilt, the tail move, and the character react naturally.

Best for: continuous interactive motion.

[Vector cartoon character corgi dog running step](https://images.openai.com/static-rsc-4/060oRzuzN0844WTAjzqXG9_nq9Y7moGjUnfcs3WOns4s2tDijGWJhI-tXgqyL44yfw1-K5nIsAno8YBNlaFn3VdZtnvHBn221sz8pj48InY0HxIwH3QooS8rrQk7Tm5xdlmTqd1ww6fvr-yl065sY-0GHZeE0edFyjdBA63deN2Q4cCZpwNbOlAPoSdpTuVO?purpose=inline)

Prepared animation sequences

For complicated movement, create and refine a coherent sequence of frames and play them through a controlled renderer.

Independent GPT-generated frames may change anatomy between images, so consistency must be inspected and corrected.

Best for: brief complex reactions and celebrations.

[My Little Pet | Story.com](https://images.openai.com/static-rsc-4/vlZQhG3jewNXz0BwanUeekA76A5CBtN5kRvgYsHqg6Ni6xcZidLRB37RdfK05d1-mpmfyah2rgd_f-teFKe12GcJdA4wh1Afl4vCM_R1ntOzKMBsTdTvj59uR0L_B8yH6tquLoM5KlegZG-vxVNl4JSXr9CgQvreG4p5BQGXloQ?purpose=inline)

Code-driven scenes and physics

Claude animates the garden, foreground objects, particles, toys and optional device-tilt parallax directly.

Best for: touches, draggable objects, responsive environments and transitions.

### Example: a genuinely interactive pet

\#chatgpt-mermaid-\_r_216\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_216\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_216\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_216\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_216\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_216\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_216\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_216\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_216\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_216\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_216\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_216\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_216\_ p{margin:0;}#chatgpt-mermaid-\_r_216\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_216\_ .label text,#chatgpt-mermaid-\_r_216\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ .node rect,#chatgpt-mermaid-\_r_216\_ .node circle,#chatgpt-mermaid-\_r_216\_ .node ellipse,#chatgpt-mermaid-\_r_216\_ .node polygon,#chatgpt-mermaid-\_r_216\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .rough-node .label text,#chatgpt-mermaid-\_r_216\_ .node .label text,#chatgpt-mermaid-\_r_216\_ .image-shape .label,#chatgpt-mermaid-\_r_216\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_216\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .rough-node .label,#chatgpt-mermaid-\_r_216\_ .node .label,#chatgpt-mermaid-\_r_216\_ .image-shape .label,#chatgpt-mermaid-\_r_216\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_216\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_216\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_216\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_216\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_216\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_216\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_216\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_216\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_216\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_216\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_216\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_216\_ .icon-shape,#chatgpt-mermaid-\_r_216\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_216\_ .icon-shape p,#chatgpt-mermaid-\_r_216\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_216\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_216\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_216\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_216\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_216\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_216\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_216\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_216\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_216\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_216\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_216\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_216\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_216\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_216\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_216\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_216\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_216\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .node rect,#chatgpt-mermaid-\_r_216\_ .node circle,#chatgpt-mermaid-\_r_216\_ .node ellipse,#chatgpt-mermaid-\_r_216\_ .node polygon,#chatgpt-mermaid-\_r_216\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_216\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_216\_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_216\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_216\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_216\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}User touches petGesture controllerCalculate touch positionMove eyes and tilt headReturn smoothly to idleUser confirms completed mealValidate and save recordSave succeeded?Update care timelinePlay meal reactionShow error withoutcelebrationYesNo

This distinction matters: tapping the character is a visual interaction, while logging a meal changes the actual pet-care records.

## 4. Native widgets and Dynamic Island

I'd bring the native experiences into the overall design now, but implement them after the basic care engine is reliable.

[Live Activities with Expo, End to End: Client and Backend — Expo blog](https://images.openai.com/static-rsc-4/gw7E4aRU0wvAnIDTVkvZd-X7VblE07HxQzLMZEce_FszUQYId_pwGy_coQ-nsMlSregAvxtyKvDir7iCtMmrkM-k--VyIbsm41R9CVzwDfMhfMHChItZezlLJtkVgV_c1QS04kzx1ZmROIUweBDhVdpzpGsKIL0lCFxG9YT8wxI?purpose=inline)

iOS Dynamic Island — Active walk

During a user-started walking session, show the pet's small portrait, an elapsed timer, and session status.

Expand it for more information; end it when the user ends the session. Do not keep a decorative activity permanently running.

[Fed? — Pet Feeding Tracker for iOS](https://images.openai.com/static-rsc-4/fB0TRPPt1sEAF_MxvfT2V2-Asn6o-cmHXb69h_aJF1R_OQuPXDgS84SZrgjmxwqVN1wmC-kwQtQLv3TJs5-VE3PsKOD3mniMuL39WayB86cddQEheXsBCjstuWbW8Jn3FmWOU9cId1Ci68S-ix_VrdT5T7jtwSee39nzAam-qyA?purpose=inline)

Home-screen widget — Next care

Display the selected pet, the next scheduled task, and a deep link to the right screen.

On Android, develop the corresponding native widget using the platform's supported behavior.

[Toki Updates](https://images.openai.com/static-rsc-4/hQ_F9zFRLJKJy9igZL2arXzRV2MU1vIn9gvuTzxN0BZR__Ep7alOTr2itPMrSmDjBsxc6AXWlCQhIka-j57iis1wZG_YtseP7eHTw4dnopUvfjt1-MDWiPq6158Eopa1dWogGw2xeziNC-n1QgrjnPzGXOaveDuprPNAYKCa6ls?purpose=inline)

Lock Screen — Important information

Upcoming appointment, reminder or relevant in-progress activity. Keep it glanceable and avoid displaying private medical details by default.

These are concept references, not validated Pavurio screenshots.

The native surfaces have different limitations from the normal React Native app. For example, Expo widgets run in an isolated rendering environment with restricted components and state access. We cannot simply embed our complete animated pet scene in the Dynamic Island.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://docs.expo.dev\&sz=32)

Expo documentation+1



## 5. The final feature coverage

The production kit specifies the user-facing experience and technical responsibilities for every major product area.

| Product area        | What we're building                                                                | Priority                 |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| Onboarding          | Species choice, pet identity, original character creation, routines, notifications | Launch                   |
| Animated Home       | Interactive pet, Little World, daily tasks and next reminders                      | Launch                   |
| Quick Log           | Feeding, walking, litter, grooming, observations and custom activities             | Launch                   |
| Care Calendar       | Recurrence, appointments, rescheduling, skipped/completed states                   | Launch                   |
| Records             | Vet visits, vaccines, treatment records, documents and measurements                | Launch                   |
| Moments             | Photos, milestones, captions, albums                                               | Launch                   |
| Stories             | Monthly, birthday, adoption and year-end recaps                                    | Launch                   |
| Social Export       | Instagram-ready images, story preview, editing and sharing                         | Launch                   |
| Character Studio    | Species-specific character appearance, palettes and accessories                    | Launch                   |
| Little World        | Interactive environment and decorative unlocks                                     | Launch, basic version    |
| Pro Paywall         | Store subscriptions, trials, restore and premium access                            | Launch                   |
| Home Widgets        | Next care and profile summary                                                      | After core stabilization |
| Dynamic Island      | Active walk Live Activity                                                          | After core stabilization |
| Cloud Backup        | Optional accounts and cross-device restoration                                     | 1.5                      |
| Animated MP4 Recaps | Real video rendering pipeline                                                      | 1.5                      |
| Family Sharing      | Multiple caregivers, assignments and permissions                                   | 2.0                      |
| More Species        | Small mammals, birds and others with appropriate templates                         | Later                    |

The launch product is already substantial. The goal is to build the pieces in the correct dependency order, not to reduce the eventual vision.

## 6. Exact development sequence

## From zero to production

0/10

01 · Design research

Refero reference board, original UI patterns and motion specifications

02 · Original character

GPT master dog, approved expression sheet, separated animation layers

03 · First interactive screen

Working Home with touch, blink, idle and responsive scene

04 · Persistent care loop

Create pet, log meal, update timeline, undo, restart test

05 · Complete care system

Species templates, calendar, reminders, records and measurements

06 · Moments & Stories

Memory scrapbook, factual recaps, full-screen viewer, social exports

07 · Premium subscriptions

RevenueCat, localized paywall, real purchases and restoration

08 · Native polish

Widgets, optional walk Live Activity, performance and accessibility

09 · Beta release

TestFlight, Google Play testing, device QA and real user feedback

10 · Commercial launch

Store pages, creator marketing, analytics, pricing and retention

Each phase has a Claude prompt and acceptance criteria in the kit.

## 7. Your first Claude Code session

You already have Refero MCP access, so there's no reason to buy another design-reference subscription for this workflow.

Refero's official methodology separates research into styles, screens and flows, with tools such as `refero_search_styles`, `refero_search_screens`, and `refero_search_flows`.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://refero.design\&sz=32)

refero.design+2



Start Claude Code by importing the production kit, confirming the Refero connection through `/mcp`, and then using the initial prompt below.

First instruction for Claude Opus 5.5

You are the lead mobile product architect for PAVURIO. Read all five Markdown documents in the attached Pavurio Full Production Kit before coding. Verify the Refero MCP connection. Research styles, iOS screen patterns, and complete flows for onboarding, animated home, quick logging, care calendars, memories, social recap exports and subscription paywalls. Create an original REFERENCE_BOARD.md, information architecture, animation contract, component map, SQLite schema, risks and the first vertical-slice acceptance tests. We use GPT-generated original still artwork and code-driven animation; no Higgsfield subscription. Do not pretend GPT images are video or animation-ready rigs. Do not clone competitor layouts, assets or characters. First milestone: one dog profile, one responsive layered dog character, one real feeding log persisted in SQLite, correct undo and surviving a full app restart. Do not generate the whole app in one pass. Your first response must be a research and engineering plan, not application code.

&#x20;Copy first Claude prompt

### How we'll judge whether the first build is good enough

The first milestone must pass these tests:

- The character looks like the same original pet across expressions and interactions.
- Touching the character produces smooth, intentional feedback.
- Logging a meal actually saves data rather than changing a fake progress state.
- The UI and character update after the save succeeds.
- Restarting the application preserves the event.
- Undo and editing correctly affect the timeline.
- The same flow works on both iOS and Android.
- Turning animations off does not break the care functionality.

Don't proceed to cats, multiple environments or premium decorations until these pass.

## 8. The business strategy remains attached to the product

Pavurio should be designed with the complete commercial funnel in mind:

\#chatgpt-mermaid-\_r_22u\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_22u\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_22u\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_22u\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_22u\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_22u\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_22u\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_22u\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_22u\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_22u\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_22u\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_22u\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_22u\_ p{margin:0;}#chatgpt-mermaid-\_r_22u\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_22u\_ .label text,#chatgpt-mermaid-\_r_22u\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ .node rect,#chatgpt-mermaid-\_r_22u\_ .node circle,#chatgpt-mermaid-\_r_22u\_ .node ellipse,#chatgpt-mermaid-\_r_22u\_ .node polygon,#chatgpt-mermaid-\_r_22u\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .rough-node .label text,#chatgpt-mermaid-\_r_22u\_ .node .label text,#chatgpt-mermaid-\_r_22u\_ .image-shape .label,#chatgpt-mermaid-\_r_22u\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_22u\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .rough-node .label,#chatgpt-mermaid-\_r_22u\_ .node .label,#chatgpt-mermaid-\_r_22u\_ .image-shape .label,#chatgpt-mermaid-\_r_22u\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_22u\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_22u\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_22u\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_22u\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_22u\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_22u\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_22u\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_22u\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_22u\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_22u\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_22u\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_22u\_ .icon-shape,#chatgpt-mermaid-\_r_22u\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_22u\_ .icon-shape p,#chatgpt-mermaid-\_r_22u\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_22u\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_22u\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_22u\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_22u\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_22u\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_22u\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_22u\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_22u\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_22u\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_22u\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_22u\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_22u\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_22u\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_22u\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_22u\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_22u\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .node rect,#chatgpt-mermaid-\_r_22u\_ .node circle,#chatgpt-mermaid-\_r_22u\_ .node ellipse,#chatgpt-mermaid-\_r_22u\_ .node polygon,#chatgpt-mermaid-\_r_22u\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_22u\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_22u\_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_22u\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_22u\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_22u\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Discover through App Store orpet contentInstall appCreate personalized petRecord first real care activitySet useful recurring reminderReturn and build care historyCreate and share MomentsstoryExperience a relevant ProbenefitSubscribe

My initial subscription tests remain €29.99 versus €39.99 annually, with a monthly option. This pricing is unvalidated, so we'll evaluate actual store conversion and retention rather than assuming one is best.

At €39.99/year, €10,000 of gross monthly recurring revenue equivalent requires about 3,001 active annual subscribers, before fees, refunds, tax and operating costs.

The social sharing feature is particularly valuable because a genuinely beautiful Pet Wrapped-style story could become a repeatable discovery mechanism. But we should measure actual attributed downloads and paid conversions, not just exports or views.

You also already have the Apple and Google Play developer registrations. That removes new enrollment fees from the launch budget, although ongoing platform and service costs still matter.

## 9. The decisions I would lock

## Pavurio production decisions

Architecture selected

| App model             | Non-AI consumer pet companion                               |
| --------------------- | ----------------------------------------------------------- |
| Mobile stack          | React Native / Expo / TypeScript                            |
| Code generation       | Claude Opus 5.5                                             |
| Design research       | Your Refero MCP                                             |
| Illustrations         | GPT-generated original assets                               |
| Animation             | Reanimated + prepared layers; advanced rigging if justified |
| Persistent data       | SQLite, offline-first                                       |
| Billing               | RevenueCat + native store subscriptions                     |
| Native widgets        | Expo Widgets, tested with development builds                |
| Initial species       | Dogs and cats                                               |
| Social growth feature | Moments + Stories + Pet Year recap                          |
| Brand                 | Pavurio, provisional until cleared                          |

One final distinction: Jason's videos demonstrate effective ways to rapidly produce and refine an animated prototype. The additional work that turns Pavurio into a reliable commercial app—real data persistence, durable scheduling, permission handling, entitlement verification, accessibility, privacy, testing and ongoing support—is equally important.

The production kit covers both sides. The right place to begin is the design-reference board and one complete dog-character vertical slice, not a prompt asking Claude to construct every screen simultaneously.

Open the complete Pavurio production kit