import type { Page } from 'playwright';
import { gotoTargetPage, waitRandomDelay } from '../browser/session';

const looksLikeLinkedInPostUrl = (url: string): boolean =>
  /linkedin\.com\/(feed\/update|posts\/|embed\/feed\/update)/i.test(url);

const looksLikeLinkedInProfileUrl = (url: string): boolean =>
  /linkedin\.com\/in\/[^/]+\/?$/i.test(url);

const getLikeButton = (page: Page) =>
  page
    .locator(
      'button[aria-label*="Like"], button[aria-label*="like"], button[aria-pressed][aria-label*="reaction"]',
    )
    .first();

const humanClick = async (page: Page, locator: ReturnType<Page['locator']>): Promise<void> => {
  const box = await locator.boundingBox();

  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);
    await page.mouse.move(x, y, { steps: 8 + Math.floor(Math.random() * 6) });
    await waitRandomDelay(300, 700);
  }

  await locator.click();
};

const scrollToPost = async (page: Page): Promise<void> => {
  const scrollAmount = Math.floor(Math.random() * 300) + 150;

  await page.evaluate(amount => {
    window.scrollTo({ top: amount, behavior: 'smooth' });
  }, scrollAmount);

  await waitRandomDelay();
};

const getActivitySection = (page: Page) =>
  page.locator('section').filter({ has: page.getByText(/^Activity$/i) }).first();

const openLeftMostActivityPost = async (page: Page): Promise<boolean> => {
  const activitySection = getActivitySection(page);

  if (!(await activitySection.isVisible().catch(() => false))) {
    return false;
  }

  await activitySection.scrollIntoViewIfNeeded();
  await waitRandomDelay(2000, 4000);

  const firstPostLink = activitySection.locator('a[href*="/feed/update/"]').first();

  if (!(await firstPostLink.isVisible().catch(() => false))) {
    return false;
  }

  await humanClick(page, firstPostLink);
  await page.waitForLoadState('domcontentloaded');
  await waitRandomDelay(2000, 4000);
  return true;
};

export const likePost = async (page: Page, postUrl: string): Promise<void> => {
  if (looksLikeLinkedInProfileUrl(postUrl)) {
    console.log('Profile URL detected — opening profile Activity section...');
    await gotoTargetPage(page, postUrl);
    await waitRandomDelay(3000, 6000);

    const opened = await openLeftMostActivityPost(page);

    if (!opened) {
      console.log('Skipping like: no visible post found in the Activity section.');
      return;
    }
  } else if (looksLikeLinkedInPostUrl(postUrl)) {
    await waitRandomDelay(8000, 15000);
    await gotoTargetPage(page, postUrl);
    await waitRandomDelay();
  } else {
    console.log(`Skipping like: expected a LinkedIn post or profile URL, received ${postUrl}`);
    return;
  }

  await scrollToPost(page);

  const likeButton = getLikeButton(page);
  await likeButton.waitFor({ state: 'visible' });

  const pressed = await likeButton.getAttribute('aria-pressed');

  if (pressed === 'true') {
    console.log('Post is already liked.');
    return;
  }

  const box = await likeButton.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width * 0.2, box.y - 20, { steps: 10 });
    await waitRandomDelay(400, 900);
  }

  await humanClick(page, likeButton);
  await waitRandomDelay(5000, 10000);

  console.log('Post liked successfully.');
};
