/**
 * ============================================
 * PURPOSE
 * ============================================
 * Sends a LinkedIn connection request from the
 * currently loaded target profile.
 *
 * The logic is intentionally defensive because
 * LinkedIn can render Connect in multiple ways:
 * - Direct Connect button in the top card
 * - Invite link with vanityName in the href
 * - More menu when the profile shows Follow
 *
 * This file always tries to stay scoped to the
 * loaded profile's top card so it does not click
 * sidebar or recommendation widgets by mistake.
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * connectWithProfile(page, profileUrl)
 *   → Input: Playwright Page + LinkedIn profile URL
 *   → Output: Sends a connection request if possible
 */

import type { Locator, Page } from "playwright-core";
import { logger } from "../logger.js";
import { humanDelay, profileSlug } from "../utils.js";

// ============================================
// SELECTOR GROUPS
// ============================================

const DIRECT_INVITE_SELECTORS = [
    'a[href*="/preload/custom-invite/"][aria-label*="Invite"][aria-label*="connect"]',
    'button[aria-label*="Invite"][aria-label*="connect"]',
];

const DIRECT_CONNECT_SELECTORS = [
    ...DIRECT_INVITE_SELECTORS,
    'a[aria-label*="Connect"]',
    'a:has-text("Connect")',
    'button[aria-label*="Connect"]',
    'button:has-text("Connect")',
];

const FOLLOW_BUTTON_SELECTORS = [
    'button[aria-label*="Follow"]',
    'button:has-text("Follow")',
    'a[aria-label*="Follow"]',
    'a:has-text("Follow")',
];

const MESSAGE_BUTTON_SELECTORS = [
    'a[href*="/messaging/compose/"]',
    'a:has-text("Message")',
    'button:has-text("Message")',
];

// The top-card action row is the safe zone for Connect / More / Message.
const ACTION_ROW_SELECTORS = [
    ".pvs-profile-actions",
    ".pv-top-card-v2-ctas",
    'div:has(button[aria-label*="Follow"]):has(button[aria-label*="More actions"])',
    'div:has(button[aria-label*="Follow"]):has(button:has-text("More"))',
    'div:has(button:has-text("Follow")):has(button[aria-label*="More actions"])',
    'div:has(button:has-text("Follow")):has(button:has-text("More"))',
    'div:has(a[aria-label*="Message"]):has(button[aria-label*="More actions"])',
    'div:has(a:has-text("Message")):has(button:has-text("More"))',
    'div:has(> a[href*="/preload/custom-invite/"])',
    'div:has(> button[aria-label*="Invite"][aria-label*="connect"])',
    'div:has(> a:has-text("Connect"))',
    'div:has(> button:has-text("Connect"))',
    'div:has(> a:has-text("Message"))',
    'div:has(> button:has-text("Message"))',
    'div:has(> button[aria-label="More actions"])',
    'div:has(> button:has-text("More"))',
];

const MORE_BUTTON_SELECTORS = [
    'button[aria-label="More actions"]',
    'button[aria-label*="More actions"]',
    'button:has-text("More")',
];

const DROPDOWN_CONNECT_SELECTORS = [
    '[role="menu"] a[href*="/preload/custom-invite/"]',
    '[role="menu"] a:has-text("Connect")',
    '[role="menu"] [role="menuitem"]:has-text("Connect")',
    '[role="menu"] button:has-text("Connect")',
    '[role="menu"] div[role="button"]:has-text("Connect")',
    '.artdeco-dropdown__content a[href*="/preload/custom-invite/"]',
    '.artdeco-dropdown__content a:has-text("Connect")',
    '.artdeco-dropdown__content [role="menuitem"]:has-text("Connect")',
    '.artdeco-dropdown__content button:has-text("Connect")',
    '.artdeco-dropdown__content div[role="button"]:has-text("Connect")',
    '[data-test-artdeco-dropdown-content-inner] a[href*="/preload/custom-invite/"]',
    '[data-test-artdeco-dropdown-content-inner] a:has-text("Connect")',
    '[data-test-artdeco-dropdown-content-inner] button:has-text("Connect")',
    '[data-test-artdeco-dropdown-content-inner] [role="menuitem"]:has-text("Connect")',
    '[data-test-artdeco-dropdown-content-inner] div[role="button"]:has-text("Connect")',
];

