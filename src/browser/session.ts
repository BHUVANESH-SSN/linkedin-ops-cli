import 'dotenv/config';

import Browserbase from '@browserbasehq/sdk';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const COOKIES_PATH = path.resolve(process.cwd(), 'linkedin-cookies.json');
const CONTEXT_STATE_PATH = path.resolve(process.cwd(), 'browserbase-context.json');

interface SavedContextState {
  contextId: string;
  createdAt: string;
}

export interface ManagedSession {
  browser: Browser;
  client: Browserbase;
  context: BrowserContext;
  contextId: string;
  liveViewUrl: string;
  page: Page;
  sessionId: string;
}

const requireEnv = (name: 'BROWSERBASE_API_KEY' | 'BROWSERBASE_PROJECT_ID'): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

const deleteFileIfExists = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing-file errors.
  }
};

const getBrowserbaseClient = (): Browserbase =>
  new Browserbase({ apiKey: requireEnv('BROWSERBASE_API_KEY') });

const isContextNotFoundError = (error: unknown): boolean => {
  const message = String(error).toLowerCase();
  return message.includes('context') && message.includes('not found');
};

const getOrCreatePersistentContextId = async (
  client: Browserbase,
  projectId: string,
): Promise<string> => {
  const configuredContextId = process.env.BROWSERBASE_CONTEXT_ID?.trim();

  if (configuredContextId) {
    return configuredContextId;
  }

  const savedContext = await readJsonFile<SavedContextState>(CONTEXT_STATE_PATH);

  if (savedContext?.contextId) {
    return savedContext.contextId;
  }

  const createdContext = await client.contexts.create({ projectId });

  await writeJsonFile(CONTEXT_STATE_PATH, {
    contextId: createdContext.id,
    createdAt: new Date().toISOString(),
  });

  return createdContext.id;
};

const createFreshPersistentContextId = async (
  client: Browserbase,
  projectId: string,
): Promise<string> => {
  await deleteFileIfExists(CONTEXT_STATE_PATH);

  const createdContext = await client.contexts.create({ projectId });
  const savedState: SavedContextState = {
    contextId: createdContext.id,
    createdAt: new Date().toISOString(),
  };

  await writeJsonFile(CONTEXT_STATE_PATH, savedState);
  return createdContext.id;
};

const getWorkingContext = async (browser: Browser): Promise<BrowserContext> =>
  browser.contexts()[0] ?? browser.newContext();

const getWorkingPage = async (context: BrowserContext): Promise<Page> =>
  context.pages()[0] ?? context.newPage();

const loadSavedCookies = async (context: BrowserContext): Promise<void> => {
  const cookies = await readJsonFile<Parameters<BrowserContext['addCookies']>[0]>(COOKIES_PATH);

  if (cookies && cookies.length > 0) {
    await context.addCookies(cookies);
  }
};

const saveCookies = async (context: BrowserContext): Promise<void> => {
  const cookies = await context.cookies();
  await writeJsonFile(COOKIES_PATH, cookies);
};

export const waitRandomDelay = async (minMs = 1500, maxMs = 4000): Promise<void> => {
  const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise(resolve => setTimeout(resolve, delayMs));
};

const isLoginPage = (url: string): boolean =>
  url.includes('/login') || url.includes('/uas/login') || url.includes('/authwall');

const isCheckpointPage = (url: string): boolean =>
  url.includes('/checkpoint');

const isBlockedPage = (url: string): boolean =>
  isLoginPage(url) || isCheckpointPage(url);

const attemptAutoLogin = async (page: Page): Promise<boolean> => {
  const email = process.env.LINKEDIN_EMAIL?.trim();
  const password = process.env.LINKEDIN_PASSWORD?.trim();

  if (!email || !password) {
    return false;
  }

  if (page.url().includes('/authwall')) {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  }

  const emailField = page.locator('input[name="session_key"], input[id="username"]').first();
  const passwordField = page.locator('input[name="session_password"], input[id="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  if (!(await emailField.isVisible().catch(() => false))) {
    return false;
  }

  await emailField.fill(email);
  await waitRandomDelay(300, 900);
  await passwordField.fill(password);
  await waitRandomDelay(300, 900);
  await submitButton.click();

  return true;
};

