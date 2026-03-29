import type { Page } from "playwright-core";
import { logger } from "../logger.js";
import { humanDelay } from "../utils.js";

function normalizeProfileUrl(profileUrl: string): string {
    return profileUrl.endsWith("/") ? profileUrl : `${profileUrl}/`;
}

function toActivityAllUrl(profileUrl: string): string {
    return `${normalizeProfileUrl(profileUrl)}recent-activity/all/`;
}

export async function likeRecentPost(
    page: Page,
    profileUrl: string,
): Promise<void> {
    const activityUrl = toActivityAllUrl(profileUrl);

    logger.step(profileUrl, "like", `Opening ${activityUrl}`);

    await page.goto(activityUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
    });
    await humanDelay(1500, 2500);

    const firstPost = page.locator('[role="article"]').first();

    try {
        await firstPost.waitFor({ state: "visible", timeout: 10000 });
    } catch {
        throw new Error("Could not find the first recent post on /recent-activity/all/");
    }

    const likeButton = firstPost
        .locator(
            [
                'button[aria-label*="React Like"]',
                'button[aria-label*="Like"]',
                'button:has-text("Like")',
            ].join(", "),
        )
        .first();

    const alreadyLiked = await likeButton
        .getAttribute("aria-pressed")
        .then((value) => value === "true")
        .catch(() => false);

    if (alreadyLiked) {
        logger.success("First recent post is already liked");
        return;
    }

    try {
        await firstPost.scrollIntoViewIfNeeded();
        await likeButton.waitFor({ state: "visible", timeout: 5000 });
        await likeButton.scrollIntoViewIfNeeded();
        await likeButton.click({ timeout: 3000 });
        await humanDelay(800, 1400);
    } catch {
        throw new Error("Could not click the Like button for the first recent post");
    }

    const liked = await likeButton
        .getAttribute("aria-pressed")
        .then((value) => value === "true")
        .catch(() => false);

    if (!liked) {
        throw new Error("Clicked Like but could not confirm the first recent post was liked");
    }

    logger.success("Liked the first recent post");
}
