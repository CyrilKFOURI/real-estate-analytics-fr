# 009 Mobile app (iOS / Android)

Same screens as the web: every dashboard screen is an Expo DOM component, rendered in a webview on native.

## What changes for native
- **Data host:** on the web the KPI files are served next to the page (`/data`). A phone has no such server:
  the app reads them from the published site, `EXPO_PUBLIC_SITE_URL` (e.g. the GitHub Pages export, see 016).
  The same base serves the MapLibre worker (`/vendor/maplibre-gl-csp-worker.js`). Unset on the web → relative.
- **Estimate API:** stays local (it returns individual DVF sales, never published). On a phone the property
  page shows the "estimation indisponible" panel; market, rent and money panels still work.
- **Branding:** name Cyfouri, icons and splash from the Cyfouri logo, paper background.
- **Builds:** `eas.json` with `preview` (Android APK / iOS simulator) and `production` profiles. Building needs the
  user's Expo account (`eas login`); not run here. No Android SDK on this machine: native correctness is checked
  by exporting the Android bundle (`npx expo export --platform android`).

## Acceptance
- `npx expo export --platform android` and `--platform ios` succeed.
- With `EXPO_PUBLIC_SITE_URL` set, data and worker URLs are absolute; unset, they stay relative (unit test).
- App name, icon and splash show Cyfouri.
