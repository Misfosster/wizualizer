# Playwright E2E Tests

This folder contains end-to-end tests for the frontend UI. Playwright launches a real browser, starts the Vite dev server, and drives the app like a user would.

## Setup

From the `web` directory:

```bash
npm install
npx playwright install chromium #we might wanna test against firefox as well at some point
```

## Run Tests

```bash
npm run test:e2e
```

For the interactive UI runner:

```bash
npm run test:e2e:ui
```

Tests in this folder will have to pass on Github Actions (on PR) to be deployed on Github Pages. Tests run on every push to any branch though.