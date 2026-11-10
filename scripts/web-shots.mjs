// Click through the built web app in a real browser and save screenshots: the landing page, first-run setup,
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
  // A shader that fails to build only warns; treat it as a failure here.
  page.on('console', m => { if (m.type() === 'warning' && /ERROR: \d+:\d+/.test(m.text())) problems.push(`${name}: shader: ${m.text()}`); });
  // Phone: the bottom tab bar (test ids); desktop: the sidebar (tabs by name).
  const tab = (id, name) => page.getByTestId(id).or(page.getByRole('tab', { name, exact: true })).first();
  const shot = async (label, wait = 1200) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}-${label}.png` }); };
  await page.goto(base, { waitUntil: 'networkidle' });
  // First web visit lands on the welcome page: photograph it, then mark it seen and open the app.
  const landing = page.getByText('Skip all this', { exact: false });
  if (await landing.first().waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    await shot('landing-top', 3500);
    // Stir the dust with the cursor and ring it with a click, as a visitor would.
    const { width, height } = page.viewportSize();
    for (let i = 0; i <= 12; i++) await page.mouse.move(width * (0.25 + 0.04 * i), height * (0.35 + 0.02 * i), { steps: 4 });
    await page.mouse.click(width * 0.62, height * 0.5);
    await shot('landing-stirred', 900);
    await page.screenshot({ path: `${out}/${name}-landing-full.png`, fullPage: true });
    await page.evaluate(() => localStorage.setItem('still.welcomed', '1'));
    await page.goto(base, { waitUntil: 'networkidle' });
  }
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
  await tab('tab-sound', 'My sound').click();
  await page.getByText('Your sound', { exact: true }).waitFor();
  await shot('07-my-sound', 3000);
  await tab('tab-journal', 'Journal').click();
  await page.getByText('Your journal', { exact: true }).waitFor();
  await shot('08-journal', 2500);
  // "Still" leads back to the welcome page from any page.
  // Every tab keeps its own copy mounted in the same spot; click that spot, as a person would.
  const box = await page.getByLabel('Still: open the welcome page').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByText('Skip all this', { exact: false }).first().waitFor({ timeout: 15000 });
  await shot('09-back-to-landing', 2500);
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
