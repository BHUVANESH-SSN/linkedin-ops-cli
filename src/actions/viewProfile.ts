import type { Page } from 'playwright';
import { gotoTargetPage, waitRandomDelay } from '../browser/session';

// Random mouse movement during scroll — simulates reading behaviour
const moveMouseRandomly = async (page: Page): Promise<void> => {
  const x = Math.floor(Math.random() * 800) + 200;
  const y = Math.floor(Math.random() * 400) + 100;
  await page.mouse.move(x, y, { steps: 10 });
};

const slowScrollProfile = async (page: Page): Promise<void> => {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = page.viewportSize()?.height ?? 900;
  let currentOffset = 0;

  while (currentOffset < totalHeight) {
    // Randomised scroll step — fixed increments are a bot signal
    const scrollStep = Math.floor(viewportHeight * (0.3 + Math.random() * 0.4));
    currentOffset += Math.max(300, scrollStep);

    await page.evaluate(offset => {
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }, currentOffset);

    await moveMouseRandomly(page);
    await waitRandomDelay();

    // Occasional longer pause — simulates stopping to read a section
    if (Math.random() < 0.3) {
      await waitRandomDelay(2000, 5000);
    }
  }

  // Scroll back up slightly — real users rarely stop at the very bottom
  const scrollBackTo = Math.floor(totalHeight * 0.6);
  await page.evaluate(offset => {
    window.scrollTo({ top: offset, behavior: 'smooth' });
  }, scrollBackTo);

  await waitRandomDelay();
};

export const viewProfile = async (page: Page, profileUrl: string): Promise<void> => {
  await gotoTargetPage(page, profileUrl);
  await page.locator('main').waitFor({ state: 'visible' });

  // Move mouse before scrolling — no prior mouse activity is a bot signal
  await moveMouseRandomly(page);
  await waitRandomDelay();

  await slowScrollProfile(page);
  await waitRandomDelay();

  console.log('Profile view flow completed.');
};
