import 'dotenv/config';

import { closeSession, createSession } from './browser/session';
import { runRegisteredAction, type ActionInput } from './registry/actionRegistry';
import type { Config, ProfileResult } from './types';
import { readCsv } from './utils/csv';
import { waitForConfiguredDelay } from './utils/delay';
import { logger } from './utils/logger';

const buildActionInput = (action: Config['actions'][number], url: string): ActionInput => {
  if (action === 'like') {
    return {
      command: 'like',
      url,
    };
  }

  if (action === 'connect') {
    return {
      command: 'connect',
      profileUrl: url,
    };
  }

  return {
    command: 'view',
    profileUrl: url,
  };
};

const runActionsForProfile = async (
  url: string,
  config: Config,
  session: Awaited<ReturnType<typeof createSession>>,
): Promise<ProfileResult> => {
  const results: ProfileResult['results'] = [];

  logger.divider();
  logger.info(`Starting profile: ${url}`);

  for (const action of config.actions) {
    try {
      await runRegisteredAction(session, buildActionInput(action, url));

      results.push({
        action,
        success: true,
        message: `${action} completed`,
      });
    } catch (error) {
      const failedResult: ProfileResult['results'][number] = {
        action,
        success: false,
        message: String(error),
      };

      results.push(failedResult);
      logger.fail(`${action.toUpperCase()} on ${url}: ${failedResult.message}`);
    }

    if (action !== config.actions[config.actions.length - 1]) {
      await waitForConfiguredDelay(config.delayMs);
    }
  }

  return { url, results };
};

const logDryRunPlan = (config: Config, urls: string[]): void => {
  logger.divider();
  logger.info('Dry run enabled. No browser automation will be executed.');
  logger.info(`Profiles queued: ${urls.length}`);
  logger.info(`Actions to run: ${config.actions.join(', ')}`);
  logger.info(`Configured delay: ${config.delayMs}ms`);

  for (const url of urls) {
    logger.divider();
    logger.info(`Would process profile: ${url}`);

    for (const action of config.actions) {
      logger.info(`Would run action: ${action}`);
    }
  }
};

const logSummary = (profileResults: ProfileResult[], dryRun: boolean): void => {
  const allResults = profileResults.flatMap(profile => profile.results);
  const successfulActions = allResults.filter(result => result.success).length;
  const failedActions = allResults.length - successfulActions;
  const successfulProfiles = profileResults.filter(profile =>
    profile.results.every(result => result.success),
  ).length;

  logger.divider();
  logger.info(dryRun ? 'Dry-run summary' : 'Automation summary');
  logger.info(`Profiles processed: ${profileResults.length}`);
  logger.info(`Profiles with all actions successful: ${successfulProfiles}`);
  logger.success(`Successful actions: ${successfulActions}`);
  logger.fail(`Failed actions: ${failedActions}`);
};

export const runAutomation = async (config: Config): Promise<void> => {
  const urls = await readCsv(config.csvPath);

  if (urls.length === 0) {
    logger.fail('No valid LinkedIn profile URLs were found in the CSV file.');
    return;
  }

  if (config.dryRun) {
    logDryRunPlan(config, urls);

    const dryRunResults: ProfileResult[] = urls.map(url => ({
      url,
      results: config.actions.map(action => ({
        action,
        success: true,
        message: `Dry run: ${action} would run`,
      })),
    }));

    logSummary(dryRunResults, true);
    return;
  }

  let session: Awaited<ReturnType<typeof createSession>> | undefined;

  try {
    session = await createSession();

    logger.info('Browserbase session ready.');
    logger.info(`Configured delay between automation steps: ${config.delayMs}ms`);
    logger.info(
      'If LinkedIn asks for login or verification, complete it in the opened session and rerun.',
    );

    const profileResults: ProfileResult[] = [];

    for (const url of urls) {
      try {
        const profileResult = await runActionsForProfile(url, config, session);
        profileResults.push(profileResult);
      } catch (error) {
        logger.fail(`Unexpected failure while processing ${url}: ${String(error)}`);
      }

      if (url !== urls[urls.length - 1]) {
        await waitForConfiguredDelay(config.delayMs);
      }
    }

    logSummary(profileResults, false);
  } finally {
    if (session) {
      await closeSession(session);
      logger.info('Browser connection closed');
    }
  }
};
