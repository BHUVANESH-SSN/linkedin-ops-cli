/**
 * ============================================
 * PURPOSE
 * ============================================
 * Handles Browserbase + Playwright integration.
 *
 * - Creates and manages Browserbase sessions
 * - Persists authentication using contexts
 * - Ensures LinkedIn login state
 * - Handles login + verification flows
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * getOrCreateContext(config)
 *   → Input: Config
 *   → Output: contextId (string)
 *
 * createBrowserSession(config, contextId)
 *   → Input: Config, contextId
 *   → Output: { browser, page, sessionId }
 *
 * ensureAuthenticated(page, config)
 *   → Input: Playwright page + Config
 *   → Output: Ensures logged-in state
 *
 * closeBrowser(browser)
 *   → Input: Browser instance
 *   → Output: Closes session safely
 */

import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright-core";
import type { Config } from "./config.js";
import { logger } from "./logger.js";
import { humanDelay } from "./utils.js";

// ============================================
// SINGLETON CLIENT
// ============================================
let bbClient: Browserbase | null = null;
const CONTEXT_STATE_PATH = resolve(
  process.cwd(),
  "browserbase-context.json"
);

function getClient(config: Config): Browserbase {
  if (!bbClient) {
    bbClient = new Browserbase({
      apiKey: config.browserbaseApiKey,
    });
  }
  return bbClient;
}

async function readSavedContextId(): Promise<string | null> {
  try {
    const raw = await readFile(CONTEXT_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as {
      contextId?: string;
    };
    const contextId = parsed.contextId?.trim();

    return contextId || null;
  } catch {
    return null;
  }
}

async function persistContextId(
  contextId: string
): Promise<void> {
  try {
    await writeFile(
      CONTEXT_STATE_PATH,
      JSON.stringify({ contextId }, null, 2),
      "utf8"
    );
    logger.info(
      `Saved reusable Browserbase context to ${CONTEXT_STATE_PATH}`
    );
  } catch {
    logger.warn(
      "Created a Browserbase context, but could not save it locally"
    );
  }
}

// ============================================
// CONTEXT MANAGEMENT
// ============================================
export async function getOrCreateContext(
  config: Config
): Promise<string> {
  // Reuse existing context if provided
  if (config.browserbaseContextId) {
    logger.info(
      `Reusing context: ${config.browserbaseContextId}`
    );
    await persistContextId(config.browserbaseContextId);
    return config.browserbaseContextId;
  }

  const savedContextId = await readSavedContextId();

  if (savedContextId) {
    logger.info(
      `Reusing saved context: ${savedContextId}`
    );
    return savedContextId;
  }

  // Create new context
  const client = getClient(config);

  const context = await client.contexts.create({
    projectId: config.browserbaseProjectId,
  });

  logger.info(`Created context: ${context.id}`);
  await persistContextId(context.id);
  logger.info(
    `Optional override in .env → BROWSERBASE_CONTEXT_ID=${context.id}`
  );

  return context.id;
}

// ============================================
// CREATE SESSION
// ============================================
export async function createBrowserSession(
  config: Config,
  contextId: string
): Promise<{ browser: Browser; page: Page; sessionId: string }> {
  const client = getClient(config);

  const session = await client.sessions.create({
    projectId: config.browserbaseProjectId,
    browserSettings: {
      context: {
        id: contextId,
        persist: true,
      },
    },
  });

  logger.info(`Session created: ${session.id}`);

  // Connect Playwright
  const browser = await chromium.connectOverCDP(
    session.connectUrl
  );

  const defaultContext = browser.contexts()[0];
  const page =
    defaultContext.pages()[0] ||
    (await defaultContext.newPage());

  return {
    browser,
    page,
    sessionId: session.id,
  };
}

// ============================================
// AUTHENTICATION HANDLER
// ============================================
export async function ensureAuthenticated(
  page: Page,
  config: Config
): Promise<void> {
  logger.info("Checking LinkedIn login...");

  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await humanDelay(2000, 4000);

  const url = page.url();

  // Already logged in
  if (
    url.includes("/feed") &&
    !url.includes("/login") &&
    !url.includes("/authwall")
  ) {
    logger.success("Already logged in");
    return;
  }

  // ============================================
  // LOGIN FLOW
  // ============================================
  logger.info("Logging into LinkedIn...");

  await page.goto("https://www.linkedin.com/login");
  await humanDelay(1000, 2000);

  await page.fill("#username", config.linkedinEmail);
  await humanDelay(500, 1000);

  await page.fill("#password", config.linkedinPassword);
  await humanDelay(500, 1000);

  await page.click('button[type="submit"]');
  await humanDelay(3000, 5000);

  // ============================================
  // POST-LOGIN HANDLING
  // ============================================
  try {
    await page.waitForURL("**/feed/**", {
      timeout: 30000,
    });

    logger.success("Login successful");
  } catch {
    const currentUrl = page.url();

    // Security verification case
    if (
      currentUrl.includes("/checkpoint") ||
      currentUrl.includes("/challenge")
    ) {
      logger.warn("Verification required (CAPTCHA/email)");
      logger.warn("Complete it in Browserbase live view");
      logger.warn("Waiting up to 5 minutes...");

      const maxWait = 5 * 60 * 1000;
      const interval = 5000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await new Promise((r) =>
          setTimeout(r, interval)
        );

        if (page.url().includes("/feed")) {
          logger.success("Verification completed");
          return;
        }
      }

      throw new Error(
        "Timeout waiting for verification"
      );
    }

    // Fallback check
    if (currentUrl.includes("/feed")) {
      logger.success("Login successful");
      return;
    }

    throw new Error(`Login failed: ${currentUrl}`);
  }
}

// ============================================
// CLEANUP
// ============================================
export async function closeBrowser(
  browser: Browser
): Promise<void> {
  try {
    await browser.close();

    // Allow context to persist
    await humanDelay(2000, 3000);

    logger.info("Browser closed, context saved");
  } catch {
    logger.warn("Browser already closed");
  }
}
