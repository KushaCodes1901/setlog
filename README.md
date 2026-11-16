# Setlog

**[Open Setlog](https://kushacodes1901.github.io/setlog/)**

Setlog is a simple workout journal. Log your exercises, reps, and weights, then review, edit, or delete saved workouts in History.

Your workouts and drafts are stored on the device you use. Setlog works offline after its first successful online load.

Settings → Appearance offers Dark and Light modes, with green accents in each. The choice saves on this device, applies immediately and is restored before the page paints. Existing users keep Dark until they choose another mode.

Each newly added exercise starts with one blank set. While editing an exercise, Last time shows its most recent logged date and sets in your selected weight unit. Timed exercises show duration. New exercises have no reference yet; when editing a past workout, only sessions before that workout are used.

Home shows personal records for the heaviest logged weight per exercise and highest weekly lifting volume (reps × weight, Monday–Sunday), plus workout counts and progress toward the next PR milestone. New records are highlighted after saving and flagged in History, with confetti when enabled. The first lift and first week establish starting marks. Timed, unweighted and assisted sets are excluded. Records are recalculated from history when entries change.

Tap a lift on Home, or choose Explore your progress, to open Exercise Progress. It includes selectable session charts, weight/reps/time views, all saved sets, and comparisons at the same weight. Timed exercises show duration; assisted exercises track lower assistance separately.

Run the record and exercise-progress checks with `node --test tests/*.test.cjs`.

## Home Screen guide

A dismissible Add Setlog banner opens an illustrated, step-by-step guide for iPhone/Safari and Android/Chrome. Android illustrations use a Samsung-style phone with a centered camera dot. The guide works offline after its first load. The banner hides in standalone mode; dismissing it hides it for seven days, and Settings can reopen the guide. Where supported, a native install prompt is offered only after a user tap. Installing can use separate device storage, so the guide reminds existing users to export a backup first.

Instructions follow [Apple's Home Screen guide](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26) and [Chrome's web app guide](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en). The original illustrations highlight each action; browser wording and layouts can vary. Videos have been removed from the guide.

## Rest timer

The rest timer plays one short chime (about one second) at completion when sound is enabled and its volume is above zero. Start and Resume do not create or activate audio. Keep Setlog open and the screen awake; this is not a reliable background or lock-screen alarm.

If the browser blocks automatic sound, the completion screen offers Play chime. Test sound in Settings can also unlock audio for the current page. Setlog does not connect to or control music services; audio interruptions and routing are managed by the phone and browser.

On iPhone, open Setlog in Safari and choose **Share → Add to Home Screen** to launch it from an app icon.
