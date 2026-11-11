// Click through the built web app in a real browser and save screenshots: the landing page, first-run setup,
// the Quiet room before and while playing, My sound and Journal. Runs on four phone sizes and a desktop.
// On every screen it also checks the layout: no two visible controls, and no control and text, may sit
// on top of each other (anything fully covered on purpose, like the room behind setup, is skipped).
// Usage: node scripts/web-shots.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base = 'http://127.0.0.1:8080', out = 'web-shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];

// Visible controls and text that overlap each other on the current screen. An element counts only if
// some of it is actually on top (sampled with elementFromPoint), so things covered on purpose are skipped.
async function overlaps(page) {
  return page.evaluate(() => {
    const CONTROL = 'button, a[href], input, [role="button"], [role="tab"], [role="radio"], [role="slider"], [role="link"], [role="switch"], [role="checkbox"]';
    const shown = el => {
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (Number(cs.opacity) < 0.15 || cs.visibility === 'hidden' || cs.display === 'none') return false;
      }
      const r = el.getBoundingClientRect();
      return r.width >= 6 && r.height >= 6;
    };
    const onTop = el => {
      const r = el.getBoundingClientRect();
      const pts = [[0.5, 0.5], [0.2, 0.25], [0.8, 0.25], [0.2, 0.75], [0.8, 0.75]];
      return pts.some(([fx, fy]) => {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      });
    };
    const label = el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const controls = [...document.querySelectorAll(CONTROL)].filter(el => shown(el) && onTop(el));
    const texts = [...document.querySelectorAll('div[dir="auto"], p, h1, h2, h3, span')]
      .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1))
      .filter(el => shown(el) && onTop(el) && !el.closest(CONTROL));
    const out = [];
    const area = (a, b) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const check = (list1, list2, kind) => {
      for (let i = 0; i < list1.length; i++) {
        for (let j = list1 === list2 ? i + 1 : 0; j < list2.length; j++) {
          const a = list1[i], b = list2[j];
          if (a === b || a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          if (area(ra, rb) > 40) out.push(`${kind}: "${label(a)}" overlaps "${label(b)}"`);
        }
      }
    };
    check(controls, controls, 'controls');
    check(controls, texts, 'control over text');
    return [...new Set(out)];
  });
}

async function run(name, viewport, { quick = false } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on('pageerror', e => problems.push(`${name}: ${e.message}`));
  // A shader that fails to build only warns; treat it as a failure here.
  page.on('console', m => { if (m.type() === 'warning' && /ERROR: \d+:\d+/.test(m.text())) problems.push(`${name}: shader: ${m.text()}`); });
  // Phone: the bottom tab bar (test ids); desktop: the sidebar (tabs by name).
  const tab = (id, name) => page.getByTestId(id).or(page.getByRole('tab', { name, exact: true })).first();
  const shot = async (label, wait = 1200) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/${name}-${label}.png` });
    for (const o of await overlaps(page)) problems.push(`${name} ${label}: ${o}`);
  };
  await page.goto(base, { waitUntil: 'networkidle' });
  // First web visit lands on the welcome page: photograph it, then mark it seen and open the app.
  const landing = page.getByText('A quiet room, with one soft sound in it.');
  if (await landing.first().waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    await shot('landing-top', 3500);
    // Stir the dust with the cursor and ring it with a click, as a visitor would.
    const { width, height } = page.viewportSize();
    for (let i = 0; i <= 12; i++) await page.mouse.move(width * (0.25 + 0.04 * i), height * (0.35 + 0.02 * i), { steps: 4 });
    await page.mouse.click(width * 0.62, height * 0.5);
    await shot('landing-stirred', 900);
    // The background changes on its own every 14 s: catch the next texture too.
    if (!quick) await shot('landing-later', 15000);
    if (name === 'desktop') {
      // Hush comes next, then fan (about 43 s in): catch the fan as well.
      await shot('landing-fan', 28500);
      // The page scrolls inside its own container: step down it to see the sections below.
      for (let i = 1; i <= 3; i++) {
        await page.evaluate(() => { const el = document.querySelector('.lp'); if (el) el.scrollBy(0, window.innerHeight * 0.9); });
        await shot(`landing-scroll-${i}`, 1500);
      }
      await page.evaluate(() => { const el = document.querySelector('.lp'); if (el) el.scrollTo(0, 0); });
    }
    await page.screenshot({ path: `${out}/${name}-landing-full.png`, fullPage: true });
    // Every visit to the front door opens the welcome page; its button leads into the room.
    await page.getByText('Open the quiet room').first().click();
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
  // Phones: the room may scroll; check the lower half of it while playing too.
  if (viewport.width < 960) {
    await page.mouse.wheel(0, 600);
    await shot('05b-playing-scrolled', 800);
    await page.mouse.wheel(0, -600);
  }
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
  await page.getByText('A quiet room, with one soft sound in it.').first().waitFor({ timeout: 15000 });
  await shot('09-back-to-landing', 2500);
  await page.close();
}

try {
  await run('phone', { width: 390, height: 844 });           // iPhone 15 / 16
  await run('phone-se', { width: 375, height: 667 }, { quick: true });     // iPhone SE: the smallest common screen
  await run('phone-android', { width: 360, height: 780 }, { quick: true }); // a small Android phone
  await run('phone-max', { width: 430, height: 932 }, { quick: true });     // a large iPhone
  await run('desktop', { width: 1440, height: 900 });
} finally {
  await browser.close();
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`Saved screenshots to ${out}`);