export const waitForManualVerificationIfNeeded = async (page: Page): Promise<void> => {
  const currentUrl = page.url();

  if (!isBlockedPage(currentUrl)) {
    return;
  }

  if (isLoginPage(currentUrl)) {
    const attempted = await attemptAutoLogin(page);

    if (attempted) {
      await page.waitForURL(url => !isLoginPage(url.toString()), { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');
      await waitRandomDelay();

      if (!isBlockedPage(page.url())) {
        return;
      }
    }
  }

  throw new Error(`LinkedIn returned a blocked page during automation: ${page.url()}`);
};

const matchesTargetUrl = (currentUrl: string, targetUrl: string): boolean => {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return current.origin === target.origin && current.pathname === target.pathname;
  } catch {
    return currentUrl === targetUrl;
  }
};

export const gotoTargetPage = async (page: Page, targetUrl: string): Promise<void> => {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await waitForManualVerificationIfNeeded(page);

  // After LinkedIn login, the browser often lands on the feed/home page instead
  // of the original destination. In that case, reopen the target URL explicitly.
  if (!matchesTargetUrl(page.url(), targetUrl)) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await waitForManualVerificationIfNeeded(page);
  }

  await page.waitForLoadState('networkidle');
};

export const createSession = async (): Promise<ManagedSession> => {
  const projectId = requireEnv('BROWSERBASE_PROJECT_ID');
  const client = getBrowserbaseClient();
  const rawTimeout = process.env.BROWSERBASE_SESSION_TIMEOUT_SEC?.trim();
  const sessionTimeoutSec = rawTimeout && Number(rawTimeout) > 0 ? Number(rawTimeout) : 3600;
  let contextId = await getOrCreatePersistentContextId(client, projectId);
  let browserbaseSession;

  try {
    browserbaseSession = await client.sessions.create({
      keepAlive: true,
      projectId,
      timeout: sessionTimeoutSec,
      browserSettings: {
        context: {
          id: contextId,
          persist: true,
        },
        viewport: {
          width: 1440,
          height: 900,
        },
      },
    });
  } catch (error) {
    if (!isContextNotFoundError(error)) {
      throw error;
    }

    console.log('Saved Browserbase context was not found for this API/project. Creating a fresh context...');
    contextId = await createFreshPersistentContextId(client, projectId);

    browserbaseSession = await client.sessions.create({
      keepAlive: true,
      projectId,
      timeout: sessionTimeoutSec,
      browserSettings: {
        context: {
          id: contextId,
          persist: true,
        },
        viewport: {
          width: 1440,
          height: 900,
        },
      },
    });
  }

  const liveViewUrl = `https://browserbase.com/sessions/${browserbaseSession.id}`;
  console.log(`Session started: ${liveViewUrl}`);

  const browser = await chromium.connectOverCDP(browserbaseSession.connectUrl);
  const context = await getWorkingContext(browser);
  await loadSavedCookies(context);

  const page = await getWorkingPage(context);
  page.setDefaultTimeout(120_000);
  page.setDefaultNavigationTimeout(120_000);

  return {
    browser,
    client,
    context,
    contextId,
    liveViewUrl,
    page,
    sessionId: browserbaseSession.id,
  };
};

export const closeSession = async (session: ManagedSession): Promise<void> => {
  const { browser, client, context, sessionId } = session;

  try {
    await saveCookies(context);
  } finally {
    await browser.close();

    try {
      await client.sessions.update(sessionId, { status: 'REQUEST_RELEASE' });
    } catch {
      // Best-effort only.
    }
  }
};

export const clearSavedSessionState = async (): Promise<void> => {
  await Promise.all([
    deleteFileIfExists(COOKIES_PATH),
    deleteFileIfExists(CONTEXT_STATE_PATH),
  ]);
};
