import 'dotenv/config';

import { existsSync } from 'fs';
import { Command } from 'commander';
import { clearSavedSessionState } from './browser/session';
import { runAutomation } from './runner';
import type { ActionName, Config } from './types';

const DEFAULT_DELAY_MS = 2000;
const VALID_ACTIONS: ActionName[] = ['view', 'connect', 'like'];

const parseActions = (actionsInput: string): ActionName[] => {
  const actions = actionsInput
    .split(',')
    .map(action => action.trim().toLowerCase())
    .filter(Boolean);

  if (actions.length === 0) {
    throw new Error('Please provide at least one action with --actions.');
  }

  const invalidActions = actions.filter(
    (action): action is string => !VALID_ACTIONS.includes(action as ActionName),
  );

  if (invalidActions.length > 0) {
    throw new Error(
      `Invalid action(s): ${invalidActions.join(', ')}. Valid actions are: ${VALID_ACTIONS.join(', ')}`,
    );
  }

  return actions as ActionName[];
};

const parseDelay = (rawDelay: string): number => {
  const delayMs = Number(rawDelay);

  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error('Please provide --delay as a non-negative integer in milliseconds.');
  }

  return delayMs;
};

const validateCsvPath = (csvPath: string): string => {
  if (!existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  return csvPath;
};

const program = new Command();

program
  .name('linkedin-cli')
  .description('Batch LinkedIn automation with Browserbase and Playwright')
  .showHelpAfterError()
  .option(
    '--reset-session',
    'Delete saved Browserbase state files so the next run starts with a fresh authenticated context',
  );

program
  .command('run')
  .description('Run LinkedIn automation for the profiles listed in a CSV file')
  .requiredOption('--file <path>', 'path to CSV file')
  .requiredOption('--actions <list>', 'comma-separated actions: view,connect,like')
  .option(
    '--delay <ms>',
    'milliseconds to wait between actions and profile runs',
    String(DEFAULT_DELAY_MS),
  )
  .option('--dry-run', 'print what would be done without executing browser actions')
  .action(
    async (options: { actions: string; delay: string; dryRun?: boolean; file: string }) => {
    try {
      const config: Config = {
        csvPath: validateCsvPath(options.file),
        actions: parseActions(options.actions),
        delayMs: parseDelay(options.delay),
        dryRun: Boolean(options.dryRun),
      };

      await runAutomation(config);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
    }
    },
  );

export const runCli = async (): Promise<void> => {
  try {
    const argv = process.argv.slice(2);

    if (argv.includes('--reset-session')) {
      await clearSavedSessionState();
      console.log('Saved Browserbase state cleared.');
      return;
    }

    if (argv.length === 0) {
      program.help();
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
};
