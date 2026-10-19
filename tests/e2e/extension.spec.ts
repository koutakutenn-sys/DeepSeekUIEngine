import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { metrics, chart, table, timeline, payload, quadratic } from '../fixtures';
import { elementaryFunctions } from '../elementary-functions';

const fixture = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>DeepSeek DOM test fixture</title>
<style>
*{box-sizing:border-box} body{margin:0;background:#fff;color:#20242c;font:14px/1.8 system-ui} main{max-width:760px;margin:auto;padding:32px 20px} .kicker{color:#89909d;font-size:11px;letter-spacing:.15em}h1{font-size:24px;font-weight:550;margin:5px 0 24px}article{margin:24px 0}.ds-markdown>p{color:#747c8a}.ds-code-block{display:block}form{margin:24px 0;display:flex;gap:10px}textarea{flex:1;min-width:0;border:1px solid #e1e5ed;border-radius:12px;padding:14px;font:inherit}button{border:0;border-radius:10px;padding:10px 16px;background:#4d6bfe;color:white;cursor:pointer}.dark body{background:#191a1f;color:#edeef2}pre{white-space:pre-wrap;overflow-wrap:anywhere}#sent{font-size:11px;max-height:150px;overflow:auto}
</style></head><body><main><div class="kicker">DEEPSEEK UI ENGINE · LOCAL TEST</div><h1>信息，以更清晰的方式呈现。</h1>
<article class="ds-message" id="first"><div class="ds-markdown ds-assistant-message-main-content"><p>这是根据你提供的数据整理的概览。</p><div class="md-code-block md-code-block-light"><div class="md-code-block-banner-wrap"><div class="md-code-block-banner"><div><span>dsui</span></div><div role="button"><span>复制</span></div></div></div><pre><span id="stream"></span></pre></div></div></article>
<article class="ds-message" id="second"><div class="ds-markdown ds-assistant-message-main-content"><p>接下来是项目的推进计划。</p><div class="md-code-block"><div class="md-code-block-banner"><span>json</span></div><pre><span id="timeline"></span></pre></div></div></article>
<article class="ds-message"><div class="user-content">{"protocol":"dsui","version":1,"blocks":[]}</div></article>
<div id="composer-fixture"></div></main><script src="/__fixture.js"></script></body></html>`;

let context: BrowserContext;
let page: Page;
let popup: Page;

async function selectMode(name: RegExp) {
  const radio = popup.getByRole('radio', { name });
  await expect(radio).toBeEnabled();
  // The popup confirms the controlled radio only after asynchronous storage writes.
  if (!await radio.isChecked()) await radio.click();
  await expect(radio).toBeChecked();
}

test.beforeAll(async () => {
  const extension = resolve('dist');
  context = await chromium.launchPersistentContext(resolve(`.cache/e2e-profiles/run-${Date.now()}`), {
    channel: 'chromium', headless: true, hasTouch: true, timeout: 15_000, viewport: { width: 1024, height: 1000 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  page = await context.newPage();
  await page.route('https://chat.deepseek.com/**', async (route) => {
    if (route.request().url().endsWith('/__fixture.js')) {
      await route.fulfill({ contentType: 'application/javascript', body: await readFile('.cache/e2e-fixture/composer.js', 'utf8') });
    } else {
      const body = route.request().url().endsWith('/a/chat/s/seeded')
        ? fixture.replace('<div class="user-content">', '<div class="user-content">&lt;!-- DSUI:v1 --&gt;会话格式说明&lt;!-- /DSUI --&gt;') : fixture;
      await route.fulfill({ contentType: 'text/html', body });
    }
  });
  const session = await context.newCDPSession(page);
  const contexts: { id: number; name: string }[] = [];
  session.on('Runtime.executionContextCreated', ({ context: execution }) => { contexts.push(execution); });
  await session.send('Runtime.enable');
  await page.goto('https://chat.deepseek.com/');
  let extensionId = '';
  await expect.poll(async () => {
    for (const execution of contexts) {
      try {
        const result = await session.send('Runtime.evaluate', { contextId: execution.id,
          expression: 'globalThis.chrome?.runtime?.id', returnByValue: true });
        if (typeof result.result.value === 'string') extensionId = result.result.value;
      } catch { /* Navigation invalidates older execution contexts. */ }
    }
    return extensionId;
  }).toMatch(/^[a-p]{32}$/);
  popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 560 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('radio', { name: /Auto/ })).toBeEnabled();
  await selectMode(/Auto/);
});

test.afterAll(async () => { await context?.close(); });

test('loads the actual MV3 extension, renders four components, updates streams and restores Off', async ({}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  await page.locator('#stream').evaluate((node) => { node.textContent = '{"protocol":"dsui",'; });
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, payload([metrics, chart, table]));
  await page.locator('#timeline').evaluate((node, text) => { node.textContent = text; }, payload([timeline]));
  await expect(page.locator('[data-dsui-host]')).toHaveCount(2);
  await expect(page.locator('#stream')).not.toBeVisible();
  await expect(page.getByText('1,280', { exact: false })).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(2);
  await page.getByRole('button', { name: /得分/ }).click();
  await page.getByRole('button', { name: /得分/ }).click();
  const tableRows = page.getByRole('table', { name: '对比详情', exact: true }).getByRole('row');
  await expect(tableRows.nth(1).getByRole('cell').first()).toHaveText('A');
  await page.getByText('调研', { exact: true }).click();
  await expect(page.getByText('整理需求与使用场景', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('light.png'), fullPage: true });
  await page.locator('html').evaluate((node) => node.classList.add('dark'));
  await expect(page.locator('[data-dsui-host]').first()).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dark-mobile.png'), fullPage: true });
  await selectMode(/Off/);
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  await expect(page.locator('#stream')).toBeVisible();
  await selectMode(/Force/);
  await expect(page.locator('[data-dsui-host]')).toHaveCount(2);
  await page.locator('#stream').evaluate((node) => { node.textContent += 'invalid'; });
  await expect(page.locator('[data-dsui-host]')).toHaveCount(1);
  await expect(page.locator('#stream')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  await expect(popup.getByRole('radio', { name: /Force/ })).toBeChecked();
  expect(errors).toEqual([]);
  await popup.screenshot({ path: testInfo.outputPath('popup.png') });
});

test('activates only by its button, preserves drafts, and leaves ordinary chat verbatim', async ({}, testInfo) => {
  await page.goto('https://chat.deepseek.com/');
  const input = page.getByRole('textbox', { name: '消息' });
  await selectMode(/Auto/);
  const enable = page.getByRole('button', { name: '启用 UI', exact: true });
  await expect(enable).toBeEnabled();
  await input.fill('尚未发送的草稿');
  await expect(enable).toBeDisabled();
  await expect(input).toHaveValue('尚未发送的草稿');
  await input.fill('');
  await expect(enable).toBeEnabled();
  await input.fill('比较这两组数据');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('比较这两组数据');
  await enable.click();
  await expect(page.locator('#sent')).toContainText('为当前会话启用 UI');
  await expect(page.locator('#sent')).toContainText('<!-- DSUI:v1 -->');
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'UI 已启用', exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('manual-enabled.png'), fullPage: true });
  await input.fill('再给一个表格');
  await page.locator('[role="button"].ds-button--primary.ds-button--circle').click();
  await expect(page.locator('#sent')).toHaveText('再给一个表格');
  await selectMode(/Force/);
  await input.fill('继续展示图表');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('继续展示图表');
  await selectMode(/Off/);
  await expect(page.locator('[data-dsui-activation-host]')).toHaveCount(0);
  await input.fill('普通聊天');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('普通聊天');
  await input.fill('换行草稿');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('换行草稿\n');
});

test('tracks manual activation across assigned IDs, new chats, and loaded history after refresh', async () => {
  await selectMode(/Auto/);
  await page.goto('https://chat.deepseek.com/');
  const input = page.getByRole('textbox', { name: '消息' });
  await page.getByRole('button', { name: '启用 UI', exact: true }).click();
  await expect(page.locator('#sent')).toContainText('<!-- DSUI:v1 -->');
  await expect(page.getByRole('button', { name: 'UI 已启用', exact: true })).toBeDisabled();
  await page.evaluate(() => { history.replaceState(null, '', '/a/chat/s/created'); });
  await expect(page.getByRole('button', { name: 'UI 已启用', exact: true })).toBeDisabled();
  await input.fill('继续用柱状图展示');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('继续用柱状图展示');
  await page.evaluate(() => { history.replaceState(null, '', '/'); });
  await expect(page.getByRole('button', { name: '启用 UI', exact: true })).toBeEnabled();
  await input.fill('另一个新会话的柱状图');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('另一个新会话的柱状图');
  await page.goto('https://chat.deepseek.com/a/chat/s/seeded');
  await expect(page.getByRole('button', { name: 'UI 已启用', exact: true })).toBeDisabled();
  await input.fill('刷新前的图表请求');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('刷新前的图表请求');
  await page.reload();
  await expect(page.getByRole('button', { name: 'UI 已启用', exact: true })).toBeDisabled();
  await input.fill('刷新后的图表请求');
  await input.press('Enter');
  await expect(page.locator('#sent')).toHaveText('刷新后的图表请求');
  // The URL changes before React clears the previous conversation's messages.
  await page.evaluate(() => { history.replaceState(null, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.locator('.user-content').evaluate((node) => { node.textContent = ''; });
  await expect(page.getByRole('button', { name: '启用 UI', exact: true })).toBeEnabled();
});

test('quadratic plot stays local through keyboard, mouse, theme, resize and raw fallback', async ({}, testInfo) => {
  await selectMode(/Auto/);
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto('https://chat.deepseek.com/');
  const source = page.locator('#stream');
  for (const text of ['{"protocol":"dsui",', payload([{ ...quadratic, expression: 'alert(1)' }]),
    payload([{ ...quadratic, viewport: { ...quadratic.viewport, xMax: -8 } }]), payload([quadratic]) + ' '.repeat(100000)]) {
    await source.evaluate((node, text) => { node.textContent = text; }, text);
    await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
    await expect(source).toBeVisible();
  }
  await source.evaluate((node, text) => { node.textContent = text; }, payload([quadratic]));
  const plot = page.getByRole('application', { name: /函数坐标系/ });
  await expect(plot).toBeVisible();
  await expect(page.locator('.plot-formula')).toHaveText('y = x²');
  await page.screenshot({ path: testInfo.outputPath('function-plot-light-desktop.png'), fullPage: true });
  await page.locator('[data-dsui-host]').evaluate((node) => { (window as unknown as { plotHost: Element }).plotHost = node; });
  const requests: string[] = []; const errors: string[] = [];
  const requestListener = (request: { url(): string }) => requests.push(request.url());
  const errorListener = (error: Error) => errors.push(error.message);
  page.on('request', requestListener); page.on('pageerror', errorListener);
  try {
    const a = page.getByRole('slider', { name: 'a', exact: true });
    await a.focus(); await a.press('Home');
    await expect(page.locator('.plot-formula')).toHaveText('y = −5x²');
    await a.press('End'); await expect(a).toHaveValue('5');
    await a.press('ArrowLeft'); await expect(a).toHaveValue('4.9');
    for (const name of ['b', 'c']) {
      const slider = page.getByRole('slider', { name, exact: true });
      await slider.focus(); await slider.press('Home'); await expect(slider).toHaveValue('-10');
      await slider.press('End'); await expect(slider).toHaveValue('10');
    }
    await page.getByRole('button', { name: '复位参数', exact: true }).click();
    await a.focus(); for (let i = 0; i < 10; i++) await a.press('ArrowLeft');
    await expect(page.locator('.plot-formula')).toHaveText('y = 0');
    await expect(page.locator('.plot-description')).toContainText('水平直线');
    await page.getByRole('slider', { name: 'b', exact: true }).press('ArrowRight');
    await expect(page.locator('.plot-formula')).toHaveText('y = 0.5x');
    await source.evaluate((node) => { node.textContent += '\n '; });
    await expect(page.locator('.source-disclosure pre')).toHaveText(payload([quadratic]));
    await expect(page.locator('.plot-formula')).toHaveText('y = 0.5x');
    await page.getByRole('button', { name: '复位参数', exact: true }).click();
    const range = page.locator('.plot-range'); const initial = await range.textContent();
    await plot.hover(); await page.mouse.wheel(0, -250);
    await expect(range).not.toHaveText(initial!);
    await page.getByRole('button', { name: '复位视口', exact: true }).click();
    await expect(range).toHaveText(initial!);
    const box = (await plot.boundingBox())!;
    await page.mouse.move(box.x + 150, box.y + 100); await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 130, { steps: 8 }); await page.mouse.up();
    await expect(range).not.toHaveText(initial!);
    await plot.focus(); await plot.press('Home'); await expect(range).toHaveText(initial!);
    await page.locator('html').evaluate((node) => node.classList.add('dark'));
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(page.locator('[data-dsui-host]')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(async () => Number(await plot.locator('svg').getAttribute('width'))).toBeLessThan(box.width);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.plot-formula')).toHaveText('y = x²');
    expect(await page.locator('[data-dsui-host]').evaluate((node) => (window as unknown as { plotHost: Element }).plotHost === node)).toBe(true);
    await expect(page.locator('[data-plot-curve]')).not.toHaveAttribute('d', /NaN|Infinity/);
    await page.screenshot({ path: testInfo.outputPath('function-plot-dark-mobile.png'), fullPage: true });
    await page.getByText('查看原始 DSUI', { exact: true }).click();
    await expect(page.locator('.source-disclosure pre')).toHaveText(payload([quadratic]));
    expect(requests).toEqual([]); expect(errors).toEqual([]);
    await selectMode(/Off/);
    await expect(page.locator('[data-dsui-host]')).toHaveCount(0); await expect(source).toBeVisible();
    await selectMode(/Auto/);
    await expect(plot).toBeVisible();
    await source.evaluate((node) => { node.textContent += 'invalid'; });
    await expect(page.locator('[data-dsui-host]')).toHaveCount(0); await expect(source).toBeVisible();
    await page.locator('#first .md-code-block').evaluate((node, text) => {
      const replacement = document.createElement('pre'); const code = document.createElement('code');
      code.className = 'language-dsui'; code.textContent = text; replacement.append(code); node.replaceWith(replacement);
    }, payload([quadratic]));
    await expect(plot).toBeVisible(); await expect(page.locator('[data-dsui-host]')).toHaveCount(1);
  } finally { page.off('request', requestListener); page.off('pageerror', errorListener); }
});

test('quadratic plot contains touch drag and pinch gestures without scrolling the page', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://chat.deepseek.com/');
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, payload([quadratic]));
  const plot = page.getByRole('application', { name: /函数坐标系/ });
  await expect(plot).toBeVisible(); await expect(plot).toHaveCSS('touch-action', 'none');
  await plot.scrollIntoViewIfNeeded();
  const box = (await plot.boundingBox())!;
  const range = page.locator('.plot-range'); const initial = await range.textContent();
  const scroll = await page.evaluate(() => scrollY);
  const cdp = await context.newCDPSession(page);
  const point = (id: number, dx: number, dy = 120) => ({ id, x: box.x + dx, y: box.y + dy });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0, 100)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(0, 140, 150)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(range).not.toHaveText(initial!);
  const dragged = await range.textContent();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0, 90), point(1, 170)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(0, 60), point(1, 200)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(range).not.toHaveText(dragged!);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await expect(page.locator('[data-plot-curve]')).not.toHaveAttribute('d', /NaN|Infinity/);
  const a = page.getByRole('slider', { name: 'a', exact: true });
  await a.scrollIntoViewIfNeeded();
  const sliderBox = (await a.boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: sliderBox.x + sliderBox.width * 0.8, y: sliderBox.y + sliderBox.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(a).not.toHaveValue('1');
  await page.getByRole('button', { name: '复位参数', exact: true }).click();
  await a.click({ position: { x: sliderBox.width * 0.25, y: sliderBox.height / 2 } });
  await expect(a).not.toHaveValue('1');
  await page.getByRole('button', { name: '复位参数', exact: true }).click();
  await expect(a).toHaveValue('1');
  await cdp.detach();
});

test('function-plot renders 32 elementary expressions with correct samples and domain gaps in MV3', async ({}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto('https://chat.deepseek.com/');
  const errors: string[] = []; const requests: string[] = [];
  const onError = (error: Error) => errors.push(error.message);
  const onRequest = (request: { url(): string }) => requests.push(request.url());
  page.on('pageerror', onError); page.on('request', onRequest);
  const source = page.locator('#stream');
  const show = async (expression: string, x = 0, y = 0) => {
    await source.evaluate((node, text) => { node.textContent = text; }, payload([{ ...quadratic,
      title: '初等函数图像', preset: 'expression', expression, parameters: [],
      viewport: { xMin: Math.min(-4, x - 2), xMax: Math.max(4, x + 2), yMin: Math.min(-4, y - 2), yMax: Math.max(4, y + 2) } }]));
    await expect(page.locator('.plot-formula')).toHaveText(`y = ${expression}`);
    const curve = page.locator('[data-plot-curve]');
    await expect(curve).toHaveAttribute('d', /M .+ v /);
    await expect(curve).not.toHaveAttribute('d', /NaN|Infinity/);
    return curve;
  };
  try {
    for (const [expression, x, y] of elementaryFunctions) {
      const curve = await show(expression, x, y);
      // Inspect actual SVG pixels. MV3 correctly isolates D3's __data__ from the page.
      const containsPoint = await curve.evaluate((node, { x, y }) => {
        const svg = (node as SVGPathElement).ownerSVGElement!;
        const canvas = svg.querySelector('.zoom-and-drag')!;
        const width = Number(canvas.getAttribute('width')); const height = Number(canvas.getAttribute('height'));
        const xMin = Math.min(-4, x - 2); const xMax = Math.max(4, x + 2);
        const yMin = Math.min(-4, y - 2); const yMax = Math.max(4, y + 2);
        const px = (x - xMin) / (xMax - xMin) * width; const py = (yMax - y) / (yMax - yMin) * height;
        const halfWidth = Number(node.getAttribute('stroke-width')) / 2;
        const segments = [...node.getAttribute('d')!.matchAll(/M\s+(\S+)\s+(\S+)\s+v\s+(\S+)/g)];
        const contains = (pixelY: number) => segments.some(([, sx, sy, length]) => Math.abs(Number(sx) - px) <= halfWidth + 0.01
          && pixelY >= Number(sy) - 0.1 && pixelY <= Number(sy) + Number(length) + 0.1);
        return { correct: contains(py), shifted: contains(py - height / (yMax - yMin)) };
      }, { x, y });
      expect(containsPoint.correct, `${expression} passes through (${x}, ${y})`).toBe(true);
      if (expression === 'x') expect(containsPoint.shifted, 'negative control: y=x must not pass through (2,3)').toBe(false);
    }
    const hole = await show('sqrt(x^2-1)');
    expect(await hole.evaluate((node) => {
      const width = Number((node as SVGPathElement).ownerSVGElement!.querySelector('.zoom-and-drag')!.getAttribute('width'));
      return [...node.getAttribute('d')!.matchAll(/M\s+(\S+)\s+(\S+)\s+v\s+(\S+)/g)]
        .some(([, sx]) => Math.abs(Number(sx) / width * 8 - 4) < 0.9);
    })).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('elementary-domain-gap.png'), fullPage: true });
    const pole = await show('1/x');
    expect(await pole.evaluate((node) => {
      const height = Number((node as SVGPathElement).ownerSVGElement!.querySelector('.zoom-and-drag')!.getAttribute('height'));
      return [...node.getAttribute('d')!.matchAll(/M\s+(\S+)\s+(\S+)\s+v\s+(\S+)/g)]
        .some(([, , sy, length]) => Number(sy) <= 0 && Number(length) >= height);
    })).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('elementary-reciprocal.png'), fullPage: true });
    for (const expression of ['exp(1000)', '-exp(1000)', 'sinh(1000)', '1e308*1e308']) {
      await source.evaluate((node, text) => { node.textContent = text; }, payload([{ ...quadratic,
        preset: 'expression', expression, parameters: [] }]));
      await expect(page.locator('.plot-formula')).toHaveText(`y = ${expression}`);
      await expect(page.locator('[data-plot-curve]')).toHaveAttribute('d', '');
      await expect(page.getByText(/当前视口内没有可见曲线/)).toBeVisible();
    }
    // Invalid expressions restore raw source rather than becoming executable code.
    await source.evaluate((node, text) => { node.textContent = text; }, payload([{ ...quadratic,
      preset: 'expression', expression: 'x.constructor', parameters: [] }]));
    await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
    await expect(source).toBeVisible();
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally { page.off('pageerror', onError); page.off('request', onRequest); }
});