const MENU_CONNECT_LABEL_SELECTORS = [
    'p:has-text("Connect")',
    'span:has-text("Connect")',
    'div:has-text("Connect")',
];

const PAGE_CONNECT_FALLBACK_SELECTORS = [
    'a[href*="/preload/custom-invite/"]',
    'a:has-text("Connect")',
    'button:has-text("Connect")',
    '[role="menuitem"]:has-text("Connect")',
    'div[role="button"]:has-text("Connect")',
];

const SEND_SELECTORS = [
    'button[aria-label="Send without a note"]',
    'button[aria-label*="Send without a note"]',
    'button[aria-label="Send now"]',
    'button[aria-label*="Send now"]',
    'button:has-text("Send without a note")',
    'button:has-text("Send now")',
    '[role="dialog"] button:has-text("Send without a note")',
    '[role="dialog"] button:has-text("Send now")',
    '[role="dialog"] button:has-text("Send")',
];

const INVITE_PAGE_SEND_SELECTORS = [
    'main button[aria-label*="Send without a note"]',
    'main button[aria-label*="Send now"]',
    'main button:has-text("Send without a note")',
    'main button:has-text("Send now")',
    'main button:has-text("Send")',
    'form button[aria-label*="Send without a note"]',
    'form button[aria-label*="Send now"]',
    'form button:has-text("Send without a note")',
    'form button:has-text("Send now")',
    'form button:has-text("Send")',
];

const CONNECT_CONFIRMED_SELECTORS = [
    'button:has-text("Pending")',
    'a:has-text("Pending")',
    'button[aria-label*="Pending"]',
    'button:has-text("Invitation sent")',
    'button:has-text("Invite sent")',
    '[aria-label*="Invite"][aria-label*="sent"]',
];

const CONNECTION_TOAST_SELECTORS = [
    '[data-testid*="toast"]',
    '[data-testid="toasts-title"]',
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]',
];

// ============================================
// TYPES
// ============================================

type ElementDetails = {
    tagName: string;
    text: string;
    ariaLabel: string | null;
    href: string | null;
    componentKey: string | null;
    headingText: string | null;
};

type Match = {
    locator: Locator;
    selector: string;
    details: ElementDetails;
};

type ElementBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

// ============================================
// NORMALIZATION / MATCHING HELPERS
// ============================================

