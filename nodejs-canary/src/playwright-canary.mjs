// Import Synthetics Canary SDK
import { synthetics } from '@amzn/synthetics-playwright';

export const handler = async (event, context) => {
  try {
    // Launch browser
    const browser = await synthetics.launch({ headless: false });
    const browserContext = await browser.newContext({ viewport: { width: 1500, height: 1440 } });

    // Get page
    const page = await synthetics.newPage(browserContext);
    await page.setViewportSize({ width: 1500, height: 1440 });

    // Helper: navigate via header link text and validate page render
    const navigateAndValidate = async (page, navLinkText, expectedVisibleTexts) => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('app-nav-header', { state: 'visible', timeout: 30000 });

      const link = page.locator(`app-nav-header a:has(.nav-text:text-is("${navLinkText}"))`).first();
      await link.waitFor({ state: 'visible', timeout: 15000 });
      await link.click();

      await page.waitForLoadState('domcontentloaded');

      // check for the charts to load
      const charts = page.locator('.apexcharts-canvas, svg.apexcharts-svg, canvas');
      const timeoutMs = 15000;
      const pollMs = 300;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const count = await charts.count();
        if (count > 0 && await charts.first().isVisible()) break;
        await page.waitForTimeout(pollMs);
      }
      if (!(await charts.count()) || !(await charts.first().isVisible())) {
        throw new Error('Charts not rendered');
      }

      for (const text of expectedVisibleTexts) {
        await page.waitForSelector(`text=${text}`, { state: 'visible', timeout: 5000 });
      }
    };

    await synthetics.executeStep("Go_to_app.popularpower.com", async () => {
      const response = await page.goto('https://app.popularpower.io', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = response.status();
      // If the response status code is not a 2xx success code
      if (status < 200 || status > 299) {
        console.error(`Failed to load url: ${url}, status code: ${status}`);
        throw new Error('Home page did not load');
      }

      const title = await page.title();
      if (title !== "Popular Power Platform") {
        throw new Error('Title found did not match expectations!  Page Title found was:  ' + title);
      }
    })

    await synthetics.executeStep('Login', async function () {
      await page.type('.mat-mdc-form-field #login-email', "{add user name}")

      await page.type('.mat-mdc-form-field #login-password', "{add password}")

      await page.click('.content #login-button', "")
    })


    await synthetics.executeStep('Click_Sites_and_Validate_Page', async function () {
      await navigateAndValidate(page, 'Sites', [
        'Number of Sites',
        'Installed Capacity'
      ]);
    })


    await synthetics.executeStep('Click_Alert_Cente_and_Validate_Page', async function () {
      await navigateAndValidate(page, 'Alert Center', [
        'Critical Alerts',
        'Real-time Alerts',
        'Popular Alerts'
      ]);
    })

    await synthetics.executeStep('Change_Language', async function () {

      const en = page.locator('xpath=//*[normalize-space(.)="EN"]').first();
      await en.waitFor({ state: 'visible', timeout: 15000 });
      await en.click();

      const es = page.locator('xpath=//*[normalize-space(.)="ES"]').first();
      await es.waitFor({ state: 'visible', timeout: 15000 });
      await es.click();

      const expectedVisibleTexts = ['Alertas críticas', 'Alertas tiempo real', 'Alertas Popular']

      for (const text of expectedVisibleTexts) {
        await page.waitForSelector(`text=${text}`, { state: 'visible', timeout: 5000 });
      }
    })

    await synthetics.executeStep('Logout', async function () {
      await page.waitForSelector('#user-menu', { state: 'visible', timeout: 15000 });
      await page.click('#user-menu');

      await page.waitForSelector('#sign-out', { state: 'visible', timeout: 15000 });
      await page.click('#sign-out');

      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector(`text=Log In`, { state: 'visible', timeout: 5000 });
    })

  } finally {
    // Ensure browser is closed
    await synthetics.close();
  }
};
