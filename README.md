# Setlog

[Open Setlog](https://kushacodes1901.github.io/setlog/)

A workout journal for keeping track of your sets and seeing how your training changes over time. Use it in your browser or add it to your phone's Home Screen.

## Features

- 100 illustrated exercises, with search and filters by body area and equipment. You can also add your own exercises.
- Reps and weights for lifting, reps for bodyweight exercises, and durations for timed exercises.
- A Last time reference showing your previous session while you log an exercise.
- Set difficulty ratings and reps left, if you want to record them.
- Workout drafts that stay saved when you switch tabs or reopen the app.
- A rest timer with a full-screen countdown, completion message and sound controls.
- A History calendar for workouts and rest days, with editing and deletion.
- Personal records, weekly lifting volume and exercise progress charts.
- Manual calorie entry from a watch or gym machine.
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

## Review your training

**Home** shows your exercise progress and personal records. Select an exercise to explore its sessions and charts.

**History** shows a calendar. Choose a logged day to see its exercises and sets. Use **Edit** to correct a workout, including its calories, or **Delete** to remove it.

Weekly lifting volume means reps multiplied by weight, added across the week. For example, 10 reps at 20 kg adds 200 kg to the total. It is not the heaviest weight you lifted. Timed, unweighted and assisted sets do not count toward lifting records.

Calories are labelled **Manually entered**. Setlog does not measure or estimate calories burned.

## Rest timer and settings

Open **Rest Timer**, choose a preset or a custom duration, and tap **Start**. The timer continues when you move between Setlog's tabs.

In **Settings**, choose your appearance and units, enter profile measurements, and adjust the rest sound, alert volume and confetti. Tap **Save Settings** for confirmation.

Keep Setlog open and your screen awake for rest alerts. The browser cannot provide a reliable alarm when the phone is locked or the app is in the background.

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