function normalize(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function extractInviteSlug(href: string | null): string | null {
    if (!href) {
        return null;
    }

    try {
        const url = new URL(href, "https://www.linkedin.com");
        return url.searchParams.get("vanityName");
    } catch {
        return null;
    }
}

function matchesLoadedProfile(
    details: ElementDetails,
    expectedSlug: string,
    profileName: string | null,
): boolean {
    // The strongest ownership signal is vanityName in the invite URL.
    const inviteSlug = extractInviteSlug(details.href);
    if (inviteSlug && normalize(inviteSlug) === normalize(expectedSlug)) {
        return true;
    }

    // Fall back to aria-label text when LinkedIn renders a button instead of a link.
    const ariaLabel = normalize(details.ariaLabel);
    if (ariaLabel.includes("invite") && ariaLabel.includes("connect")) {
        if (profileName && ariaLabel.includes(normalize(profileName))) {
            return true;
        }

        if (ariaLabel.includes(normalize(expectedSlug.replace(/-/g, " ")))) {
            return true;
        }
    }

    return false;
}

// ============================================
// ELEMENT INSPECTION HELPERS
// ============================================

async function describeElement(locator: Locator): Promise<ElementDetails> {
    return locator.evaluate((element) => {
        const htmlElement = element as HTMLElement;
        const text = (htmlElement.innerText || htmlElement.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
        const componentRoot = htmlElement.closest("[componentkey]");
        const sectionRoot = htmlElement.closest("section, aside, div");
        const heading = sectionRoot?.querySelector("h1, h2, h3");

        return {
            tagName: element.tagName.toLowerCase(),
            text,
            ariaLabel: htmlElement.getAttribute("aria-label"),
            href:
                element instanceof HTMLAnchorElement
                    ? element.getAttribute("href")
                    : null,
            componentKey: componentRoot?.getAttribute("componentkey") || null,
            headingText:
                (heading?.textContent || "").replace(/\s+/g, " ").trim() || null,
        };
    });
}

function logMatch(label: string, match: Match): void {
    logger.success(label);
    logger.info(`Selector matched: ${match.selector}`);
    logger.info(
        `Match details: tag=${match.details.tagName} | text="${match.details.text || "-"}" | aria-label="${match.details.ariaLabel || "-"}" | href="${match.details.href || "-"}" | heading="${match.details.headingText || "-"}" | componentkey="${match.details.componentKey || "-"}"`,
    );
}

// ============================================
// GENERIC LOCATOR HELPERS
// ============================================

async function findVisibleMatch(
    root: Locator,
    selectors: string[],
    timeout: number,
    matcher?: (details: ElementDetails) => boolean,
): Promise<Match | null> {
    for (const selector of selectors) {
        const matches = root.locator(selector);
        const count = Math.min(await matches.count(), 8);

        for (let i = 0; i < count; i++) {
            const candidate = matches.nth(i);

            try {
                await candidate.waitFor({ state: "visible", timeout });
                await candidate.scrollIntoViewIfNeeded();
                const details = await describeElement(candidate);

                if (!matcher || matcher(details)) {
                    return { locator: candidate, selector, details };
                }
            } catch {
                // Try the next visible candidate.
            }
        }
    }

    return null;
}

async function hasVisibleMatch(
    root: Locator,
    selectors: string[],
    timeout: number,
): Promise<Match | null> {
    return findVisibleMatch(root, selectors, timeout);
}

async function hasVisibleControl(root: Locator, selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
        const element = root.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
            return true;
        }
    }

    return false;
}

async function clickMatch(match: Match, timeout: number): Promise<boolean> {
    try {
        await match.locator.click({ timeout });
        return true;
    } catch {
        try {
            await match.locator.click({ timeout, force: true });
            return true;
        } catch {
            return false;
        }
    }
}

function hasInviteHref(match: Match): boolean {
    return normalize(match.details.href).includes("/preload/custom-invite/");
}

function buildInviteUrl(vanityName: string): string {
    const inviteUrl = new URL("https://www.linkedin.com/preload/custom-invite/");
    inviteUrl.searchParams.set("vanityName", vanityName);
    return inviteUrl.toString();
}

function isCustomInvitePage(page: Page): boolean {
    return page.url().includes("/preload/custom-invite/");
}

async function hasVisibleSendButton(page: Page): Promise<boolean> {
    for (const selector of SEND_SELECTORS) {
        const button = page.locator(selector).first();
        if (await button.isVisible().catch(() => false)) {
            return true;
        }
    }

    if (!isCustomInvitePage(page)) {
        return false;
    }

    for (const selector of INVITE_PAGE_SEND_SELECTORS) {
        const button = page.locator(selector).first();
        if (await button.isVisible().catch(() => false)) {
            return true;
        }
    }

    return false;
}

async function waitForConnectFlowStart(page: Page, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await hasVisibleSendButton(page)) {
            return true;
        }

        if (await hasPendingConnectDialog(page)) {
            return true;
        }

        if (await hasConnectionToast(page)) {
            return true;
        }

        if (isCustomInvitePage(page)) {
            return true;
        }

        await humanDelay(250, 450);
    }

    return false;
}

async function waitForInviteReadyState(page: Page, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await hasVisibleSendButton(page)) {
            return true;
        }

        if (await hasPendingConnectDialog(page)) {
            return true;
        }

        if (await hasConnectionToast(page)) {
            return true;
        }

        await humanDelay(250, 450);
    }

    return false;
}

