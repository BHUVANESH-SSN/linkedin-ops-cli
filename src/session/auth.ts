import type { Page } from 'playwright';
import { logger } from '../utils/logger';
import { delay } from '../utils/delay';

const LOGIN_PAGE_TIMEOUT_MS = 90000;
const MANUAL_CHECKPOINT_TIMEOUT_MS = 180000;
const POST_LOGIN_TIMEOUT_MS = 120000;

const isLoggedInUrl = (url: string): boolean =>
  url.includes('/feed') || url.includes('/home') || url.includes('/checkpoint');

export const loginToLinkedIn = async (page: Page): Promise<boolean> => {
  try {
    logger.running('Navigating to LinkedIn login...');
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: LOGIN_PAGE_TIMEOUT_MS,
    });
    await delay(3000);

    if (isLoggedInUrl(page.url())) {
      logger.success('Already logged in — skipping auth');
      return true;
    }

    logger.running('Filling credentials...');

    const usernameInput = page.locator('#username, input[name="session_key"]').first();
    const passwordInput = page.locator('#password, input[name="session_password"]').first();

    await usernameInput.waitFor({
      state: 'visible',
      timeout: MANUAL_CHECKPOINT_TIMEOUT_MS,
    });
    await passwordInput.waitFor({
      state: 'visible',
      timeout: MANUAL_CHECKPOINT_TIMEOUT_MS,
    });

    await usernameInput.fill(process.env['LINKEDIN_EMAIL'] ?? '', {
      timeout: MANUAL_CHECKPOINT_TIMEOUT_MS,
    });
    await delay(800);

    await passwordInput.fill(process.env['LINKEDIN_PASSWORD'] ?? '', {
      timeout: MANUAL_CHECKPOINT_TIMEOUT_MS,
    });
    await delay(600);

    await page
      .locator('[data-litms-control-urn="login-submit"], button[type="submit"]')
      .first()
      .click({ timeout: MANUAL_CHECKPOINT_TIMEOUT_MS });

    await page.waitForURL(url => !url.toString().includes('/login'), {
      timeout: POST_LOGIN_TIMEOUT_MS,
    });
    await delay(3000);

    logger.success(`LinkedIn login successful — on: ${page.url()}`);
    return true;
  } catch (err) {
    logger.fail(`LinkedIn login failed: ${String(err)}`);
    return false;
  }
};
