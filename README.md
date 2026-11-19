# Setlog

[Open Setlog](https://kushacodes1901.github.io/setlog/)

A workout journal for keeping track of your sets and seeing how your training changes over time. Use it in your browser or add it to your phone's Home Screen.

## Features

- 104 illustrated exercises, with search and filters by body area and equipment. You can also add your own exercises.
- A Learn library with 45 illustrated guides, including every chest, shoulder and arm exercise in the built-in list, start and finish positions, simple instructions and common mistakes.
- Reps and weights for lifting, reps for bodyweight exercises, and durations for timed exercises.
- A Last time reference showing your previous session while you log an exercise.
- Set difficulty ratings and reps left, if you want to record them.
- Workout drafts that stay saved when you switch tabs or reopen the app.
- Swipe right to go back to a visited screen, including Learn guides and Settings. Inputs, timer wheels and horizontal controls keep their normal gestures.
- A full-screen exercise countdown for timed sets, with a large display and the option to stop early and keep your elapsed time.
- A rest timer with a full-screen countdown, completion message and sound controls.
- A History calendar for workouts and rest days, with editing and deletion.
- A weekly activity summary, personal records, weekly lifting volume and exercise progress charts.
- Manual calorie entry from a watch or gym machine.
- A local profile photo, name and bio, with an experience score, levels, weekly activity and earned badges.
- Light and dark appearance, height and weight units, and profile measurements.
- Backup export and import, plus offline use after the app has loaded successfully online.

## Log a workout

1. Open **Log Workout** and choose the day of the week.
2. Tap **Choose exercise**, then search or browse the illustrations. To use your own exercise, type its name and tap **Add**.
3. Enter your set. Add a difficulty rating or reps left if useful.
4. Tap **+ Set** for another set. The previous set collapses to keep the screen clear.
5. Tap **Save exercise** before adding the next exercise.
6. If you have a calorie number from your watch or gym machine, enter it above **Save workout**. Otherwise leave it blank.
7. Tap **Save workout** to add the session to History.

For a rest day, turn on **Rest day** and save it without adding exercises.

## Learn an exercise

Tap **Learn** beside the Log Workout heading. Search the 45-guide library or filter by body area. Each guide has a labeled muscle illustration, matching character illustrations for the start and finish positions, simple steps and a common mistake to watch for.

The library covers every built-in chest (15), shoulder (9) and arm (14) exercise, plus seven back and leg guides. Chest cable options include the high-to-low crossover, low-to-high fly, mid-height fly, single-arm fly and standing cable chest press. Search by exercise name or equipment, or filter by body area.

A muscle illustration below the title shows the exercise's main working areas with red highlights and label lines. Anatomy was checked against the [University of Washington Muscle Atlas](https://rad.uw.edu/muscle-atlas/pectoralis-major).

Exercise setup references include the [NASM exercise library](https://www.nasm.org/resource-center/exercise-library) and [ACE's wrist-curl guide](https://www.acefitness.org/resources/everyone/exercise-library/30/wrist-curl-flexion/). The guide always names the equipment variation shown in its illustrations.

Guide artwork uses compressed WebP files and separate small thumbnails for the library. Once saved offline, artwork loads directly from the current app cache. Keep thumbnails and the offline asset list updated when adding a guide.

Covered exercises also have a **Learn this exercise** shortcut. Returning to Log Workout keeps your draft and scroll position. The other exercises retain their recognition illustrations and do not yet have detailed guides.

## Review your training

**Home** shows your exercise progress and personal records. Select an exercise to explore its sessions and charts.

**History** shows a calendar. Choose a logged day to see its exercises and sets. Use **Edit** to correct a workout, including its calories, or **Delete** to remove it.

Weekly lifting volume means reps multiplied by weight, added across the week. For example, 10 reps at 20 kg adds 200 kg to the total. It is not the heaviest weight you lifted. Timed, unweighted and assisted sets do not count toward lifting records.

Calories are labelled **Manually entered**. Setlog does not measure or estimate calories burned.

## Rest timer and settings

Open **Rest Timer**, choose a preset or a custom duration, and tap **Start**. The timer continues when you move between Setlog's tabs.

Open **Profile**, then tap its gear button to reach **Settings**. Choose your appearance and units, enter profile measurements, and adjust the rest sound, alert volume and confetti. Tap **Save Settings** for confirmation.

Keep Setlog open and your screen awake for rest alerts. The browser cannot provide a reliable alarm when the phone is locked or the app is in the background.

## Your profile

Open **Profile** and tap **Edit Profile** or the photo circle to add a name, short bio and picture. Photos are cropped to a square and resized before being stored on the device. They are not uploaded to a server.

Your score is calculated from History: **100 XP per training day**, plus **25 XP per personal record**. Logging several workouts on the same day earns the daily points once. Every 500 XP adds a level. Rest days do not remove points. Editing, deleting or importing workouts updates the score.

The week strip opens the selected day in History. Your week streak counts consecutive weeks with a workout, so daily exercise is not required. Badges unlock as you reach training-day, record and active-week milestones. Tap a badge or your XP score for details.

Profile photos and details are stored separately from workouts. Workout backup files currently cover saved sessions, not profile photos or preferences.

## Add Setlog to your phone

Tap **Add** in the banner at the top of the page, or open the Home Screen guide from Settings. The guide has illustrated steps for iPhone/iPad using Safari and Android using Chrome.

On iPhone, use Safari's **Share > Add to Home Screen** option. On Android, open Chrome's three-dot menu and choose **Install app** or **Add to Home screen**. Wording can vary between phones.

## Keep a backup

Workouts, drafts and preferences are stored in the browser on your device. There is no account or cloud sync. Clearing browser data or changing devices can remove access to your journal.

In **History**, use **Export backup** to save your workouts to a file. Use **Import backup** to restore them. Export a backup before switching from the browser to the Home Screen app, because they may use separate storage.

## Run locally

Setlog uses plain HTML, CSS and JavaScript. There is no build step or package installation.

From the project folder, run:

```sh
python -m http.server 8766 --bind 127.0.0.1
```

Then open [localhost:8766](http://127.0.0.1:8766/).

## Project folders

```text
index.html                  Main page
manifest.webmanifest        App installation details
sw.js                       Offline caching
assets/
  js/                       App logic and feature scripts
  css/                      Layout and appearance
  fonts/                    Bundled Manrope font and its license
  media/
    icons/                  App icons
    illustrations/          Exercise and installation illustrations
    launch/                 iPhone launch images
```

## Contributing

Found a bug or have an idea? Open an issue describing what happened, what you expected, and the phone or browser you used. Include a screenshot when it helps.

For a code change, fork the repository, create a branch and open a pull request. Explain what changed and how you checked it. Keep each pull request focused on one feature or fix.

Before submitting:

- Try the affected flow on a narrow phone layout and a desktop layout, in both appearances.
- Check that existing workouts and drafts still load. Keep saved data compatible, or provide a migration if its format changes.
- Update file paths when adding or moving assets. Include files needed offline in the asset list in `sw.js`, and increase its cache version when changing cached files.
- Keep `index.html`, `manifest.webmanifest` and `sw.js` at the root so installation addresses and offline scope stay consistent.
- Keep backups working when adding fields to saved workouts; their handling lives in `assets/js/backup.js`.

The interface uses [Manrope](https://fonts.google.com/specimen/Manrope), bundled locally under the SIL Open Font License. The license is included in `assets/fonts/OFL.txt`.