async function openInviteHref(page: Page, match: Match): Promise<boolean> {
    if (!match.details.href) {
        return false;
    }

    try {
        const inviteUrl = new URL(
            match.details.href,
            "https://www.linkedin.com",
        ).toString();

        logger.info(`Falling back to opening invite href directly: ${inviteUrl}`);
        await page.goto(inviteUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await humanDelay(700, 1100);

        return waitForInviteReadyState(page, 6000);
    } catch {
        return false;
    }
}

async function activateConnectMatch(
    page: Page,
    match: Match,
    timeout: number,
): Promise<boolean> {
    if (await clickMatch(match, timeout)) {
        if (await waitForConnectFlowStart(page, 5000)) {
            return true;
        }
    }

    try {
        await match.locator.evaluate((element) => {
            (element as HTMLElement).click();
        });
        if (await waitForConnectFlowStart(page, 5000)) {
            return true;
        }
    } catch {
        // Try direct navigation when LinkedIn renders a non-interactable anchor.
    }

    // Only force the invite route as a last resort. Opening it up front can
    // bypass LinkedIn's normal modal flow and strand the automation on a page
    // that still needs an extra send click.
    if (hasInviteHref(match) && (await openInviteHref(page, match))) {
        return true;
    }

    return false;
}

async function isAlreadyConnected(root: Locator): Promise<boolean> {
    for (const selector of CONNECT_CONFIRMED_SELECTORS) {
        const element = root.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
            return true;
        }
    }

    return false;
}

async function findConnectMatchFromLabel(root: Locator, timeout: number): Promise<Match | null> {
    for (const selector of MENU_CONNECT_LABEL_SELECTORS) {
        const labels = root.locator(selector);
        const count = Math.min(await labels.count().catch(() => 0), 8);

        for (let i = 0; i < count; i++) {
            const label = labels.nth(i);

            try {
                await label.waitFor({ state: "visible", timeout });

                const text = normalize(await label.textContent().catch(() => null));
                if (text !== "connect") {
                    continue;
                }

                const clickableAncestor = label.locator(
                    'xpath=ancestor-or-self::*[(self::a or self::button or @role="menuitem" or @role="button" or @tabindex)][1]',
                );

                await clickableAncestor.waitFor({ state: "visible", timeout });
                const details = await describeElement(clickableAncestor);

                return {
                    locator: clickableAncestor,
                    selector: `${selector} -> clickable ancestor`,
                    details,
                };
            } catch {
                // Try the next visible Connect label.
            }
        }
    }

    return null;
}

function distanceFromBox(
    anchor: ElementBox,
    candidate: ElementBox,
): number {
    const anchorCenterX = anchor.x + anchor.width / 2;
    const anchorCenterY = anchor.y + anchor.height / 2;
    const candidateCenterX = candidate.x + candidate.width / 2;
    const candidateCenterY = candidate.y + candidate.height / 2;

    return Math.hypot(anchorCenterX - candidateCenterX, anchorCenterY - candidateCenterY);
}

// ============================================
// CONNECTION CONFIRMATION HELPERS
// ============================================

async function clickSendButton(page: Page): Promise<boolean> {
    const selectors = isCustomInvitePage(page)
        ? [...SEND_SELECTORS, ...INVITE_PAGE_SEND_SELECTORS]
        : SEND_SELECTORS;

    for (const selector of selectors) {
        const button = page.locator(selector).first();

        try {
            await button.waitFor({ state: "visible", timeout: 5000 });
            await button.click({ timeout: 5000 });
            return true;
        } catch {
            try {
                await button.click({ timeout: 5000, force: true });
                return true;
            } catch {
                try {
                    await button.evaluate((element) => {
                        (element as HTMLElement).click();
                    });
                    return true;
                } catch {
                    // Try the next send selector.
                }
            }
        }
    }

    return false;
}

async function hasPendingConnectDialog(page: Page): Promise<boolean> {
    const dialog = page.locator(
        [
            '[role="dialog"]:has-text("Send without a note")',
            '[role="dialog"]:has-text("Add a note")',
            '[role="dialog"]:has-text("Connect")',
        ].join(", "),
    ).first();

    return dialog.isVisible().catch(() => false);
}

