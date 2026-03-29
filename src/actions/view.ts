/**
 * ============================================
 * PURPOSE
 * ============================================
 * Navigates to a LinkedIn profile and verifies
 * that the correct profile is loaded.
 *
 * - Prevents wrong profile navigation
 * - Ensures URL matches expected slug
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * viewProfile(page, profileUrl)
 *   → Input: Playwright Page + LinkedIn profile URL
 *   → Output: Navigates and validates profile
 */

import type { Page } from "playwright-core";
import { logger } from "../logger.js";
import { humanDelay, profileSlug } from "../utils.js";

// ============================================
// MAIN FUNCTION
// ============================================
export async function viewProfile(
  page: Page,
  profileUrl: string
): Promise<void> {
  // --------------------------------------------
  // 1. NAVIGATE TO PROFILE
  // --------------------------------------------
  logger.step(profileUrl, "view", "Opening profile...");

  await page.goto(profileUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // --------------------------------------------
  // 2. VERIFY CORRECT PROFILE
  // --------------------------------------------
  const currentUrl = page.url();

  const expectedSlug = profileSlug(profileUrl);
  const loadedSlug = profileSlug(currentUrl);

  if (expectedSlug !== loadedSlug) {
    throw new Error(
      `Navigation mismatch → expected: ${expectedSlug}, got: ${currentUrl}`
    );
  }

  logger.success(`Profile loaded: ${currentUrl}`);

  // --------------------------------------------
  // 3. HUMAN-LIKE DELAY
  // --------------------------------------------
  await humanDelay(2000, 4000);
}