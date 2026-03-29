import { readCsv } from './utils/csv';

async function main() {
  const urls = await readCsv('leads.csv');
  console.log(urls);
}

main();
