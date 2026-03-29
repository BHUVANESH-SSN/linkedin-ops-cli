/**
 * ============================================
 * PURPOSE
 * ============================================
 * Automates liking the most recent LinkedIn post.
 *
 * - Navigates to recent activity page
 * - Finds first valid post
 * - Detects Like button safely
 * - Avoids duplicate likes
 * - Confirms action via UI state / toast
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * likeRecentPost(page, profileUrl)
 *   → Input: Playwright Page + profile URL
 *   → Output: Likes most recent post or throws error
 */

import type { Locator, Page } from "playwright-core";
import { logger } from "../logger.js";
import { humanDelay } from "../utils.js";

// ============================================
// SELECTORS
// ============================================

const SELECTORS = {
  likeButton: [
    'button[aria-label*="React Like"]',
    'button[aria-label*="Reaction button state"]',
    'button[aria-label*="Current reaction"]',
    'button[aria-label*="Like"]',
    'button:has-text("Like")',
  ],

  toast: [
    '[data-testid*="toast"]',
    '[role="alert"]',
    '[aria-live="assertive"]',
  ],
};

// ============================================
// URL HELPERS
// ============================================

function toActivityUrl(profileUrl: string): string {
  return profileUrl.endsWith("/")
    ? `${profileUrl}recent-activity/all/`
    : `${profileUrl}/recent-activity/all/`;
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function likeRecentPost(
  page: Page,
  profileUrl: string
): Promise<void> {
  const activityUrl = toActivityUrl(profileUrl);

  // --------------------------------------------
  // 1. OPEN ACTIVITY PAGE
  // --------------------------------------------
  logger.step(profileUrl, "like", "Opening activity page");

  await page.goto(activityUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await humanDelay(1500, 2500);

  // --------------------------------------------
  // 2. FIND FIRST POST
  // --------------------------------------------
  const post = await findFirstPost(page);

  // --------------------------------------------
  // 3. FIND LIKE BUTTON
  // --------------------------------------------
  const likeBtn = await findLike(post);

  if (!likeBtn) {
    throw new Error("Like button not found on first post");
  }

  // --------------------------------------------
  // 4. CHECK IF ALREADY LIKED
  // --------------------------------------------
  if (await isAlreadyLiked(likeBtn)) {
    logger.success("Post already liked");
    return;
  }

  // --------------------------------------------
  // 5. CLICK LIKE
  // --------------------------------------------
  await clickLike(post, likeBtn);

  // --------------------------------------------
  // 6. CONFIRM ACTION
  // --------------------------------------------
  if (await confirmLike(page, post)) {
    logger.success("Liked the first recent post");
    return;
  }

  logger.warn("Like clicked but confirmation not detected");
}

// ============================================
// HELPERS
// ============================================

async function findFirstPost(page: Page): Promise<Locator> {
  const posts = page.locator('[role="article"], [role="listitem"]');

  for (let i = 0; i < Math.min(await posts.count(), 6); i++) {
    const post = posts.nth(i);

    if (await post.isVisible().catch(() => false)) {
      const like = await findLike(post);
      if (like) return post;
    }
  }

  throw new Error("No valid recent post found");
}

async function findLike(root: Locator): Promise<Locator | null> {
  for (const selector of SELECTORS.likeButton) {
    const btn = root.locator(selector).first();

    if (await btn.isVisible().catch(() => false)) {
      const label =
        (await btn.getAttribute("aria-label"))?.toLowerCase() || "";

      // Skip reaction menu
      if (label.includes("open reactions")) continue;

      return btn;
    }
  }

  return null;
}

async function isAlreadyLiked(button: Locator): Promise<boolean> {
  const pressed = await button.getAttribute("aria-pressed");
  const label =
    (await button.getAttribute("aria-label"))?.toLowerCase() || "";

  return (
    pressed === "true" ||
    label.includes("liked") ||
    label.includes("unlike") ||
    label.includes("current reaction")
  );
}

async function clickLike(post: Locator, button: Locator) {
  try {
    await post.scrollIntoViewIfNeeded();
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await humanDelay(800, 1400);
  } catch {
    await button.click({ force: true });
    await humanDelay(800, 1400);
  }
}

async function confirmLike(
  page: Page,
  post: Locator
): Promise<boolean> {
  for (let i = 0; i < 6; i++) {
    const btn = await findLike(post);

    if (btn && (await isAlreadyLiked(btn))) return true;

    if (await hasToast(page)) return true;

    await humanDelay(600, 1000);
  }

  return false;
}

async function hasToast(page: Page): Promise<boolean> {
  for (const selector of SELECTORS.toast) {
    const el = page.locator(selector).first();

    if (await el.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}