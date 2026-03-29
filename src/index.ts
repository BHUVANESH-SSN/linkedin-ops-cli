/**
 * ============================================
 * PURPOSE
 * ============================================
 * CLI tool to automate LinkedIn actions using Browserbase.
 *
 * - Reads LinkedIn profile URLs from a CSV file
 * - Executes one or more actions (view, connect, like)
 * - Processes profiles sequentially (human-like behavior)
 * - Logs progress and results
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * CLI Input:
 *   --file <path>      → CSV file with LinkedIn profile URLs
 *   --actions <list>   → Comma-separated actions (view, connect, like)
 *
 * Output:
 *   - Executes actions on each profile
 *   - Logs success/failure
 *   - Displays summary at end
 */



import { Command } from "commander";
import { loadConfig } from "./config.js";
import { parseCSV } from "./csv.js";
import { logger } from "./logger.js";
import { profileSlug, humanDelay } from "./utils.js";
import { VALID_ACTIONS, getAction } from "./actions/index.js";
import {
  getOrCreateContext,
  createBrowserSession,
  ensureAuthenticated,
  closeBrowser,
} from "./browser.js";

const program = new Command();

// ============================================
// CLI SETUP
// ============================================
program
  .name("linkedin-cli")
  .description("Automate LinkedIn actions via Browserbase")
  .version("1.0.0");

// ============================================
// MAIN COMMAND
// ============================================
program
  .command("run")
  .description("Process LinkedIn profiles from CSV")
  .requiredOption("-f, --file <path>", "CSV file with profile URLs")
  .requiredOption(
    "-a, --actions <actions>",
    `Actions: ${VALID_ACTIONS.join(", ")}`
  )
  .action(async (options: { file: string; actions: string }) => {
    let browser: Awaited<
      ReturnType<typeof createBrowserSession>
    >["browser"] | null = null;

    try {
      // ============================================
      // 1. PARSE & VALIDATE ACTIONS
      // ============================================
      const actionNames = options.actions
        .split(",")
        .map((a) => a.trim().toLowerCase());

      const invalidActions = actionNames.filter(
        (a) => !VALID_ACTIONS.includes(a)
      );

      if (invalidActions.length > 0) {
        logger.error(
          `Invalid actions: ${invalidActions.join(", ")} | Valid: ${VALID_ACTIONS.join(", ")}`
        );
        process.exit(1);
      }

      const handlers = actionNames.map((name) => ({
        name,
        handler: getAction(name)!,
      }));

      // ============================================
      // 2. LOAD CONFIG + CSV
      // ============================================
      const config = loadConfig();
      const urls = await parseCSV(options.file);

      logger.banner(
        `LinkedIn Automation | Profiles: ${urls.length} | Actions: [${actionNames.join(", ")}]`
      );

      // ============================================
      // 3. BROWSERBASE SETUP
      // ============================================
      const contextId = await getOrCreateContext(config);
      const session = await createBrowserSession(config, contextId);

      browser = session.browser;
      const { page, sessionId } = session;

      logger.info(
        `Live session: https://www.browserbase.com/sessions/${sessionId}`
      );

      // ============================================
      // 4. AUTHENTICATION
      // ============================================
      await ensureAuthenticated(page, config);
      logger.divider();

      // ============================================
      // 5. PROCESS PROFILES
      // ============================================
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const slug = profileSlug(url);

        logger.banner(`Profile ${i + 1}/${urls.length}: ${slug}`);

        let failed = false;

        for (const { name, handler } of handlers) {
          try {
            await handler(page, url);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : String(err);

            logger.error(
              `Action "${name}" failed for ${slug}: ${message}`
            );

            failed = true;
          }
        }

        failed ? failCount++ : successCount++;

        // ============================================
        // 6. HUMAN DELAY BETWEEN PROFILES
        // ============================================
        if (i < urls.length - 1) {
          logger.info("Waiting before next profile...");
          await humanDelay(3000, 6000);
        }

        logger.divider();
      }

      // ============================================
      // 7. SUMMARY
      // ============================================
      logger.banner("Run Complete");
      logger.info(
        `Total: ${urls.length} | Passed: ${successCount} | Failed: ${failCount}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);

      logger.error(message);
      process.exitCode = 1;
    } finally {
      // ============================================
      // 8. CLEANUP
      // ============================================
      if (browser) {
        logger.info("Closing Browserbase session...");
        await closeBrowser(browser);
      }
    }
  });

// ============================================
// START CLI
// ============================================
program.parse();