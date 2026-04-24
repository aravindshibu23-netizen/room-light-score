# Room Light Score

A low-budget phone-friendly website for four roommates. It tracks who gets a point when a light is left on. The highest score gets the punishment.

This version is a static website, so it can be hosted free on GitHub Pages. It also works like an app when added to the home screen on iPhone or Android.

## Important limit

No website can magically know who was last to leave the apartment unless you add hardware, sensors, a smart switch, or everyone honestly taps a button. This app starts with the cheapest method:

- If someone finds a light left on, they open the app and tap that person's name.
- If roommates want a leaving record, each person taps their name in Exit Log when leaving.
- If you later want automatic detection, use a smart switch or smart bulb and connect it to a backend.

## Files

Upload these files and folders to GitHub:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `assets/icon.svg`
- `assets/icon-192.png`
- `assets/icon-512.png`
- `README.md`

## Step 1: Create a GitHub account

1. Go to `https://github.com`.
2. Click `Sign up`.
3. Create your account.
4. Verify your email address.

## Step 2: Create a repository

1. Log in to GitHub.
2. Click the `+` button in the top right.
3. Click `New repository`.
4. Repository name: `room-light-score`.
5. Choose `Public`.
6. Tick `Add a README file` if GitHub asks. It is okay either way.
7. Click `Create repository`.

## Step 3: Upload the website files

1. Open your new `room-light-score` repository.
2. Click `Add file`.
3. Click `Upload files`.
4. Drag all the website files into the upload box.
5. Make sure the `assets` folder is uploaded too.
6. Scroll down.
7. Click `Commit changes`.

## Step 4: Turn on GitHub Pages

1. Open the repository on GitHub.
2. Click `Settings`.
3. In the left menu, click `Pages`.
4. Under `Build and deployment`, find `Source`.
5. Choose `Deploy from a branch`.
6. Under `Branch`, choose `main`.
7. Choose `/root`.
8. Click `Save`.
9. Wait 1 to 3 minutes.
10. GitHub will show a website link like:

```text
https://YOUR-GITHUB-USERNAME.github.io/room-light-score/
```

Open that link on your phone.

## Step 5: Install on Android

1. Open the GitHub Pages link in Chrome.
2. Tap the three dots menu.
3. Tap `Add to Home screen` or `Install app`.
4. Tap `Add`.

## Step 6: Install on iPhone

1. Open the GitHub Pages link in Safari.
2. Tap the Share button.
3. Tap `Add to Home Screen`.
4. Tap `Add`.

## Optional: Make scores sync across all phones

Without sync, the score is saved only in the browser that enters it. For all four phones to share the same score, use Firebase Firestore's free tier.

### Firebase setup

1. Go to `https://firebase.google.com`.
2. Click `Go to console`.
3. Click `Create a project`.
4. Name it `Room Light Score`.
5. You can turn Google Analytics off.
6. Click `Create project`.
7. In the left menu, click `Build`.
8. Click `Firestore Database`.
9. Click `Create database`.
10. Choose a location near you.
11. For a quick private-room test, choose `Start in test mode`.
12. Click `Create`.

### Get the web app config

1. In Firebase, click the gear icon.
2. Click `Project settings`.
3. Under `Your apps`, click the web icon: `</>`.
4. App nickname: `room-light-score`.
5. Click `Register app`.
6. Firebase will show code containing `firebaseConfig`.
7. Copy only the values inside that config.

### Paste the config into `app.js`

Open `app.js` and find this part at the top:

```js
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
```

Replace the empty strings with your Firebase values. It will look similar to this:

```js
const FIREBASE_CONFIG = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

Upload the changed `app.js` to GitHub again. After GitHub Pages updates, all four phones should show the same room score.

## Firebase warning

Test mode is easy, but anyone with your website link may be able to edit your score data. For a serious version, add login or stricter Firebase security rules later.

## Cheap operating rule

Put the app link or a QR code near the room light switch. When someone finds the light left on, they tap the person's name once. At the end of the week, the highest score gets the punishment and then you reset the round.
