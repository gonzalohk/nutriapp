# Installing and using Nutrilara offline

Nutrilara is a web app that installs on the phone like an app (a PWA). Nothing is downloaded from
an app store.

## Install

- **Android (Chrome)**: open the site, menu **⋮ → Install app** (or accept the install banner).
- **iPhone / iPad (Safari)**: open the site, tap **Share → Add to Home Screen**. iOS 16.4 or newer.
  It must be opened from the home-screen icon, not from a Safari tab, to behave like an app.

The icon, name and colors come from the web manifest (`public/icons`, `vite.config.ts`). Android
builds the splash screen from the icon and the background color. iOS shows a plain screen while the
app loads: custom iOS splash images are not included.

## What works without a connection

- Open the app and see the screens you loaded before (Today, Month, History).
- Record an outcome (Picked up, Cancelled, Not picked up, Permission): it is saved on the phone,
  marked **Not synced**, and sent when the connection returns.
- Take a photo: it is compressed on the phone and waits as **Photo pending** until it can upload.

The connection banner shows how many changes are waiting, with a **Send now** button.

## What needs a connection

Creating or editing people, plans and holidays; generating months; loading photos you have not
seen; exports and reports of data not loaded yet.

## How and when changes are sent

Queued changes are sent in the order they were made: first the outcomes, then the photos. Sending
starts when the app opens, when the connection returns, and when you bring the app back to the
foreground. If two people record the same meal, the most recent change (by the time it was tapped)
wins, and every change stays in the meal's change log. A change the server refuses for good (for
example a meal that no longer exists) is dropped instead of blocking the rest.

## iOS limits

iOS does not allow background sync, so queued changes are sent only while the app is open.
If you record something offline and close the app, open it again with a connection to send it.

## Updating

When a new version is available a bar offers **Update**. It never reloads by itself, so a meal you
are recording is not interrupted.

## Privacy

The data you loaded is kept on the phone so the app opens offline. **Signing out** removes it,
together with anything still waiting to be sent.
