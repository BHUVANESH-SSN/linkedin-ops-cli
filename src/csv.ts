/**
 * ============================================
 * PURPOSE
 * ============================================
 * Parses a CSV file to extract valid LinkedIn profile URLs.
 *
 * - Supports flexible column names:
 *   "url", "profile_url", "linkedin_url" (case-insensitive)
 * - Filters invalid or missing URLs
 * - Logs skipped rows for debugging
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * Input:
 *   filePath (string) → Path to CSV file
 *
 * Output:
 *   Promise<string[]> → List of valid LinkedIn profile URLs
 */

import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { logger } from "./logger.js";

// ============================================
// CSV PARSER FUNCTION
// ============================================
export async function parseCSV(filePath: string): Promise<string[]> {
  const urls: string[] = [];

  return new Promise((resolve, reject) => {
    const parser = createReadStream(filePath).pipe(
      parse({
        // Normalize headers (case-insensitive)
        columns: (headers: string[]) =>
          headers.map((h) => h.trim().toLowerCase()),

        skip_empty_lines: true,
        trim: true,
      })
    );

    // ============================================
    // HANDLE EACH ROW
    // ============================================
    parser.on("data", (row: Record<string, string>) => {
      const url =
        row["url"] ||
        row["profile_url"] ||
        row["linkedin_url"];

      // Skip if no valid column
      if (!url) {
        logger.warn(
          "Skipping row -- missing url/profile_url/linkedin_url column"
        );
        return;
      }

      // Validate LinkedIn profile URL
      if (!url.includes("linkedin.com/in/")) {
        logger.warn(`Skipping invalid LinkedIn URL: ${url}`);
        return;
      }

      urls.push(url.trim());
    });

    // ============================================
    // COMPLETION HANDLER
    // ============================================
    parser.on("end", () => {
      if (urls.length === 0) {
        reject(
          new Error(
            'No valid LinkedIn URLs found. Ensure CSV has "url" column.'
          )
        );
        return;
      }

      resolve(urls);
    });

    // ============================================
    // ERROR HANDLER
    // ============================================
    parser.on("error", (err: Error) => {
      reject(new Error(`CSV parsing failed: ${err.message}`));
    });
  });
}