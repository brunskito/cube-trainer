const { defineConfig } = require('@playwright/test');

// One project per screen. `cols` is the layout the page should use there:
// 1 = single column with the timer docked at the bottom, 2 = cube beside the controls.
const screen = (name, width, height, cols, extra = {}) => ({
  name,
  metadata: { cols },
  use: { browserName: 'chromium', viewport: { width, height }, ...extra },
});
const touch = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/server.js', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  projects: [
    // Sizes are the page area, so several are shorter than the screen: the browser's own bars take the rest.
    screen('phone-small-320x568', 320, 568, 1, touch),
    screen('phone-se-375x667', 375, 667, 1, touch),
    screen('iphone-safari-bars-390x664', 390, 664, 1, { ...touch, browserName: 'webkit' }),
    screen('iphone-safari-390x844', 390, 844, 1, { ...touch, browserName: 'webkit' }),
    screen('android-412x780', 412, 780, 1, touch),
    screen('phone-large-430x932', 430, 932, 1, touch),
    screen('phone-landscape-844x390', 844, 390, 2, touch),
    screen('tablet-portrait-768x954', 768, 954, 1, touch),
    screen('tablet-landscape-1024x698', 1024, 698, 2, touch),
    screen('laptop-1366x657', 1366, 657, 2),
    screen('laptop-1536x730', 1536, 730, 2),
    screen('desktop-1920x950', 1920, 950, 2),
  ],
});
