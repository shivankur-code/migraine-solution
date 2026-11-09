// Click through the built web app in a real browser and save screenshots: first-run setup,
// the Quiet room before and while playing (the cymatics figure gathers), My sound and Journal.
// Usage: node scripts/web-shots.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base = 'http://127.0.0.1:8080', out = 'web-shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];

async function run(name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on('pageerror', e => problems.push(`${name}: ${e.message}`));
  const shot = async (label, wait = 1200) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}-${label}.png` }); };
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByText('Make my sound').waitFor({ timeout: 30000 });
  await shot('00-welcome', 2500);
  await page.getByText('Make my sound').click();
  await page.getByText('Not sure').waitFor();
  await shot('01-question');
  await page.getByText('Hiss and high sounds').click();
  await page.getByText('Pick what feels restful').waitFor();
  await page.getByLabel('Ocean').click();
  await shot('02-texture', 2500);
  await page.getByText('Continue').click();
  await page.getByText('Turn it to taste').waitFor();
  await page.getByLabel('Tone up').click();
  await shot('03-dial', 3000);
  await page.getByText('Save my sound').click();
  await page.getByText('Rest here.').waitFor();
  await shot('04-quiet-room', 3000);
  await page.getByLabel('Play my sound').click();
  await shot('05-playing', 6000);
  await page.getByLabel('Fade to silence').click();
  await shot('06-faded', 3000);
  await page.getByRole('tab', { name: 'My sound' }).or(page.getByText('My sound', { exact: true }).last()).first().click();
  await page.getByText('Your sound').waitFor();
  await shot('07-my-sound', 3000);
  await page.getByRole('tab', { name: 'Journal' }).or(page.getByText('Journal', { exact: true }).last()).first().click();
  await page.getByText('Your journal').waitFor();
  await shot('08-journal', 2500);
  await page.close();
}

try {
  await run('phone', { width: 390, height: 844 });
  await run('desktop', { width: 1440, height: 900 });
} finally {
  await browser.close();
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`Saved screenshots to ${out}`);
