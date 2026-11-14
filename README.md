# Setlog

**[Open Setlog](https://kushacodes1901.github.io/setlog/)**

Setlog is a simple workout journal. Log your exercises, reps, and weights, then review, edit, or delete saved workouts in History.

Your workouts and drafts are stored on the device you use. Setlog works offline after its first successful online load.

Home shows personal records for the heaviest logged weight per exercise and highest weekly lifting volume (reps × weight, Monday–Sunday), plus workout counts and progress toward the next PR milestone. New records are highlighted after saving and flagged in History, with confetti when enabled. The first lift and first week establish starting marks. Timed, unweighted and assisted sets are excluded. Records are recalculated from history when entries change.

Tap a lift on Home, or choose Explore your progress, to open Exercise Progress. It includes selectable session charts, weight/reps/time views, all saved sets, and comparisons at the same weight. Timed exercises show duration; assisted exercises track lower assistance separately.

Run the record and exercise-progress checks with `node --test tests/*.test.cjs`.

## Spotify remote (development)

Music controls the connected account’s existing Spotify playback. It does not stream audio, import files, automatically move playback to this phone, or control other music services. Start a song in Spotify first. The active device’s name is shown in Setlog; play/pause, previous, next and seeking use that device. Spotify restrictions can make individual controls unavailable.

The public Client ID is in `spotify-config.js`. This is not a secret. The app uses Authorization Code with PKCE, requests only `user-read-playback-state` and `user-modify-playback-state`, and never needs a Client Secret. Each tester must authorize their own account. Spotify Premium and development-mode allowlisting are required under [Spotify’s current rules](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

Registered callback addresses must match exactly, including the trailing slash:

- Local: `http://127.0.0.1:8766/`
- Published: `https://kushacodes1901.github.io/setlog/`

Use the local preview on the computer running the preview server. Open the published HTTPS site on a phone after this version is deployed. For the first iPhone test, use Safari; an installed Home Screen app and Safari can have separate sign-in storage, so returning from Spotify may require completing the connection in Safari.

Access and refresh credentials are kept in `sessionStorage` on the current origin, not in Git, workout data, exports, or the service-worker cache. Music metadata is held in memory and images load directly from Spotify-provided URLs. Disconnect clears Setlog’s session credentials without pausing Spotify; revoke the authorization completely from [Spotify’s connected apps](https://www.spotify.com/account/apps/). Reopening a browser session may require reconnecting. Connection configuration is kept in the source file rather than shown in the app; this is a personal development test.

Playback state is polled every five seconds while Music is visible, with local progress updates between polls. Polling stops when the tab or app is hidden; rate limits respect `Retry-After`. Sign-in uses state verification and short-lived PKCE requests. There are no analytics or music-history uploads to Setlog.

Spotify’s official white full logo is included as `spotify-logo.svg`, downloaded from its [design resources](https://developer.spotify.com/documentation/design). Artwork is shown without cropping or overlays, with Spotify attribution and links back to Spotify.

On iPhone, open Setlog in Safari and choose **Share → Add to Home Screen** to launch it from an app icon.
