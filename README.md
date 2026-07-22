# Point Market (PM)

A social marketplace for trading items, skills, and services using PM Points.
Built with React + Vite, Firebase (Auth + Firestore), and Cloudinary.

## Quick start

```bash
npm install
npm run dev      # local development at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

## Before first run

1. **Firebase Phone Auth** — already configured in `src/firebase.js` with this
   project's credentials. Make sure Phone Authentication is enabled in your
   Firebase Console (Authentication → Sign-in method → Phone).

2. **Authorized domains** — add `localhost` and your deployed Netlify domain
   under Firebase Console → Authentication → Settings → Authorized domains.

3. **Firestore rules & indexes** — deploy them:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   (uses the `firebase.json`, `firestore.rules`, and `firestore.indexes.json`
   already in this project)

4. **Cloudinary** — uploads go to cloud name `dzhy4zx5g` using the unsigned
   preset `point_market_unsigned`. Create that preset once in your Cloudinary
   dashboard: Settings → Upload → Upload presets → Add preset → Signing Mode:
   Unsigned → name it exactly `point_market_unsigned`.

5. **First admin account** — sign up normally in the app, then in Firebase
   Console → Firestore → `users/{your-uid}`, add a field `isAdmin: true`
   (boolean). This unlocks the admin dashboard (long-press the splash logo).

## Project structure

```
point-market/
├── index.html              ← Vite entry HTML (has #pm-recaptcha-container)
├── package.json
├── vite.config.js
├── netlify.toml             ← Netlify build + SPA redirect config
├── firebase.json            ← Firebase CLI deploy config
├── firestore.rules          ← Security rules for every collection
├── firestore.indexes.json   ← Required composite indexes
├── public/
│   ├── favicon.svg
│   └── robots.txt
└── src/
    ├── main.jsx              ← React entry point
    ├── App.jsx                ← Full application (auth, feed, marketplace, admin)
    ├── firebase.js             ← Firebase app/auth/db initialization
    ├── index.css               ← Global reset
    └── services/
        ├── userService.js       ← User profile create/read/update
        ├── cloudinaryService.js  ← Direct browser → Cloudinary uploads
        ├── marketplace.js         ← Product/skill listings, search, categories
        ├── pointsEngine.js         ← PM Points rewards, transfers, purchases, fraud checks
        └── socialService.js        ← Trades, reviews, reports, follow system, admin user ops
```

## Deploying to Netlify

1. Push this project to a GitHub repo
2. Netlify → Add new site → Import from Git
3. Build command: `npm run build` (already set in `netlify.toml`)
4. Publish directory: `dist` (already set in `netlify.toml`)
5. Deploy — `netlify.toml` already handles SPA routing so refreshes work
   correctly on any screen of the app
6. After deploy, add your Netlify URL to Firebase Authorized Domains
   (Authentication → Settings → Authorized domains)

## Notes on current state

- Real Firebase Phone Auth (no demo OTP codes anywhere)
- Real Firestore reads/writes for posts, users, points
- Real Cloudinary video/image upload with progress + cancellation
- `marketplace.js`, `pointsEngine.js`, and `socialService.js` are complete,
  production-grade service modules; some of their functions (search, filters,
  peer transfers, trade flows) are ready to call but not yet wired into every
  UI screen — the core auth → upload → post → feed loop is fully connected
  end-to-end today.
