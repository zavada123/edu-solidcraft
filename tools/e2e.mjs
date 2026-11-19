// Наскрізна перевірка уроків у справжньому браузері з офіційною збіркою SolidCraft (спершу tools/fetch-solidcraft.sh).
// Проходить кожен урок так, як учень: кліки по підсвічених кнопках, перетягування мишею, введення відповіді.
// Там, де малювати мишею по полотну ненадійно (коло в ескізі), той самий результат дає API редактора.
// Знімки кожного кроку — у shots/. Запуск: node tools/e2e.mjs

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';

const PORT = 8792;
const BASE = `http://localhost:${PORT}/solidcraft/`;
const STEP_TIMEOUT_MS = 20_000;
const VIEWPORT = { width: 1366, height: 768 };
// Масштаб 1: у безголовому Chromium без відеокарти SolidCraft малює полотно в 1x і на екрані з масштабом 2
// збільшує інтерфейс удвічі (так само й без нашої сторінки). На справжній відеокарті це треба перевірити окремо.

// require, а не import: так знаходиться і Playwright, встановлений глобально (NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

mkdirSync('shots', { recursive: true });

const server = await serve(PORT);
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function openLesson(id) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => console.log(`  [page error] ${error.message}`));
  await page.goto(`${BASE}?lesson=${id}&webgl`);
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 240_000 });
  const app = page.frames().find((f) => f.url().includes('/app/'));
  return { page, app };
}

async function waitStep(page, n, total) {
  await page.waitForFunction(
    ([n, total]) => document.querySelector('#step-count')?.textContent === `Крок ${n} з ${total}`,
    [n, total],
    { timeout: STEP_TIMEOUT_MS },
  );
}

async function waitFinished(page) {
  await page.waitForSelector('#finish-box', { state: 'visible', timeout: STEP_TIMEOUT_MS });
}

/** Центр кнопки редактора в координатах сторінки. */
async function handle(page, app, name) {
  const handles = await app.evaluate((n) => window.solidcraft.request('ui.handles', { prefix: n }), name);
  const found = handles.find((h) => h.name === name);
  if (!found) throw new Error(`немає кнопки ${name}`);
  const box = await page.locator('#editor').boundingBox();
  return { x: box.x + found.x, y: box.y + found.y };
}

async function clickHandle(page, app, name) {
  const { x, y } = await handle(page, app, name);
  await page.mouse.click(x, y);
}

/** Рамка підсвітки стоїть над потрібною кнопкою. */
async function assertRingOn(page, app, name) {
  const ring = page.locator(`.hl-ring[data-target="${name}"]`);
  await ring.waitFor({ state: 'visible', timeout: 5000 });
  const box = await ring.boundingBox();
  const target = await handle(page, app, name);
  const dx = Math.abs(box.x + box.width / 2 - target.x);
  const dy = Math.abs(box.y + box.height / 2 - target.y);
  if (dx > 2 || dy > 2) throw new Error(`рамка ${name} зсунута на ${dx}×${dy}`);
}

const shot = (page, name) => page.screenshot({ path: `shots/${name}.png` });
const run = (app, command, params) => app.evaluate(([c, p]) => window.solidcraft.execute(c, p), [command, params]);

async function lessonZnayomstvo() {
  const { page, app } = await openLesson('znayomstvo');
  const total = 4;
  await waitStep(page, 1, total);
  await shot(page, 'znayomstvo-1');
  const box = await page.locator('#editor').boundingBox();
  // Порожнє місце 3D-виду праворуч унизу: не модель (там контекстне меню) і не картка уроку.
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.65, { steps: 12 });
  await page.mouse.up({ button: 'right' });

  await waitStep(page, 2, total);
  await assertRingOn(page, app, 'nav:slot:home');
  await shot(page, 'znayomstvo-2');
  await clickHandle(page, app, 'nav:slot:home');

  await waitStep(page, 3, total);
  await assertRingOn(page, app, 'tab:INSPECT');
  await shot(page, 'znayomstvo-3');
  await clickHandle(page, app, 'tab:INSPECT');
  await page.waitForTimeout(600);
  await assertRingOn(page, app, 'toolbar:inspect.measure');
  await clickHandle(page, app, 'toolbar:inspect.measure');

  await waitStep(page, 4, total);
  await page.fill('#answer', '20');
  await page.click('#check');
  if (!(await page.locator('#step-status').textContent()).startsWith('Ще ні')) throw new Error('хибна відповідь зарахована');
  await page.fill('#answer', '25');
  await shot(page, 'znayomstvo-4');
  await waitFinished(page);
  await shot(page, 'znayomstvo-finish');
  await page.close();
}

async function lessonPidstavka() {
  const { page, app } = await openLesson('pidstavka');
  const total = 6;
  await waitStep(page, 1, total);
  await assertRingOn(page, app, 'toolbar:sketch.create');
  await shot(page, 'pidstavka-1');
  // Прихованих вкладок не видно: у цьому уроці лише «Модель».
  const tabs = await app.evaluate(() => window.solidcraft.request('ui.handles', { prefix: 'tab:' }));
  if (tabs.some((t) => t.name === 'tab:SURFACE')) throw new Error('вкладка «Поверхня» не схована');
  await run(app, 'sketch.create', { plane: 'XY' });

  await waitStep(page, 2, total);
  await assertRingOn(page, app, 'toolbar:sketch.circle.center');
  await shot(page, 'pidstavka-2');
  await run(app, 'sketch.circle.center', { center: [0, 0], radius: 30 });

  await waitStep(page, 3, total);
  await assertRingOn(page, app, 'toolbar:sketch.dimension');
  await shot(page, 'pidstavka-3');
  await run(app, 'sketch.dimension', { entities: ['c1'], type: 'diameter', value: 90 });

  await waitStep(page, 4, total);
  await assertRingOn(page, app, 'toolbar:sketch.finish');
  await shot(page, 'pidstavka-4');
  await clickHandle(page, app, 'toolbar:sketch.finish');

  await waitStep(page, 5, total);
  await assertRingOn(page, app, 'toolbar:solid.extrude');
  await shot(page, 'pidstavka-5');
  await clickHandle(page, app, 'toolbar:solid.extrude');

  await waitStep(page, 6, total);
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');
  await shot(page, 'pidstavka-6');
  try {
    await waitFinished(page);
  } catch {
    // Якщо Enter лише підтвердив поле, натискаємо OK діалогу.
    await page.keyboard.press('Enter');
    await waitFinished(page);
  }
  await shot(page, 'pidstavka-finish');
  await page.close();
}

async function home() {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.goto(BASE);
  await page.waitForSelector('#lesson-list li');
  await shot(page, 'home');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'home-phone');
  await page.close();
}

let failed = false;
for (const [name, fn] of [
  ['список уроків', home],
  ['урок 1', lessonZnayomstvo],
  ['урок 2', lessonPidstavka],
]) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
