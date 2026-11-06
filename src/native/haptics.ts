/**
 * Feedback: every important action is felt (haptics) and heard (sounds), the same way everywhere.
 * Each function is one kind of moment; pick by what happened, not by how strong it should feel:
 *
 * | moment                              | function             | haptic            | sound        |
 * |-------------------------------------|----------------------|-------------------|--------------|
 * | any button / tap target             | tapFeedback          | selection         | tap          |
 * | choosing an option (chip, tab, coat)| selectFeedback       | selection         | select       |
 * | wheel / slider / stepper detent     | tickFeedback         | selection         | tick         |
 * | switch on / off                     | toggleFeedback(on)   | light             | toggle_on/off|
 * | slide-to-confirm, each quarter      | slideStepFeedback(q) | light→medium→heavy| slide_1..3   |
 * | slide-to-confirm completed          | slideDoneFeedback    | success           | slide_done   |
 * | a care logged                       | logFeedback          | success           | log          |
 * | day complete / walk done / Pro      | completeFeedback     | success + heavy   | complete     |
 * | badge or milestone                  | badgeFeedback        | success + heavy   | badge        |
 * | something saved                     | successFeedback      | success           | save         |
 * | bought / restocked                  | restockFeedback      | success           | restock      |
 * | photo or moment kept                | photoFeedback        | success           | photo        |
 * | walk started                        | walkStartFeedback    | medium            | walk_start   |
 * | creating (jelly +, new reminder)    | popFeedback          | medium            | pop          |
 * | tapping the pet                     | petFeedback          | light             | pet          |
 * | undo                                | undoFeedback         | light             | undo         |
 * | delete / remove                     | deleteFeedback       | warning           | delete       |
 * | error / not allowed                 | errorFeedback        | error             | error        |
 *
 * Haptics follow the "Vibrations" setting, sounds the "Sounds" setting; both are off on web.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playSound, type SoundName } from './sound';

let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

const ok = () => enabled && Platform.OS !== 'web';
const sel = () => ok() && Haptics.selectionAsync().catch(() => {});
const impact = (s: Haptics.ImpactFeedbackStyle) => ok() && Haptics.impactAsync(s).catch(() => {});
const note = (s: Haptics.NotificationFeedbackType) => ok() && Haptics.notificationAsync(s).catch(() => {});
const { Light, Medium, Heavy, Rigid } = Haptics.ImpactFeedbackStyle;
const { Success, Error: Err, Warning } = Haptics.NotificationFeedbackType;

/** Any tap target (Bouncy, Pill, icon buttons). `sound: false` for taps whose own moment follows. */
export function tapFeedback(sound: boolean | SoundName = true) {
  sel();
  if (sound) playSound(sound === true ? 'tap' : sound, 0.55);
}
export function selectFeedback() {
  sel();
  playSound('select', 0.7);
}
export function tickFeedback() {
  sel();
  playSound('tick', 0.6);
}
export function toggleFeedback(on: boolean) {
  impact(Light);
  playSound(on ? 'toggle_on' : 'toggle_off', 0.7);
}
/** q = 1, 2, 3: each quarter of a slide feels firmer and sounds higher */
export function slideStepFeedback(q: number) {
  impact(q >= 3 ? Heavy : q === 2 ? Medium : Light);
  playSound(q >= 3 ? 'slide_3' : q === 2 ? 'slide_2' : 'slide_1', 0.7);
}
export function slideDoneFeedback() {
  note(Success);
  playSound('slide_done');
}
export function logFeedback() {
  note(Success);
  playSound('log');
}
export function completeFeedback() {
  note(Success);
  setTimeout(() => impact(Heavy), 280);
  playSound('complete');
}
export function badgeFeedback() {
  note(Success);
  setTimeout(() => impact(Heavy), 240);
  playSound('badge');
}
export function successFeedback() {
  note(Success);
  playSound('save', 0.85);
}
export function restockFeedback() {
  note(Success);
  playSound('restock');
}
export function photoFeedback() {
  note(Success);
  playSound('photo');
}
export function walkStartFeedback() {
  impact(Medium);
  playSound('walk_start');
}
export function popFeedback() {
  impact(Medium);
  playSound('pop', 0.8);
}
export function petFeedback() {
  impact(Light);
  playSound('pet', 0.7);
}
/** a soft physical bump with no sound (pet stage taps already answered, drag snaps) */
export function bumpFeedback() {
  impact(Rigid);
}
export function undoFeedback() {
  impact(Light);
  playSound('undo', 0.8);
}
export function deleteFeedback() {
  note(Warning);
  playSound('delete', 0.8);
}
export function errorFeedback() {
  note(Err);
  playSound('error', 0.8);
}
