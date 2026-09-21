# Wall Street

A personal finance ledger that lives on your machine or your phone. No accounts, no cloud, no framework, no build step.

## Run it

Double-click `index.html`. That's it.

On a phone or any other device: open **https://boxandabird.github.io/wall-street/** and use "Add to Home Screen" so it opens like an app. Turn on Sync (below) to see the same numbers everywhere.

Without internet, you can also serve the folder from a computer on the same Wi-Fi:

    python -m http.server 8765 --directory C:\Users\AZP\tally --bind 0.0.0.0

Then visit `http://<your computer's IP>:8765/index.html` on the phone.

## Desktop shortcut

Chrome or Edge can open the page in its own window, with no tabs or address bar:

    chrome.exe --app=file:///C:/Users/AZP/tally/index.html

Point a desktop shortcut at that (icon: `icon.ico`) and it behaves like a local app. Data is kept per address, so the first time you open it this way, Restore a Backup taken from wherever you were using it before.

## Same numbers on every device

Turn on **Sync** from the History page. It gives you a private code. Enter that code on each other device (History, then "I have a code") and they all share one ledger. Changes go up within a second and come down whenever the app is opened or brought back to the front; "Sync now" forces it.

The ledger is stored under that code in a small cloud database (Supabase). Nothing can read it without the code, so treat the code like a password. It is kept outside the ledger, so backup files never contain it. If two devices change things at the same moment, the second one is told to redo its last change.

## Where the data lives

Everything is stored in the browser's local storage for the address you opened. That means:

- It survives closing the browser and rebooting.
- It does **not** follow the file to another machine or browser, and it goes away if you clear the browser's site data.
- The phone and the computer each keep their own copy.

So use **Backup** now and then. It downloads a single JSON file. **Restore** loads one back, on any device.

## What's in it

- **Overview** – net worth, change over the last 30 days, a history chart, what is coming up, and a glance at accounts, goals and plan drift.
- **Accounts** – every place money lives or is owed. Update a balance whenever it changes; a snapshot is taken automatically.
- **Plan** – buckets with a target share of your assets (e.g. 10% cash, 25% emergency fund, 65% invested). Shows what to move to get on target, and how to split new money each month after bills.
- **Goals** – money earmarked for something specific, optionally with a date and the account it sits in.
- **Upcoming** – everything on the horizon in one list. Repeating items (rent, the car payment, a subscription: every week, 2 weeks, month or year) come back on their day after you pay them; one-time money in or out sits there until you mark it received or paid. Paying pulls from the source account and, if it's a card or loan payment, pays the debt down too.
- **History** – every change, newest first, plus the daily net worth snapshots and the backup/restore/reset controls.

## Files

- `index.html` – the shell
- `app.css` – all styling (colors are CSS variables at the top; there is a light "paper" theme too)
- `app.js` – all logic, plain JavaScript
- `manifest.json`, `icon.svg`, `icon-*.png` – home-screen name and icon
