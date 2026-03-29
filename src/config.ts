/**
 * ============================================
 * PURPOSE
 * ============================================
 * Loads and validates environment configuration
 * required for Browserbase + LinkedIn automation.
 *
 * - Ensures all required environment variables exist
 * - Provides a typed Config object
 * - Fails fast if any required value is missing
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * Input:
 *   Environment variables (.env file)
 *
 * Output:
 *   Config object with validated credentials
 */

import "dotenv/config";

// ============================================
// CONFIG TYPE
// ============================================
export interface Config {
  browserbaseApiKey: string;
  browserbaseProjectId: string;
  linkedinEmail: string;
  linkedinPassword: string;
  browserbaseContextId?: string;
}

// ============================================
// VALIDATE REQUIRED ENV VARIABLES
// ============================================
function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    console.error(`Missing environment variable: ${key}`);
    console.error(` Copy .env.example → .env and fill values`);
    process.exit(1);
  }

  return value;
}

// ============================================
// LOAD CONFIG
// ============================================
export function loadConfig(): Config {
  return {
    browserbaseApiKey: requireEnv("BROWSERBASE_API_KEY"),
    browserbaseProjectId: requireEnv("BROWSERBASE_PROJECT_ID"),
    linkedinEmail: requireEnv("LINKEDIN_EMAIL"),
    linkedinPassword: requireEnv("LINKEDIN_PASSWORD"),

    // Optional (used for session reuse)
    browserbaseContextId:
      process.env["BROWSERBASE_CONTEXT_ID"] || undefined,
  };
}
