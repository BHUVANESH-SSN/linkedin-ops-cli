import type { Locator, Page } from "playwright-core";
import { logger } from "../logger.js";
import { humanDelay, profileSlug } from "../utils.js";

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

const ACTION_ROW_SELECTORS = [
    ".pvs-profile-actions",
    ".pv-top-card-v2-ctas",
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
    '.artdeco-dropdown__content a[href*="/preload/custom-invite/"]',
    '.artdeco-dropdown__content a:has-text("Connect")',
    '.artdeco-dropdown__content [role="menuitem"]:has-text("Connect")',
    '.artdeco-dropdown__content button:has-text("Connect")',
];

const SEND_SELECTORS = [
    'button[aria-label="Send without a note"]',
    'button[aria-label="Send now"]',
    '[role="dialog"] button:has-text("Send without a note")',
    '[role="dialog"] button:has-text("Send now")',
    '[role="dialog"] button:has-text("Send")',
];

const CONNECT_CONFIRMED_SELECTORS = [
    'button:has-text("Pending")',
    'a:has-text("Pending")',
    'button[aria-label*="Pending"]',
    'button:has-text("Invitation sent")',
    'button:has-text("Invite sent")',
    'button:has-text("Message")',
    '[aria-label*="Invite"][aria-label*="sent"]',
];

const CONNECTION_TOAST_SELECTORS = [
    '[data-testid*="toast"]',
    '[data-testid="toasts-title"]',
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]',
];

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
    const inviteSlug = extractInviteSlug(details.href);
    if (inviteSlug && normalize(inviteSlug) === normalize(expectedSlug)) {
        return true;
    }

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

async function isAlreadyConnected(root: Locator): Promise<boolean> {
    for (const selector of CONNECT_CONFIRMED_SELECTORS) {
        const element = root.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
            return true;
        }
    }

    return false;
}

async function clickSendButton(page: Page): Promise<boolean> {
    for (const selector of SEND_SELECTORS) {
        const button = page.locator(selector).first();

        try {
            await button.waitFor({ state: "visible", timeout: 2500 });
            await button.click({ timeout: 3000 });
            return true;
        } catch {
            // Try the next send selector.
        }
    }

    return false;
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
    const candidates = [
        page.locator('main section[componentkey*="Topcard"]').first(),
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

async function findActionContainer(topCard: Locator): Promise<Locator> {
    for (const selector of ACTION_ROW_SELECTORS) {
        const candidate = topCard.locator(selector).first();
        if (await candidate.isVisible().catch(() => false)) {
            return candidate;
        }
    }

    return topCard;
}

async function finalizeConnection(
    page: Page,
    expectedSlug: string,
): Promise<boolean> {
    for (let attempt = 0; attempt < 8; attempt++) {
        if (await clickSendButton(page)) {
            logger.success("Connection request sent");
            await humanDelay(800, 1400);
            return true;
        }

        if (await hasConnectionToast(page)) {
            logger.success("Connection request sent");
            await humanDelay(800, 1400);
            return true;
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

        await humanDelay(700, 1200);
    }

    return false;
}

export async function connectWithProfile(
    page: Page,
    profileUrl: string,
): Promise<void> {
    const { expectedSlug, profileName } = await loadAndVerifyProfile(page, profileUrl);
    const topCard = await findTopCard(page, expectedSlug);
    const actionContainer = await findActionContainer(topCard);

    logger.step(
        profileUrl,
        "connect",
        "Searching the profile top-card action row for an invite pattern",
    );

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

    const directInviteMatch = await findVisibleMatch(
        actionContainer,
        DIRECT_INVITE_SELECTORS,
        3000,
        (details) => matchesLoadedProfile(details, expectedSlug, profileName),
    );

    if (directInviteMatch) {
        logMatch("Direct invite-based Connect matched the loaded profile", directInviteMatch);

        if (!(await clickMatch(directInviteMatch, 4000))) {
            throw new Error("Found the direct invite Connect control, but it could not be clicked");
        }

        logger.step(profileUrl, "connect", "Clicked direct invite-based Connect");
        await humanDelay(800, 1400);

        if (await finalizeConnection(page, expectedSlug)) {
            return;
        }

        throw new Error("Clicked Connect but could not confirm that the invitation was sent");
    }

    logger.warn(
        `No direct invite control matched vanityName=${expectedSlug} in the top-card action row`,
    );

    const directConnectMatch = await findVisibleMatch(
        actionContainer,
        DIRECT_CONNECT_SELECTORS,
        3000,
    );

    if (directConnectMatch) {
        logMatch("Fallback direct Connect found in the loaded profile top card", directConnectMatch);

        if (!(await clickMatch(directConnectMatch, 4000))) {
            throw new Error("Found the direct Connect control, but it could not be clicked");
        }

        logger.step(profileUrl, "connect", "Clicked direct Connect button");
        await humanDelay(800, 1400);

        if (await finalizeConnection(page, expectedSlug)) {
            return;
        }

        throw new Error("Clicked Connect but could not confirm that the invitation was sent");
    }

    logger.step(profileUrl, "connect", "Direct Connect not found, checking More in the same top-card action row");

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

    const dropdownConnectMatch = await findVisibleMatch(
        page.locator('[role="menu"], .artdeco-dropdown__content').first(),
        DROPDOWN_CONNECT_SELECTORS,
        3000,
    );

    if (!dropdownConnectMatch) {
        throw new Error("Opened More but could not find Connect inside it");
    }

    logMatch("Connect found inside More", dropdownConnectMatch);

    if (!(await clickMatch(dropdownConnectMatch, 3000))) {
        throw new Error("Found Connect inside More, but it could not be clicked");
    }

    logger.step(profileUrl, "connect", "Clicked Connect inside More");
    await humanDelay(800, 1400);

    if (await finalizeConnection(page, expectedSlug)) {
        return;
    }

    throw new Error("Clicked Connect but could not confirm that the invitation was sent");
}
