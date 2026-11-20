# Cube trainer

A 3x3 speedcube trainer for the CFOP method: cross, F2L, and 2-look OLL and PLL. It has a 3D cube you can drag around, a timer with separate recognition timing, a no-cube recognition drill, and full-solve split times with stats.

Everything runs in the browser. Progress is saved in the browser's local storage on the device you use and never leaves it.

The live site counts visits anonymously with Umami: no cookies, nothing personal, and none of your times or stats. Beyond the visit itself it sends at most one count per visit for each of these:

- each kind of practice used (`practised-f2l`, `drill-oll`, `full-solve` and so on)
- how long the visit lasted (`stayed-1-min`, `stayed-5-min`, up to `stayed-60-min`), counting only time with the page on screen and in use
- how much was practised (`did-10-cases`, `did-25-cases`, `did-50-cases`, `did-100-cases`)
- a rough range for full-solve time (`solve-under-30s`, `solve-30-60s`, `solve-1-2min`, `solve-over-2min`), never the time itself Browsers set to Do Not Track are left out, and nothing is counted when the page runs on localhost.

## Layout

- `site/index.html` is the whole site: one self-contained page. This folder is what gets published.
- `tests/` holds the Playwright tests and a tiny static server used by them.
- `.github/workflows/deploy.yml` runs the tests on every push and publishes `site/` to GitHub Pages when they pass on `main`.

## Run it locally

```
npm install
npx playwright install chromium webkit
npm start          # serves the site at http://127.0.0.1:4173
npm test           # runs the tests on every screen size
```

Screenshots from the last test run are written to `test-results/screens/<screen>/`.

## Screen sizes tested

Phones (320x568, 375x667, 390x664 and 390x844 in the Safari engine, 412x780, 430x932, and 844x390 on its side), tablets (768x954 and 1024x698), laptops (1366x657, 1536x730), and a 1920x950 desktop. These are page sizes, so several are shorter than the device's screen to allow for the browser's own bars. The list lives in `playwright.config.js`.

On narrow screens the page is a single column with the timer docked at the bottom, and the cube shrinks on short screens so the timer never covers it. From 900 px wide, and on phones turned sideways, the cube sits beside the controls.

## Credits

The 2-look OLL and PLL algorithms follow the set taught by Cube.Academy.