async function hasConnectionToast(page: Page): Promise<boolean> {
    const textHints = [
        /connection request sent/i,
        /invitation sent/i,
        /connect request sent/i,
    ];

    for (const selector of CONNECTION_TOAST_SELECTORS) {
        const nodes = page.locator(selector);
        const count = Math.min(await nodes.count().catch(() => 0), 6);

        for (let i = 0; i < count; i++) {
            const node = nodes.nth(i);

            try {
                if (!(await node.isVisible())) {
                    continue;
                }

                const text = normalize(await node.textContent());
                if (textHints.some((pattern) => pattern.test(text))) {
                    return true;
                }
            } catch {
                // Keep scanning visible toast-like containers.
            }
        }
    }

    for (const pattern of textHints) {
        const textNode = page.getByText(pattern).first();
        if (await textNode.isVisible().catch(() => false)) {
            return true;
        }
    }

    return false;
}

// ============================================
// PROFILE SCOPING HELPERS
// ============================================

async function loadAndVerifyProfile(
    page: Page,
    profileUrl: string,
): Promise<{ expectedSlug: string; profileName: string | null }> {
    logger.step(profileUrl, "connect", "Loading target profile URL");

    await page.goto(profileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
    });
    await humanDelay(1500, 2500);

    const currentUrl = page.url();
    const expectedSlug = profileSlug(profileUrl);
    const loadedSlug = profileSlug(currentUrl);

    if (expectedSlug !== loadedSlug) {
        throw new Error(
            `Profile navigation landed on a different URL. Expected slug: ${expectedSlug} | Current URL: ${currentUrl}`,
        );
    }

    logger.success(`Profile loaded: ${currentUrl}`);

    const profileName = await page
        .locator("main h1")
        .first()
        .textContent()
        .then((value) => value?.trim() || null)
        .catch(() => null);

    if (profileName) {
        logger.info(`Loaded profile name: ${profileName}`);
    }

    return { expectedSlug, profileName };
}

async function findTopCard(page: Page, expectedSlug: string): Promise<Locator> {
    // The "without connect" sample shows that some profiles expose the main card
    // through contact-info and connections metadata before invite links exist.
    const candidates = [
        page.locator('main section[componentkey*="Topcard"]').first(),
        page.locator(
            `main section:has(a[href*="/in/${expectedSlug}/overlay/contact-info/"])`,
        ).first(),
        page.locator(
            `main section:has(a[href*="/in/${expectedSlug}/"]):has-text("connections")`,
        ).first(),
        page.locator(
            'main section:has(a[href*="/overlay/contact-info/"]):has-text("connections")',
        ).first(),
        page.locator(`main section:has(a[href*="vanityName=${expectedSlug}"])`).first(),
        page.locator("main section").filter({ has: page.locator("main h1") }).first(),
    ];

    for (const candidate of candidates) {
        if (await candidate.isVisible().catch(() => false)) {
            return candidate;
        }
    }

    const h1 = page.locator("main h1").first();
    await h1.waitFor({ state: "visible", timeout: 8000 });

    const sectionAncestor = h1.locator("xpath=ancestor::section[1]");
    if (await sectionAncestor.isVisible().catch(() => false)) {
        return sectionAncestor;
    }

    throw new Error("Could not find the main profile top card");
}

async function scoreActionContainer(candidate: Locator): Promise<{
    score: number;
    y: number;
}> {
    let score = 0;

    if (await hasVisibleControl(candidate, DIRECT_INVITE_SELECTORS)) {
        score += 50;
    }

    if (await hasVisibleControl(candidate, DIRECT_CONNECT_SELECTORS)) {
        score += 30;
    }

    if (await hasVisibleControl(candidate, MESSAGE_BUTTON_SELECTORS)) {
        score += 20;
    }

    if (await hasVisibleControl(candidate, FOLLOW_BUTTON_SELECTORS)) {
        score += 20;
    }

    if (await hasVisibleControl(candidate, MORE_BUTTON_SELECTORS)) {
        score += 20;
    }

    const text = normalize(await candidate.textContent().catch(() => null));
    if (text.includes("connect")) {
        score += 10;
    }
    if (text.includes("message")) {
        score += 10;
    }
    if (text.includes("follow")) {
        score += 10;
    }
    if (text.includes("more")) {
        score += 10;
    }

    const box = await candidate.boundingBox().catch(() => null);
    return { score, y: box?.y ?? 0 };
}

