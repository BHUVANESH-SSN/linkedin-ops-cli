/**
 * ============================================
 * PURPOSE
 * ============================================
 * Utility helpers for LinkedIn automation using Playwright.
 * - Simulate human-like delays
 * - Safely click elements using multiple selectors
 * - Extract profile identifier from LinkedIn URL
 *
 * ============================================
 * INPUTS / OUTPUTS
 * ============================================
 *
 * humanDelay(minMs, maxMs)
 *   → Input: min & max delay (ms)
 *   → Output: waits for random time (Promise<void>)
 *
 * tryClick(page, selectors, options)
 *   → Input: Playwright page, list of selectors, optional timeout
 *   → Output: true (clicked) | false (not found)
 *
 * profileSlug(url)
 *   → Input: LinkedIn profile URL
 *   → Output: username/slug string
 */

import type { Page } from "playwright-core";

// ============================================
// HUMAN-LIKE DELAY
// ============================================
export async function humanDelay(
  minMs: number = 1000,
  maxMs: number = 3000
): Promise<void> {
  const delay =
    Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  await new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================
// SAFE CLICK (TRY MULTIPLE SELECTORS)
// ============================================
export async function tryClick(
  page: Page,
  selectors: string[],
  options: { timeout?: number } = {}
): Promise<boolean> {
  const timeout = options.timeout ?? 5000;

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();

      await element.waitFor({
        state: "visible",
        timeout,
      });

      await element.click();
      return true;
    } catch {
      // ignore and try next selector
    }
  }

  return false;
}

// ============================================
// EXTRACT PROFILE SLUG
// ============================================
export function profileSlug(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);

  return match
    ? match[1].replace(/\/$/, "")
    : url;
}