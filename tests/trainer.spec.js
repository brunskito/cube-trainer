const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const STORE = 'f2l-trainer-v1';
let errors;

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // a blocked web font is not a bug in the page; anything else logged as an error is
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.goto('/');
  await expect(page.locator('#practice .modes')).toBeVisible();
});
test.afterEach(() => { expect(errors, 'the page should not log script errors').toEqual([]); });

// tap on touch screens, click with a mouse
async function press(locator, hasTouch) { if (hasTouch) await locator.tap(); else await locator.click(); }

async function shot(page, testInfo, name) {
  await page.screenshot({ path: path.join('test-results', 'screens', testInfo.project.name, name + '.png') });
}

// nothing may stick out past the right edge or make the page scroll sideways
async function expectFits(page, where) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = [];
    for (const n of document.querySelectorAll('main *')) {
      const b = n.getBoundingClientRect();
      if (!b.width || !b.height || getComputedStyle(n).visibility === 'hidden') continue;
      if (b.right > vw + 1 || b.left < -1) out.push(`${n.tagName.toLowerCase()}.${n.className || n.id} [${Math.round(b.left)}..${Math.round(b.right)}]`);
    }
    return { vw, sw: document.documentElement.scrollWidth, out: out.slice(0, 8) };
  });
  expect(r.out, `${where}: elements outside the ${r.vw}px wide screen`).toEqual([]);
  expect(r.sw, `${where}: page scrolls sideways`).toBeLessThanOrEqual(r.vw);
}

test('every practice mode fits the screen', async ({ page, hasTouch }, testInfo) => {
  for (const mode of ['Cross', 'F2L', 'OLL', 'PLL', 'Solve']) {
    await press(page.locator('#practice .modes button', { hasText: mode }), hasTouch);
    await expect(page.locator('#practice .modes button.on')).toHaveText(mode);
    await expect(page.locator('.scramble .moves')).toBeVisible();
    await expectFits(page, mode);
    await shot(page, testInfo, 'practice-' + mode.toLowerCase());
  }
});

test('layout matches the screen: stacked on phones, side by side on wide screens', async ({ page }, testInfo) => {
  const cols = testInfo.project.metadata.cols;
  const box = async sel => page.locator(sel).boundingBox();
  const cube = await box('#cubeBox'), scramble = await box('.scramble'), timer = await box('#timer');
  const vp = page.viewportSize();
  const timerPos = await page.locator('#timer').evaluate(n => getComputedStyle(n).position);
  expect(cube.width, 'cube is a usable size').toBeGreaterThanOrEqual(150);
  expect(cube.x, 'cube is on screen').toBeGreaterThanOrEqual(0);
  expect(cube.x + cube.width).toBeLessThanOrEqual(vp.width);
  if (cols === 2) {
    expect(scramble.x, 'scramble sits to the right of the cube').toBeGreaterThanOrEqual(cube.x + cube.width - 1);
    expect(timerPos, 'timer sits in the page, not docked').toBe('static');
    expect(timer.x, 'timer is in the right-hand column').toBeGreaterThanOrEqual(cube.x + cube.width - 1);
  } else {
    expect(scramble.y, 'scramble sits below the cube').toBeGreaterThanOrEqual(cube.y + cube.height - 1);
    expect(timerPos, 'timer is docked to the bottom of the screen').toBe('fixed');
    expect(timer.y + timer.height, 'docked timer is fully on screen').toBeLessThanOrEqual(vp.height);
    // the whole cube must be visible above the docked timer without scrolling
    expect(cube.y + cube.height, 'cube is not covered by the timer').toBeLessThanOrEqual(timer.y);
    // on anything but the very shortest phones the scramble moves must be readable without scrolling too
    if (vp.height >= 640) {
      const moves = await box('.scramble .moves');
      expect(moves.y + Math.min(moves.height, 36), 'first line of the scramble is above the timer').toBeLessThanOrEqual(timer.y);
    }
  }
});

