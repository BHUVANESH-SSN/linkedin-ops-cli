import type { Page } from "playwright-core";
import { logger } from "../logger.js";
import { humanDelay, profileSlug } from "../utils.js";

/**
 * Navigate to a LinkedIn profile and confirm the target URL loaded.
 */
export async function viewProfile(
    page: Page,
    profileUrl: string,
): Promise<void> {
    logger.step(profileUrl, "view", "Navigating to profile...");

    await page.goto(profileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
    });

    const currentUrl = page.url();
    const expectedSlug = profileSlug(profileUrl);
    const loadedSlug = profileSlug(currentUrl);

    if (expectedSlug === loadedSlug) {
        logger.success(`Profile loaded: ${currentUrl}`);
    } else {
        throw new Error(
            `Profile navigation landed on a different URL. Expected slug: ${expectedSlug} | Current URL: ${currentUrl}`,
        );
    }

    await humanDelay(2000, 4000);
}
