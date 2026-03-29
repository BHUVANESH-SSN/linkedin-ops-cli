import { chromium } from 'playwright';
import { getOrCreateSession, getDebugUrl } from './session/browserbase';
import { loginToLinkedIn } from './session/auth';
import * as dotenv from 'dotenv';
dotenv.config();

async function debugPage() {
  const sessionId = await getOrCreateSession();

  // Print live view URL so you can manually solve checkpoint
  const liveUrl = await getDebugUrl(sessionId);
  console.log('\n=== OPEN THIS URL IN YOUR BROWSER TO SEE LIVE VIEW ===');
  console.log(liveUrl);
  console.log('=======================================================\n');

  const wsUrl = `wss://connect.browserbase.com?apiKey=${process.env['BROWSERBASE_API_KEY']}&sessionId=${sessionId}`;
  const browser = await chromium.connectOverCDP(wsUrl);
  const context = browser.contexts()[0]!;
  const page = context.pages()[0] ?? await context.newPage();

  const loggedIn = await loginToLinkedIn(page);
  if (!loggedIn) {
    console.log('Login failed — open the Live View URL above and solve the checkpoint manually');
    console.log('Then run this script again WITHOUT deleting session.json');
    await browser.close();
    return;
  }

  console.log('Current URL after login:', page.url());

  // If still on checkpoint, tell user to solve it manually
  if (page.url().includes('/checkpoint')) {
    console.log('\n⚠ LinkedIn is showing a security checkpoint');
    console.log('Open this URL in your browser and solve it manually:');
    console.log(liveUrl);
    console.log('After solving, run this script again WITHOUT deleting session.json\n');
    await browser.close();
    return;
  }

  await page.goto('https://www.linkedin.com/in/sundarpichai/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(4000);

  console.log('Profile page URL:', page.url());

  const buttonTexts: Array<{ tag: string; text: string; aria: string }> =
    await page.evaluate(() => {
      const els = Array.from(
        (globalThis as any).document.querySelectorAll(
          'button, [role="button"], [role="menuitem"]'
        )
      ) as any[];

      return els
        .filter((el: any) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((el: any) => ({
          tag: el.tagName as string,
          text: ((el.textContent ?? '') as string).trim().replace(/\s+/g, ' ').slice(0, 80),
          aria: (el.getAttribute('aria-label') ?? '') as string,
        }))
        .filter((b: any) => (b.text as string).length > 0);
    });

  console.log('\n=== VISIBLE BUTTONS ON PROFILE PAGE ===');
  buttonTexts.forEach(b => {
    console.log(`[${b.tag}] text="${b.text}" aria="${b.aria}"`);
  });

  await browser.close();
}

debugPage().catch(console.error);