test('timing an F2L case shows the solution, and rating it saves a stat', async ({ page, hasTouch }, testInfo) => {
  const timer = page.locator('#timer');
  await press(timer, hasTouch);
  await expect(timer).toHaveClass(/looking/);
  await shot(page, testInfo, 'timer-fullscreen');
  await page.waitForTimeout(500);
  await press(timer, hasTouch);
  await expect(timer).toHaveClass(/running/);
  await page.waitForTimeout(500);
  await press(timer, hasTouch);
  await expect(page.locator('.result .time')).toBeVisible();
  await expect(page.locator('.result .mv').first()).toBeVisible();
  await expect(page.locator('.result .chunk').first()).toBeVisible();
  await expectFits(page, 'F2L result');
  await shot(page, testInfo, 'f2l-result');
  await page.waitForTimeout(500);
  await press(page.locator('.ratebtns .r1'), hasTouch);
  await expect(page.locator('#timer')).toHaveClass(/ready/);
  const tries = await page.evaluate(k => Object.values(JSON.parse(localStorage.getItem(k)).stats).reduce((a, s) => a + s.n, 0), STORE);
  expect(tries).toBe(1);
});

test('a timer tap right after the page loads still counts', async ({ page, hasTouch }) => {
  // Slow the page's clock 200x so every tap lands "within a few milliseconds of loading",
  // which is what a very fast device does for real. The double-tap guard must not eat the first tap.
  await page.addInitScript(() => { const real = performance.now.bind(performance); performance.now = () => real() / 200; });
  await page.reload();
  await press(page.locator('#timer'), hasTouch);
  await expect(page.locator('#timer')).toHaveClass(/looking/);
  await page.reload();
  await press(page.locator('#practice .modes button', { hasText: 'Solve' }), hasTouch);
  await press(page.locator('#solveTimer'), hasTouch);
  await expect(page.locator('#solveTimer')).toHaveClass(/running/);
});

test('stepping through a solution turns the cube', async ({ page, hasTouch }) => {
  await press(page.getByRole('button', { name: 'Show solution without timing' }), hasTouch);
  const moves = page.locator('.result .mv');
  await expect(moves.first()).toBeVisible();
  await press(page.getByRole('button', { name: 'Forward one move' }), hasTouch);
  await expect(moves.first()).toHaveClass(/done/);
  await expect(page.locator('#stepCount')).toContainText('1 of');
});

test('a full solve records four splits and shows up in the stats', async ({ page, hasTouch }, testInfo) => {
  await press(page.locator('#practice .modes button', { hasText: 'Solve' }), hasTouch);
  const timer = page.locator('#solveTimer');
  await expect(timer).toBeVisible();
  for (let i = 0; i < 5; i++) { await press(i ? page.locator('#solveTimer') : timer, hasTouch); await page.waitForTimeout(450); }
  await expect(page.locator('.result .splitrow')).toHaveCount(4);
  await expectFits(page, 'solve result');
  await shot(page, testInfo, 'solve-result');
  await page.waitForTimeout(300);
  await press(page.locator('#tab-cases'), hasTouch);
  await expect(page.locator('#cases .statgrid .stat')).toHaveCount(4);
  await expect(page.locator('#cases .statgrid .sval').first()).toHaveText('1');
  await expectFits(page, 'solve stats');
  await shot(page, testInfo, 'solve-stats');
});

test('the recognition drill asks a question and marks the answer', async ({ page, hasTouch }, testInfo) => {
  await press(page.getByRole('button', { name: 'Switch to the recognition drill (no cube)' }), hasTouch);
  await press(page.getByRole('button', { name: 'Start drill' }), hasTouch);
  const options = page.locator('.dopt');
  await expect(options).toHaveCount(4);
  await expectFits(page, 'drill question');
  await shot(page, testInfo, 'drill-question');
  await page.waitForTimeout(500);
  await press(options.first(), hasTouch);
  await expect(page.locator('.dopt.right')).toHaveCount(1);
  await expect(page.locator('.drillfb')).toBeVisible();
  await expectFits(page, 'drill feedback');
  await shot(page, testInfo, 'drill-feedback');
});

