/**
 * ============================================
 * PURPOSE
 * ============================================
 * Lightweight logging utility for CLI automation.
 * - Provides colored logs using chalk
 * - Adds timestamps to every log
 * - Standardizes logging format (info, success, warn, error, step)
 *
 * ============================================
 * INPUTS / OUTPUTS
 * ============================================
 *
 * logger.info(message)
 * logger.success(message)
 * logger.warn(message)
 * logger.error(message)
 *   → Input: message string
 *   → Output: formatted console log with color + timestamp
 *
 * logger.step(profile, action, message)
 *   → Input: profile name, action, message
 *   → Output: structured step log
 *
 * logger.divider()
 *   → Output: visual separator line
 *
 * logger.banner(text)
 *   → Input: heading text
 *   → Output: styled banner output
 */

import chalk from "chalk";

// ============================================
// TIMESTAMP HELPER
// ============================================
function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
  });
}

// ============================================
// LOGGER OBJECT
// ============================================
export const logger = {
  // -------- Basic Logs --------
  info(message: string): void {
    console.log(chalk.blue(`[${timestamp()}] INFO `) + message);
  },

  success(message: string): void {
    console.log(chalk.green(`[${timestamp()}] OK   `) + message);
  },

  warn(message: string): void {
    console.log(chalk.yellow(`[${timestamp()}] WARN `) + message);
  },

  error(message: string): void {
    console.log(chalk.red(`[${timestamp()}] FAIL `) + message);
  },

  // -------- Step Log (Profile Actions) --------
  step(profile: string, action: string, message: string): void {
    const tag = chalk.cyan(`[${action.toUpperCase()}]`);
    const who = chalk.dim(profile);

    console.log(`[${timestamp()}] ${tag} ${who} ${message}`);
  },

  // -------- Visual Separator --------
  divider(): void {
    console.log(chalk.dim("-".repeat(60)));
  },

  // -------- Section Banner --------
  banner(text: string): void {
    console.log();
    console.log(chalk.bold.white(text));
    console.log(chalk.dim("=".repeat(60)));
  },
};