import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { logger } from './logger';

const normalizeHeader = (header: string): string => header.trim().toLowerCase();

const isLinkedInProfileUrl = (url: string): boolean =>
  /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?(\?.*)?$/i.test(url);

export const readCsv = (filePath: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const urls: string[] = [];
    let sawUrlColumn = false;

    createReadStream(filePath)
      .pipe(
        parse({
          columns: headers => headers.map(normalizeHeader),
          skip_empty_lines: true,
          trim: true,
        }),
      )
      .on('data', (row: Record<string, string>) => {
        sawUrlColumn =
          sawUrlColumn ||
          Object.prototype.hasOwnProperty.call(row, 'url') ||
          Object.prototype.hasOwnProperty.call(row, 'linkedin_url');

        const url = (row['url'] ?? row['linkedin_url'] ?? '').trim();

        if (!url) {
          return;
        }

        if (isLinkedInProfileUrl(url)) {
          urls.push(url);
        } else {
          logger.fail(`Skipping invalid LinkedIn profile URL: ${url}`);
        }
      })
      .on('end', () => {
        if (!sawUrlColumn) {
          reject(new Error('CSV file must contain a "url" column.'));
          return;
        }

        logger.success(`Loaded ${urls.length} URLs from ${filePath}`);
        resolve(urls);
      })
      .on('error', reject);
  });
};