test('the case list shows all 41 F2L cases and fits', async ({ page, hasTouch }, testInfo) => {
  await press(page.locator('#tab-cases'), hasTouch);
  const rows = page.locator('#cases .caserow');
  await expect(rows).toHaveCount(41);
  await expectFits(page, 'F2L cases');
  await shot(page, testInfo, 'cases-f2l');
  if (testInfo.project.metadata.cols === 2 && page.viewportSize().width >= 900) {
    const a = await rows.nth(0).boundingBox(), b = await rows.nth(1).boundingBox();
    expect(Math.abs(a.y - b.y), 'cases are laid out in a grid on wide screens').toBeLessThan(2);
  }
  for (const mode of ['OLL', 'PLL', 'Cross']) {
    await press(page.locator('#cases .modes button', { hasText: mode }), hasTouch);
    await expect(page.locator('#cases .modes button.on')).toHaveText(mode);
    await expectFits(page, mode + ' cases');
  }
});

test('the settings panel opens and fits', async ({ page, hasTouch }, testInfo) => {
  await press(page.getByRole('button', { name: 'Change' }), hasTouch);
  await expect(page.locator('.settings')).toBeVisible();
  await expectFits(page, 'settings');
  await shot(page, testInfo, 'settings');
});

test('choices are remembered after a reload', async ({ page, hasTouch }) => {
  await press(page.locator('#practice .modes button', { hasText: 'PLL' }), hasTouch);
  await expect(page.locator('#practice .modes button.on')).toHaveText('PLL');
  await page.reload();
  await expect(page.locator('#practice .modes button.on')).toHaveText('PLL');
});

test('visit counting reports what was practised and how long, once each, and nothing else', async ({ page, hasTouch }) => {
  // Counting is off on localhost, so serve the local page at the live address and swap Umami's script for a recorder.
  const live = 'https://brunskito.github.io/cube-trainer/';
  await page.clock.install();
  await page.route(live, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8') }));
  await page.route('https://cloud.umami.is/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.__sent = []; window.umami = { track: (...a) => window.__sent.push(a) };' }));
  await page.goto(live);
  await expect(page.locator('#privacy')).toContainText('counts visits anonymously');
  const sent = async () => (await page.evaluate(() => window.__sent)).map(a => a[0]);

  // two F2L cases finished: one count, not two
  for (let i = 0; i < 2; i++) {
    await press(page.getByRole('button', { name: 'Show solution without timing' }), hasTouch);
    await press(page.locator('.ratebtns .r1'), hasTouch);
  }
  expect(await sent()).toEqual(['practised-f2l']);

  // six minutes of use, with a tap every two minutes
  for (let i = 0; i < 3; i++) { await page.clock.runFor('02:00'); await press(page.locator('h1'), hasTouch); }
  expect(await sent()).toEqual(['practised-f2l', 'stayed-1-min', 'stayed-3-min', 'stayed-5-min']);

  // then the page is left open untouched for an hour: the clock stops after three idle minutes
  await page.clock.runFor('01:00:00');
  const names = await sent();
  expect(names).not.toContain('stayed-10-min');
  for (const n of names) expect(n).toMatch(/^(practised-(cross|f2l|oll|pll)|drill-(f2l|oll|pll)|full-solve|stayed-\d+-min)$/);
  // every event is a bare name: no data rides along with it
  expect((await page.evaluate(() => window.__sent)).every(a => a.length === 1)).toBe(true);
});

test('the space bar runs the timer on a keyboard', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'keyboard shortcut is for laptops and desktops');
  const timer = page.locator('#timer');
  await page.keyboard.press('Space');
  await expect(timer).toHaveClass(/looking/);
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await expect(timer).toHaveClass(/running/);
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await expect(page.locator('.result .time')).toBeVisible();
});