async function findActionContainer(topCard: Locator): Promise<Locator> {
    // Some profiles render multiple CTA clusters. Prefer the richest visible row
    // and, on ties, the lower one that sits beneath the profile connections text.
    let bestCandidate: Locator | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestY = Number.NEGATIVE_INFINITY;

    for (const selector of ACTION_ROW_SELECTORS) {
        const matches = topCard.locator(selector);
        const count = Math.min(await matches.count().catch(() => 0), 8);

        for (let i = 0; i < count; i++) {
            const candidate = matches.nth(i);
            if (!(await candidate.isVisible().catch(() => false))) {
                continue;
            }

            const { score, y } = await scoreActionContainer(candidate);
            if (score > bestScore || (score === bestScore && y > bestY)) {
                bestCandidate = candidate;
                bestScore = score;
                bestY = y;
            }
        }
    }

    if (bestCandidate) {
        return bestCandidate;
    }

    return topCard;
}

async function finalizeConnection(
    page: Page,
    profileUrl: string,
    expectedSlug: string,
): Promise<boolean> {
    let sendClicked = false;
    let returnedToProfile = false;

    for (let attempt = 0; attempt < 12; attempt++) {
        if (await clickSendButton(page)) {
            sendClicked = true;
            logger.info("Clicked 'Send without a note'. Waiting for LinkedIn to confirm the invitation...");
            await humanDelay(900, 1400);
        }

        if (await hasPendingConnectDialog(page)) {
            // The connect dialog is open but LinkedIn has not made the final
            // send button clickable yet. Keep waiting instead of misclassifying
            // the profile as already connected.
            logger.info("Connect dialog is still open. Waiting for the final send state...");
            await humanDelay(700, 1200);
            continue;
        }

        if (await hasConnectionToast(page)) {
            logger.success("Connection request sent");
            await humanDelay(800, 1400);
            return true;
        }

        if (
            sendClicked &&
            !returnedToProfile &&
            isCustomInvitePage(page)
        ) {
            logger.info(
                "LinkedIn stayed on the invite page after submit. Returning to the profile page to verify the final state...",
            );

            try {
                await page.goto(profileUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: 30000,
                });
                await humanDelay(1400, 2200);
                returnedToProfile = true;
            } catch {
                // If navigation back fails, continue with the remaining confirmation checks.
            }
        }

        try {
            const refreshedTopCard = await findTopCard(page, expectedSlug);
            const refreshedActionContainer = await findActionContainer(refreshedTopCard);

            if (await isAlreadyConnected(refreshedActionContainer)) {
                logger.success("Connection confirmed (no modal required)");
                await humanDelay(800, 1400);
                return true;
            }
        } catch {
            // If the page is still mid-refresh, keep polling.
        }

        if (sendClicked) {
            logger.info("Invite submit was triggered, but LinkedIn has not confirmed it yet. Rechecking...");
        }

        await humanDelay(700, 1200);
    }

    return false;
}

