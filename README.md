# Gym Tracker

A cloud workout tracker for Android (and any phone or desktop browser). Log every set, see your history on a calendar, and track strength progress with charts and personal records.

**Stack:** React + TypeScript (Vite) · Supabase (PostgreSQL, login, security) · Vercel hosting · Capacitor for the Android app.

---

## What's included

| Screen | What it does |
|---|---|
| Login / Register / Forgot password | Email + password accounts, password reset by email |
| Home dashboard | Today's workout, last workout date, total & weekly workouts, muscle groups this week, latest PRs, recent trends, body weight |
| Start workout | Pick one or more muscle groups (Chest, Back, Shoulders, Arms, Legs) and the date |
| Choose exercise | Built-in exercise list per muscle group, search, add your own custom exercises |
| Log sets | Weight + reps per set with big +/− buttons, **last time's sets shown automatically**, one-tap **Copy last workout**, notes, live volume and "vs last" %, PR alert |
| Workout | All exercises in a session, comparison with the previous time, edit date / groups, delete |
| History | Month calendar with workout days marked, tap a day to see it, search by exercise or muscle group |
| Progress | Per-exercise dashboard: max weight, estimated 1RM, volume and reps charts; reps at a chosen weight; PRs; comparison vs previous workout, 7/30/90 days, 6/12 months and all time |
| Body weight | Weigh-ins, chart, change over time |
| Profile / Settings | Name, sex, height, weight, change password, sign out |

Every user can only see and change their own data (enforced in the database with Row Level Security, not just in the app).

---

## Step 1 — Create the database (Supabase, free)

1. Go to <https://supabase.com>, sign up, and click **New project**. Pick a region close to you (e.g. *Middle East* or *Europe (Frankfurt)*).
2. When it's ready, open **SQL Editor → New query**, paste the whole contents of `supabase/schema.sql`, and click **Run**. This creates all tables, security rules, and the default exercise list. (It's safe to run again later.)
3. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
4. Open **Authentication → URL Configuration**:
   - **Site URL:** your app's web address (after Step 3, e.g. `https://gym-tracker.vercel.app`). Use `http://localhost:5173` while testing on a computer.
   - **Redirect URLs:** add `https://YOUR-APP.vercel.app/**` (and `http://localhost:5173/**` for testing).
5. Optional: **Authentication → Providers → Email** → turn off *Confirm email* if you want new users to log in immediately without clicking an email link.

> Supabase's built-in email sender is limited to a few emails per hour. For real use, set up your own SMTP under **Authentication → Emails → SMTP settings**.

## Step 2 — Run it on a computer (optional, for testing)

Needs [Node.js 18+](https://nodejs.org).

```bash
npm install
cp .env.example .env      # then fill in the three values
npm run dev               # open http://localhost:5173
```

## Step 3 — Put it online (Vercel, free)

1. Upload this folder to a GitHub repository.
2. Go to <https://vercel.com> → **Add New → Project** → import the repository. Vercel detects Vite automatically.
3. Under **Environment Variables** add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
   - `VITE_SITE_URL` = the Vercel address (e.g. `https://gym-tracker.vercel.app`)
4. Click **Deploy**. Then go back to Supabase Step 1.4 and set the Site URL to this address.

## Step 4 — Get it on Android

### Option A — Install from Chrome (fastest, no Play Store)

1. On the Android phone, open the Vercel address in **Chrome**.
2. Tap **⋮ → Install app** (or **Add to Home screen**).
3. It now opens full-screen from its own icon, like a normal app. Updates go live automatically every time you redeploy.

### Option B — Real Android app (APK / Google Play)

Needs [Android Studio](https://developer.android.com/studio) on a computer.

```bash
npm install
cp .env.example .env            # fill in values; VITE_SITE_URL must be your Vercel address
npm run android:add             # first time only: creates the android/ project
npm run android:sync            # builds the web app and copies it into android/
npm run android:open            # opens Android Studio
```

In Android Studio:
- **Run ▶** to install on a phone connected by USB (turn on *Developer options → USB debugging*), or
- **Build → Generate Signed Bundle / APK** to make an APK to share, or an AAB to upload to Google Play (a Play developer account costs a one-time $25).

Run `npm run android:sync` again after every code change. To change the app ID (`com.gymtracker.app`) or name, edit `capacitor.config.json` **before** `android:add`.

---

## How the numbers are calculated

- **Volume** = sum of weight × reps across all sets of an exercise in one workout.
- **Estimated 1RM** = Epley formula: weight × (1 + reps ÷ 30); a single rep counts as the weight itself.
- **Progress %** compares the latest workout with the earliest workout inside each period (or with the previous workout).
- **Personal records:** heaviest weight (with reps), best estimated 1RM, best volume, most reps, and best reps at each weight. They are also available in the database as the `personal_records` view.
- Weeks start on **Sunday**. Change `WEEK_STARTS_ON` in `src/lib/dates.ts` if you prefer Monday.

## Project layout

```
supabase/schema.sql      Database: tables, security rules, sign-up trigger, default exercises
src/lib/api.ts           All database reads and writes
src/lib/stats.ts         Volume, 1RM, PRs, % change
src/pages/               One file per screen
src/components/          Bottom navigation, chart, small UI pieces
public/                  App icon, install manifest, offline shell
capacitor.config.json    Android app settings
```

## Adding Arabic later

All text is in the page files under `src/pages/`. To add Arabic, move strings into a translation file (e.g. with `react-i18next`) and set `dir="rtl"` on `<html>` when Arabic is selected; the layout uses flexbox/grid, so most screens will mirror cleanly.
