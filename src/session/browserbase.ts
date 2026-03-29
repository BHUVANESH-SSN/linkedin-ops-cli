import { Browserbase } from '@browserbasehq/sdk';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';
dotenv.config();

const SESSION_FILE = 'session.json';

interface SavedSession {
  sessionId: string;
  createdAt: string;
}

const createBrowserbaseClient = (): Browserbase =>
  new Browserbase({ apiKey: process.env['BROWSERBASE_API_KEY'] ?? '' });

export const createNewSession = async (): Promise<string> => {
  const bb = createBrowserbaseClient();

  logger.running('Creating new Browserbase session...');

  const contextId = process.env['BROWSERBASE_CONTEXT_ID'];

  const session = await bb.sessions.create({
    projectId: process.env['BROWSERBASE_PROJECT_ID'] ?? '',
    ...(contextId && {
      browserSettings: {
        context: { id: contextId, persist: true },
      },
    }),
  });

  writeFileSync(SESSION_FILE, JSON.stringify({
    sessionId: session.id,
    createdAt: new Date().toISOString(),
  }, null, 2));

  logger.success(`New session created: ${session.id}`);
  return session.id;
};

export const getOrCreateSession = async (): Promise<string> => {
  if (existsSync(SESSION_FILE)) {
    const saved: SavedSession = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    logger.info(`Reusing existing session: ${saved.sessionId}`);
    return saved.sessionId;
  }

  return createNewSession();
};

export const getDebugUrl = async (sessionId: string): Promise<string> => {
  const bb = createBrowserbaseClient();
  const info = await bb.sessions.debug(sessionId);
  return info.debuggerFullscreenUrl;
};

export const clearSession = (): void => {
  if (existsSync(SESSION_FILE)) {
    unlinkSync(SESSION_FILE);
    logger.info('Session cleared');
  }
};
