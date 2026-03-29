import type { Page } from 'playwright';
import { gotoTargetPage, waitRandomDelay } from '../browser/session';

// Human-like click — moves mouse TO the element before clicking.
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

const hasVisibleTextButton = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(name, 'i') }).first();

const getVisibleConnectAction = async (
  page: Page,
): Promise<{
  locator: ReturnType<Page['locator']>;
  source: 'primary' | 'menu';
} | null> => {
  const primaryConnectButton = hasVisibleTextButton(page, 'Connect');

  if (await primaryConnectButton.isVisible().catch(() => false)) {
    return {
      locator: primaryConnectButton,
      source: 'primary',
    };
  }

  const menuConnectItem = page
    .locator(
      '[role="menuitem"]:has-text("Connect"), [role="option"]:has-text("Connect"), div[role="button"]:has-text("Connect"), button:has-text("Connect")',
    )
    .first();

  if (await menuConnectItem.isVisible().catch(() => false)) {
    return {
      locator: menuConnectItem,
      source: 'menu',
    };
  }

  return null;
};

const hasAnyVisibleButton = async (page: Page, labels: string[]): Promise<boolean> => {
  for (const label of labels) {
    const button = hasVisibleTextButton(page, label);
    if (await button.isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
};

const openMoreActionsMenuIfNeeded = async (page: Page): Promise<void> => {
  const moreButton = page
    .getByRole('button', { name: /more actions|more/i })
    .first();
  if (await moreButton.isVisible().catch(() => false)) {
    await humanClick(page, moreButton);
    await waitRandomDelay();
  }
};

const humanType = async (page: Page, selector: string, text: string): Promise<void> => {
  await page.locator(selector).click();
  await waitRandomDelay(300, 600);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 40 + Math.random() * 80 });
  }
};

// Scroll through the profile like a human reading it
// Inserted AFTER page load, BEFORE any button interaction.
const humanScrollProfile = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      let y = 0;
      const step = () => {
        y += 80 + Math.random() * 60;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight * 0.7) {
          setTimeout(step, 100 + Math.random() * 150);
        } else {
          resolve();
        }
      };
      step();
    });
  });

  await waitRandomDelay(3000, 6000); // pause at bottom — simulates reading

  // Scroll back to top before clicking Connect
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await waitRandomDelay(1000, 2000);
};

export const sendConnect = async (
  page: Page,
  profileUrl: string,
  note?: string,
): Promise<void> => {
  await gotoTargetPage(page, profileUrl);
  await waitRandomDelay();
  await page.locator('main').waitFor({ state: 'visible' });

  // Move mouse naturally after page load
  const centerX = Math.floor(Math.random() * 400) + 400;
  const centerY = Math.floor(Math.random() * 200) + 200;
  await page.mouse.move(centerX, centerY, { steps: 12 });
  await waitRandomDelay();

  // Scroll through profile before doing anything
  await humanScrollProfile(page);
  // Longer delay after scroll, before connect click (4–8s)
  await waitRandomDelay(4000, 8000);

  const connectedButton = hasVisibleTextButton(page, 'Message');
  const pendingButton = hasVisibleTextButton(page, 'Pending');
  const followButton = hasVisibleTextButton(page, 'Follow');

  if (await connectedButton.isVisible().catch(() => false)) {
    console.log('Profile already appears to be a first-degree connection.');
    return;
  }

  if (await pendingButton.isVisible().catch(() => false)) {
    console.log('Connection request is already pending.');
    return;
  }

  if (
    !(await hasVisibleTextButton(page, 'Connect').isVisible().catch(() => false)) &&
    (await hasAnyVisibleButton(page, ['Edit profile', 'Open to', 'Enhance profile', 'Resources']))
  ) {
    console.log('Skipping connect: this looks like your own profile.');
    return;
  }

  let connectAction = await getVisibleConnectAction(page);

  if (!connectAction) {
    await openMoreActionsMenuIfNeeded(page);
    connectAction = await getVisibleConnectAction(page);
  }

  if (!connectAction) {
    if (await followButton.isVisible().catch(() => false)) {
      console.log('Skipping connect: this profile exposes Follow but not Connect.');
      return;
    }
    console.log('Skipping connect: no visible Connect action was found on this profile.');
    return;
  }

  console.log(
    connectAction.source === 'menu'
      ? 'Connect action found in More menu.'
      : 'Connect action found on the main profile header.',
  );

  await humanClick(page, connectAction.locator);
  await waitRandomDelay();

  if (note?.trim()) {
    const addNoteButton = hasVisibleTextButton(page, 'Add a note');
    if (await addNoteButton.isVisible().catch(() => false)) {
      await humanClick(page, addNoteButton);
      await waitRandomDelay();
      await humanType(page, 'textarea[name="message"]', note.trim());
      await waitRandomDelay();
    }
  }

  const sendButton = hasVisibleTextButton(page, 'Send');
  await sendButton.waitFor({ state: 'visible' });

  await waitRandomDelay(1000, 2500);
  await humanClick(page, sendButton);

  // Cool-down after sending connect request
  await waitRandomDelay(8000, 15000);

  console.log('Connection request sent.');
};