async function tryDirectInviteBeforeProfileControls(
    page: Page,
    profileUrl: string,
    expectedSlug: string,
): Promise<boolean> {
    const inviteUrl = buildInviteUrl(expectedSlug);

    logger.step(
        profileUrl,
        "connect",
        `Trying direct invite URL first: ${inviteUrl}`,
    );

    try {
        await page.goto(inviteUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await humanDelay(700, 1100);
    } catch {
        logger.warn(`Could not open direct invite URL for vanityName=${expectedSlug}`);
        return false;
    }

    if (!(await waitForInviteReadyState(page, 6000))) {
        logger.warn(
            `Direct invite URL opened, but LinkedIn did not expose a send action for vanityName=${expectedSlug}`,
        );

        try {
            await page.goto(profileUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            await humanDelay(1400, 2200);
        } catch {
            // If returning to the profile fails, the caller will surface the next failure.
        }

        return false;
    }

    if (await finalizeConnection(page, profileUrl, expectedSlug)) {
        logger.success("Connection completed through the direct invite URL");
        return true;
    }

    logger.warn("Direct invite URL did not confirm the connection. Falling back to profile controls.");

    try {
        await page.goto(profileUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await humanDelay(1400, 2200);
    } catch {
        // If returning to the profile fails, the caller will surface the next failure.
    }

    return false;
}

async function findDropdownConnectMatch(
    page: Page,
    expectedSlug: string,
    profileName: string | null,
    anchorBox?: ElementBox | null,
): Promise<Match | null> {
    const dropdownRoots = page.locator(
        '[role="menu"], .artdeco-dropdown__content, [data-test-artdeco-dropdown-content-inner]',
    );
    const rootCount = Math.min(await dropdownRoots.count().catch(() => 0), 5);

    for (let i = 0; i < rootCount; i++) {
        const root = dropdownRoots.nth(i);

        if (!(await root.isVisible().catch(() => false))) {
            continue;
        }

        const labelMatch = await findConnectMatchFromLabel(root, 2500);
        if (labelMatch) {
            return labelMatch;
        }

        const match = await findVisibleMatch(
            root,
            DROPDOWN_CONNECT_SELECTORS,
            2500,
            (details) => {
                if (matchesLoadedProfile(details, expectedSlug, profileName)) {
                    return true;
                }

                const text = normalize(details.text);
                const ariaLabel = normalize(details.ariaLabel);

                return (
                    text === "connect" ||
                    text.startsWith("connect ") ||
                    ariaLabel === "connect" ||
                    ariaLabel.startsWith("connect ")
                );
            },
        );

        if (match) {
            return match;
        }
    }

    if (!anchorBox) {
        return null;
    }

    // Some LinkedIn menu variants render outside standard menu containers.
    // In that case, choose the closest visible Connect candidate to the More button.
    let bestMatch: Match | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const selector of PAGE_CONNECT_FALLBACK_SELECTORS) {
        const candidates = page.locator(selector);
        const count = Math.min(await candidates.count().catch(() => 0), 12);

        for (let i = 0; i < count; i++) {
            const candidate = candidates.nth(i);

            try {
                await candidate.waitFor({ state: "visible", timeout: 1200 });
                const details = await describeElement(candidate);

                const text = normalize(details.text);
                const ariaLabel = normalize(details.ariaLabel);
                const isConnectPattern =
                    matchesLoadedProfile(details, expectedSlug, profileName) ||
                    text === "connect" ||
                    text.startsWith("connect ") ||
                    ariaLabel === "connect" ||
                    ariaLabel.startsWith("connect ");

                if (!isConnectPattern) {
                    continue;
                }

                const box = await candidate.boundingBox();
                if (!box) {
                    continue;
                }

                const candidateDistance = distanceFromBox(anchorBox, box);
                if (candidateDistance < bestDistance) {
                    bestDistance = candidateDistance;
                    bestMatch = { locator: candidate, selector, details };
                }
            } catch {
                // Keep scanning visible connect candidates near the More button.
            }
        }
    }

    return bestMatch;
}

// ============================================
// MAIN ACTION
// ============================================

export async function connectWithProfile(
    page: Page,
    profileUrl: string,
): Promise<void> {
    // --------------------------------------------
    // 1. LOAD AND VERIFY TARGET PROFILE
    // --------------------------------------------
    const { expectedSlug, profileName } = await loadAndVerifyProfile(page, profileUrl);
    if (await tryDirectInviteBeforeProfileControls(page, profileUrl, expectedSlug)) {
        return;
    }

    const topCard = await findTopCard(page, expectedSlug);
    const actionContainer = await findActionContainer(topCard);

    logger.step(
        profileUrl,
        "connect",
        "Searching the profile top-card action row for an invite pattern",
    );

    // --------------------------------------------
    // 2. EARLY EXIT IF ALREADY CONNECTED
    // --------------------------------------------
    if (await isAlreadyConnected(actionContainer)) {
        const ownedInvite = await findVisibleMatch(
            actionContainer,
            DIRECT_INVITE_SELECTORS,
            1200,
            (details) => matchesLoadedProfile(details, expectedSlug, profileName),
        );

        if (!ownedInvite) {
            logger.success("Connection already confirmed on profile page");
            return;
        }
    }

    // --------------------------------------------
    // 3. PREFER THE PROFILE'S OWN DIRECT INVITE LINK
    // --------------------------------------------
    const directInviteMatch = await findVisibleMatch(
        actionContainer,
        DIRECT_INVITE_SELECTORS,
        3000,
        (details) => matchesLoadedProfile(details, expectedSlug, profileName),
    );

    if (directInviteMatch) {
        logMatch("Direct invite-based Connect matched the loaded profile", directInviteMatch);

        if (!(await activateConnectMatch(page, directInviteMatch, 4000))) {
            throw new Error("Found the direct invite Connect control, but it could not be clicked");
        }

        logger.step(profileUrl, "connect", "Clicked direct invite-based Connect");
        await humanDelay(800, 1400);

        if (await finalizeConnection(page, profileUrl, expectedSlug)) {
            return;
        }

        throw new Error("Clicked Connect but could not confirm that the invitation was sent");
    }

    logger.warn(
        `No direct invite control matched vanityName=${expectedSlug} in the top-card action row`,
    );

    // --------------------------------------------
    // 4. FALL BACK TO A DIRECT CONNECT BUTTON
    // --------------------------------------------
    const directConnectMatch = await findVisibleMatch(
        actionContainer,
        DIRECT_CONNECT_SELECTORS,
        3000,
    );

    if (directConnectMatch) {
        logMatch("Fallback direct Connect found in the loaded profile top card", directConnectMatch);

        if (!(await activateConnectMatch(page, directConnectMatch, 4000))) {
            throw new Error("Found the direct Connect control, but it could not be clicked");
        }

        logger.step(profileUrl, "connect", "Clicked direct Connect button");
        await humanDelay(800, 1400);

        if (await finalizeConnection(page, profileUrl, expectedSlug)) {
            return;
        }

        throw new Error("Clicked Connect but could not confirm that the invitation was sent");
    }

    // --------------------------------------------
    // 5. FINAL FALLBACK: MORE -> CONNECT
    // --------------------------------------------
    logger.step(
        profileUrl,
        "connect",
        "Direct Connect not found, checking More in the same top-card action row",
    );

    const followMatch = await hasVisibleMatch(
        actionContainer,
        FOLLOW_BUTTON_SELECTORS,
        1200,
    );
    if (followMatch) {
        logger.info(
            `Top-card action row shows Follow: text="${followMatch.details.text || "-"}" | aria-label="${followMatch.details.ariaLabel || "-"}"`,
        );
        logger.step(
            profileUrl,
            "connect",
            "Profile shows Follow without a direct Connect button, so opening More in the same top-card action row",
        );
    }

    const moreMatch = await findVisibleMatch(
        actionContainer,
        MORE_BUTTON_SELECTORS,
        3000,
    );

    if (!moreMatch) {
        throw new Error("Could not find Connect or More in the loaded profile top-card action row");
    }

    logger.info(
        `More matched: text="${moreMatch.details.text || "-"}" | aria-label="${moreMatch.details.ariaLabel || "-"}"`,
    );

    if (!(await clickMatch(moreMatch, 3000))) {
        throw new Error("Found More in the top-card action row, but it could not be clicked");
    }

    await humanDelay(800, 1400);
    const moreBox = await moreMatch.locator.boundingBox().catch(() => null);

    const dropdownConnectMatch = await findDropdownConnectMatch(
        page,
        expectedSlug,
        profileName,
        moreBox,
    );

    if (!dropdownConnectMatch) {
        throw new Error("Opened More but could not find Connect inside it");
    }

    logMatch("Connect found inside More", dropdownConnectMatch);

    if (!(await activateConnectMatch(page, dropdownConnectMatch, 3000))) {
        throw new Error("Found Connect inside More, but it could not be clicked");
    }

    logger.step(profileUrl, "connect", "Clicked Connect inside More");
    await humanDelay(800, 1400);

    if (await finalizeConnection(page, profileUrl, expectedSlug)) {
        return;
    }

    throw new Error("Clicked Connect but could not confirm that the invitation was sent");
}
