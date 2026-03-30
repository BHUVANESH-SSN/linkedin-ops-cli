# linkedin-automation-cli

CLI automation for LinkedIn profile workflows using Browserbase + Playwright.

Public repository: https://github.com/BHUVANESH-SSN/linkedin-ops-cli

## What This Project Covers

This project satisfies the Browserbase automation task requirements:

- Accepts a CSV file of LinkedIn profile URLs
- Accepts one or more actions through the CLI, such as `view,connect,like`
- Processes profiles sequentially
- Uses human-like pauses between actions and profiles
- Uses Browserbase cloud sessions for execution
- Persists and reuses a Browserbase context so LinkedIn login does not start from scratch every run
- Keeps actions modular so new actions can be added easily later
- Logs each step with clear terminal output

  <img width="1233" height="627" alt="image" src="https://github.com/user-attachments/assets/a387944d-23a4-40f5-84f8-45dd44a71d2f" />


## Tech Stack

- Node.js
- TypeScript
- Commander.js
- Browserbase SDK
- Playwright Core

## Prerequisites

- Node.js 18+
- npm
- A Browserbase account and project
- A LinkedIn account

## Installation

```bash
git clone https://github.com/BHUVANESH-SSN/linkedin-ops-cli.git
cd linkedin-ops-cli
npm install
```

## Install The CLI Command

The easiest no-sudo option is the repo-local launcher:

```bash
./cli-tool run --file leads.csv --actions view,connect,like
```

It automatically builds `dist/index.js` the first time if needed.

You can also run the same CLI through npm without global install:

```bash
npm run cli-tool -- run --file leads.csv --actions view,connect,like
```

If you want a global `cli-tool` command and your system allows global npm links, link the package once:

```bash
npm run link:cli
```

After that, you can run:

```bash
cli-tool run --file leads.csv --actions view,connect,like
```

If you only want a one-off local run during development, this still works too:

```bash
npm run dev -- run --file leads.csv --actions view,connect,like
```

If `npm run link:cli` fails with `EACCES`, use `./cli-tool ...` instead of the global link.

## Environment Setup

Create a local `.env` file:

```bash
cp .env.example .env
```

Fill in:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
LINKEDIN_EMAIL=your_linkedin_email
LINKEDIN_PASSWORD=your_linkedin_password
BROWSERBASE_CONTEXT_ID=
```

Notes:

- `BROWSERBASE_CONTEXT_ID` is optional
- If you leave it blank, the CLI will create a Browserbase context on the first run and save it locally in `browserbase-context.json`
- On later runs, that saved context is reused automatically
- If you set `BROWSERBASE_CONTEXT_ID` in `.env`, it overrides the local saved context file

## CSV Format

The CLI accepts `linkedin_url`, `profile_url`, or `url` columns.

Example:

```csv
linkedin_url
https://www.linkedin.com/in/satyanadella/
https://www.linkedin.com/in/sundarpichai/
```

## Usage

Run a single action:

```bash
./cli-tool run --file leads.csv --actions view
```

Run two actions:

```bash
./cli-tool run --file leads.csv --actions view,connect
```

Run the full workflow:

```bash
./cli-tool run --file leads.csv --actions view,connect,like
```

Build the project:

```bash
npm run build
```

Run the built CLI without linking:

```bash
npm start -- run --file leads.csv --actions view,connect,like
```

## Workflow Behavior

For each profile URL, the selected actions are executed in order.

### `view`

- Opens the LinkedIn profile
- Verifies that the loaded profile matches the requested slug

### `connect`

- Loads the target profile
- Tries the direct Browserbase invite flow first with `https://www.linkedin.com/preload/custom-invite/?vanityName=<slug>`
- Clicks `Send without a note` when available
- Falls back to profile page `Connect` or `More -> Connect` if needed
- Handles confirmation states such as modals, invite pages, pending states, and toasts

### `like`

- Opens the profile's recent activity page
- Finds the first visible recent post
- Locates the Like button safely
- Avoids duplicate likes when the post is already liked

## Human-Like Delays

This project intentionally adds small randomized waits so the workflow behaves less like a tight automation loop.

The delay helper lives in `src/utils.ts`:

```ts
humanDelay(minMs, maxMs)
```

It picks a random value between `minMs` and `maxMs` and waits for that amount of time before continuing.

Where delays are used:

- `src/index.ts`
  - waits `3000-6000ms` between profiles
- `src/browser.ts`
  - adds pauses during login checks, form filling, post-login waiting, and browser shutdown
- `src/actions/view.ts`
  - waits after opening a profile so the page can settle naturally
- `src/actions/connect.ts`
  - waits during invite-page loads, connect modal handling, send confirmation checks, retry loops, and profile-return verification
- `src/actions/like.ts`
  - waits after opening recent activity, after clicking Like, and while polling for confirmation

Examples of current delay ranges:

- `250-450ms` for short polling loops
- `700-1400ms` for action follow-up checks
- `1500-2500ms` after page loads
- `3000-6000ms` between different profiles

These delays are not meant to fully simulate a human user, but they do help the CLI avoid firing actions back-to-back with zero spacing.

## Session Management

Browserbase session reuse is handled through persistent contexts.

- First run:
  - A Browserbase context is created if one is not already configured
  - The context ID is saved to `browserbase-context.json`
  - LinkedIn login happens only if the saved context is not already authenticated

- Later runs:
  - The CLI reuses the same Browserbase context
  - LinkedIn should remain authenticated unless the session expires

To reset session reuse:

- delete `browserbase-context.json`
- remove `BROWSERBASE_CONTEXT_ID` from `.env` if you set it manually

## Project Structure

```text
src/
├── actions/
│   ├── connect.ts
│   ├── index.ts
│   ├── like.ts
│   └── view.ts
├── browser.ts
├── config.ts
├── csv.ts
├── index.ts
├── logger.ts
└── utils.ts
```

## Extending The CLI

Actions are registered centrally in `src/actions/index.ts`, so adding a new action like `message` is straightforward:

1. Create a new action file in `src/actions/`
2. Export the action handler with the same `(page, profileUrl) => Promise<void>` shape
3. Register it in `ACTION_REGISTRY`

## Resilience Notes

The current implementation already handles several interview-task edge cases:

- hidden `Connect` actions inside `More`
- direct invite links rendered as `custom-invite` URLs
- confirmation modal vs full invite page flows
- already-connected or pending states
- profiles with no recent posts
- login challenges that require manual completion in Browserbase live view

## Verification

Current local verification:

- `npm run build`

There is no automated integration test suite in this repo because the real workflow requires authenticated Browserbase and LinkedIn sessions.
