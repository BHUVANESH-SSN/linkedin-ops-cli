# linkedin-automation-cli

A small CLI project that automates simple LinkedIn actions against a list of profile URLs from a CSV file. It uses Browserbase for the cloud browser session and Playwright for the actual browser automation, while keeping the flow sequential and easy to read.

## Prerequisites

- Node.js 18 or newer
- npm
- A Browserbase account
- A LinkedIn account

## Installation

```bash
git clone <your-repo-url>
cd linkedin-automation-cli
npm install
```

## Configuration

Create a `.env` file from the sample:

```bash
cp .env.example .env
```

Fill in these values:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
LINKEDIN_EMAIL=your_linkedin_email
LINKEDIN_PASSWORD=your_linkedin_password
```

Where to get them:

- `BROWSERBASE_API_KEY`: from your Browserbase dashboard API keys page
- `BROWSERBASE_PROJECT_ID`: from the Browserbase project you want to run the browser in
- `LINKEDIN_EMAIL`: the email for your LinkedIn login
- `LINKEDIN_PASSWORD`: the password for your LinkedIn login

## CSV Format

Create a CSV file such as `leads.csv` with a `linkedin_url` column:

```csv
linkedin_url
https://www.linkedin.com/in/satyanadella/
https://www.linkedin.com/in/sundarpichai/
```

The CSV reader also accepts a `url` column, but `linkedin_url` is the intended format.

## Usage

Run one action:

```bash
npm run dev -- run --file leads.csv --actions view
```

Run multiple actions in sequence:

```bash
npm run dev -- run --file leads.csv --actions view,connect
```

```bash
npm run dev -- run --file leads.csv --actions connect,like
```

```bash
npm run dev -- run --file leads.csv --actions view,connect,like
```

Use a custom delay between actions:

```bash
npm run dev -- run --file leads.csv --actions view,connect --delay 3500
```

Preview the workflow without launching browser automation:

```bash
npm run dev -- run --file leads.csv --actions view,connect,like --dry-run
```

Reset the saved Browserbase session:

```bash
npm run dev -- --reset-session
```

## How Session Management Works

The project keeps Browserbase context state in `browserbase-context.json` and cached LinkedIn cookies in `linkedin-cookies.json`.

- On the first run, it creates or reuses a persistent Browserbase context and stores its ID locally.
- On later runs, it reconnects with that saved context so you do not have to recreate the authenticated browser state from scratch.
- If the saved state becomes stale or LinkedIn login state is no longer valid, run with `--reset-session` to delete the local state files and start fresh.

## Project Structure

```text
src/
├── actions/
│   ├── connect.ts
│   ├── index.ts
│   ├── like.ts
│   └── view.ts
├── session/
│   ├── auth.ts
│   └── browserbase.ts
├── utils/
│   ├── csv.ts
│   ├── delay.ts
│   └── logger.ts
├── cli.ts
├── runner.ts
└── types.ts
```

## Adding New Actions

Each action is a function with the same shape:

```ts
type ActionFn = (page: Page, url: string) => Promise<ActionResult>;
```

The `ACTION_MAP` in [src/actions/index.ts](/mnt/acer/PROJECTS/linkedin-automation-cli/src/actions/index.ts) decides which string from the CLI maps to which action function.

If you wanted to add a new `message` action:

1. Create `src/actions/message.ts`
2. Export `runMessage(page, url)`
3. Add `'message'` to `ActionName` in [src/types.ts](/mnt/acer/PROJECTS/linkedin-automation-cli/src/types.ts)
4. Register it inside `ACTION_MAP`
5. Update the CLI validation so `--actions message` is allowed

## Troubleshooting

Session expired:
- Run `npm run dev -- --reset-session` and try again.

Connect button not found:
- Some profiles hide the button inside the `More` menu, and some profiles do not allow connections at all.

Login blocked:
- LinkedIn may challenge the login with extra verification. If that happens, reset the session and try again with a clean login.

## How The Code Flows

If you want the simplest mental model, this is the order of execution:

1. `src/cli.ts` reads your command line flags
2. `src/runner.ts` reads the CSV and connects to Browserbase
3. `src/session/auth.ts` logs into LinkedIn once
4. The runner loops through each profile URL
5. For each profile, the selected actions run one by one with human-like delays
6. A summary prints at the end
