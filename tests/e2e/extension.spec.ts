import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { metrics, chart, table, timeline, payload, quadratic } from '../fixtures';
import { elementaryFunctions } from '../elementary-functions';
import { accordion, infoCard, lineChart, pieChart, progress, scatterChart, tabs } from '../p1-fixtures';

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
test.afterEach(async ({}, testInfo) => {
  if (testInfo.title.startsWith('P1') || testInfo.title.startsWith('security hardening')) {
    await selectMode(/Auto/);
    await page.setViewportSize({ width: 1024, height: 1000 });
    await page.goto('https://chat.deepseek.com/');
  }
});

async function showP1(blocks: unknown[]) {
  await selectMode(/Auto/);
  await page.goto('https://chat.deepseek.com/a/chat/s/p1-fixture');
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, payload(blocks));
}

test('security hardening: popup version follows the installed extension manifest', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.json', 'utf8'));
  await expect(popup.locator('.version')).toHaveText(`v${manifest.version}`);
});

test('security hardening: popup CSP blocks network connections before any request leaves', async () => {
  const probe = 'https://chat.deepseek.com/__dsui_local_security_probe';
  const requests: string[] = [];
  // Even the negative control is fulfilled locally; no request reaches the official site.
  await popup.route(probe, async (route) => { requests.push(route.request().url()); await route.fulfill({ body: 'local fixture', headers: { 'access-control-allow-origin': '*' } }); });
  try {
    const result = await popup.evaluate(async (url) => {
      try { await fetch(url); return 'allowed'; } catch { return 'blocked'; }
    }, probe);
    expect(result).toBe('blocked');
    expect(requests).toEqual([]);
  } finally { await popup.unroute(probe); }
});

test('security hardening: activation ignores feedback and hidden submits, then refuses ambiguous send controls', async () => {
  await selectMode(/Auto/);
  await page.goto('https://chat.deepseek.com/a/chat/s/security-send');
  await page.locator('form').evaluate((form) => {
    const feedback = document.createElement('button'); feedback.type = 'submit'; feedback.textContent = 'Send feedback'; feedback.id = 'wrong-submit';
    feedback.addEventListener('click', (event) => { event.preventDefault(); feedback.dataset.clicked = 'true'; });
    const hidden = document.createElement('button'); hidden.type = 'submit'; hidden.setAttribute('aria-label', '发送'); hidden.hidden = true;
    form.prepend(feedback, hidden);
  });
  await page.getByRole('button', { name: '启用 UI', exact: true }).click();
  await expect(page.locator('#sent')).toContainText('<!-- DSUI:v1 -->');
  await expect(page.locator('#wrong-submit')).not.toHaveAttribute('data-clicked');
  await page.goto('https://chat.deepseek.com/a/chat/s/security-ambiguous');
  await page.locator('form').evaluate((form) => {
    const other = document.createElement('button'); other.type = 'button'; other.textContent = '发送消息'; form.prepend(other);
  });
  await expect(page.getByRole('button', { name: '启用 UI', exact: true })).toBeDisabled();
  await expect(page.locator('textarea')).toHaveValue('');
  await expect(page.locator('#sent')).toBeEmpty();
});

test('security hardening: Unicode controls preserve raw source while valid RTL and prototype-named cells remain usable', async () => {
  const unsafe = payload([{ ...infoCard, title: '说明\u202e123' }]);
  await showP1([]);
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, unsafe);
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  await expect(page.locator('#stream')).toBeVisible();
  expect(await page.locator('#stream').textContent()).toBe(unsafe);
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, payload([
    { ...infoCard, title: '👩‍💻 العربية', description: '第一行\n第二行' },
    { id: 'prototype-browser', type: 'data_table', title: '属性名表格', columns: [{ key: 'name', label: '记录' }, { key: 'toString', label: '排序值' }],
      rows: [{ name: '缺失' }, { name: '第二', toString: 'B' }, { name: '第一', toString: 'A' }] },
  ]));
  await expect(page.getByRole('heading', { name: '👩‍💻 العربية', exact: true })).toBeVisible();
  await expect(page.getByText('内容由模型生成，请核实数据。', { exact: true })).toBeVisible();
  const rows = page.getByRole('table', { name: '属性名表格' }).getByRole('row');
  await expect(rows.nth(1).getByRole('cell')).toHaveText(['缺失', '—']);
  const sort = page.getByRole('button', { name: /排序值/ });
  await sort.click(); await sort.click();
  await expect(rows.nth(1).getByRole('cell')).toHaveText(['第二', 'B']);
  await expect(rows.nth(3).getByRole('cell')).toHaveText(['缺失', '—']);
});

test('security hardening: activation never clicks a newly hidden or Stop-identified control', async () => {
  await selectMode(/Auto/);
  for (const boundary of ['hidden', 'stop']) {
    await page.goto(`https://chat.deepseek.com/a/chat/s/security-${boundary}-switch`);
    // The fixture's controlled send action is a div[role=button], matching the official icon control.
    await page.locator('form').evaluate((form, change) => {
      const input = form.querySelector('textarea')!, control = form.querySelector<HTMLElement>('[role="button"]')!;
      const wrapper = document.createElement('div'); control.before(wrapper); wrapper.append(control);
      control.addEventListener('click', () => { control.dataset.clicked = 'true'; });
      input.addEventListener('input', () => {
        if (change === 'hidden') wrapper.style.contentVisibility = 'hidden';
        else control.dataset.testid = 'stop-button';
      });
    }, boundary);
    await page.getByRole('button', { name: '启用 UI', exact: true }).click();
    await expect(page.locator('textarea')).toHaveValue('');
    await expect(page.locator('#sent')).toBeEmpty();
    await expect(page.locator('form [role="button"]')).not.toHaveAttribute('data-clicked');
  }
});

test('security hardening: complete subdivision emoji flags render while stray hidden tags preserve raw source', async () => {
  const title = '英格兰\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
  await showP1([{ ...infoCard, title }]);
  const heading = page.getByRole('heading', { name: /英格兰/ });
  await expect(heading).toBeVisible();
  expect(await heading.textContent()).toBe(title);
  const unsafe = payload([{ ...infoCard, title: '隐藏\u{E0067}文字' }]);
  await page.locator('#stream').evaluate((node, source) => { node.textContent = source; }, unsafe);
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  expect(await page.locator('#stream').textContent()).toBe(unsafe);
});

test('P1 charts render real SVG, preserve line gaps and expose exact values without invented empty samples', async ({}, testInfo) => {
  const errors: string[] = [];
  const onError = (error: Error) => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    await showP1([lineChart, pieChart, scatterChart]);
    await expect(page.locator('[data-dsui-host]')).toHaveCount(1);
    await expect(page.locator('.recharts-line')).toHaveCount(2);
    await expect(page.locator('.recharts-line-dots')).toHaveCount(2);
    await expect(page.locator('.recharts-line-dots').nth(0).locator('.recharts-line-dot')).toHaveCount(3);
    const missingSeries = page.locator('.recharts-line').nth(1);
    await expect(page.locator('.recharts-line-dots').nth(1).locator('.recharts-line-dot')).toHaveCount(2);
    expect(await page.locator('.recharts-line-dot').evaluateAll((dots) => dots.every((dot) => getComputedStyle(dot).strokeDasharray === 'none'))).toBe(true);
    for (const path of await missingSeries.locator('.recharts-line-curve').all()) {
      expect(await path.getAttribute('d')).not.toMatch(/[LlCcSsQqTt]/); // Two isolated samples cannot form a segment across the missing day.
    }
    await expect(page.locator('.recharts-pie-sector')).toHaveCount(2);
    await expect(page.locator('.recharts-scatter-symbol')).toHaveCount(2);
    for (const summary of await page.getByText('查看数据', { exact: true }).all()) await summary.click();
    const lineRows = page.getByRole('table', { name: '每周趋势原始数据' }).getByRole('row');
    await expect(lineRows.nth(2).getByRole('cell')).toHaveText(['周二', '15', '—']);
    const scatterRows = page.getByRole('table', { name: '实验坐标原始数据' }).getByRole('row');
    await expect(scatterRows.nth(1).getByRole('cell')).toHaveText(['样本 A', '-3', '4']);
    expect(await page.locator('[data-dsui-host] svg path').evaluateAll((paths) => paths.every((path) => !/NaN|Infinity/.test(path.getAttribute('d') ?? '')))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('p1-charts-light.png'), fullPage: true });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.locator('html').evaluate((node) => node.classList.add('dark'));
    await expect(page.locator('[data-dsui-host]')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.locator('.dsui-root').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('p1-charts-dark-mobile.png'), fullPage: true });
    await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, payload([
      { ...lineChart, items: [{ label: '缺失', values: { alpha: null, beta: null } }] },
      { ...pieChart, items: [{ label: '零值', value: 0 }] }, { ...scatterChart, items: [] },
    ]));
    await expect(page.locator('[data-dsui-host]').getByRole('status')).toHaveCount(3);
    await expect(page.locator('.recharts-line,.recharts-pie-sector,.recharts-scatter-symbol')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { page.off('pageerror', onError); }
});

test('P1 charts render finite subnormal values without failing the whole reply', async () => {
  // Smallest positive JS number is valid protocol data; dividing the span into nice ticks can underflow.
  for (const [a, b] of [[-Number.MIN_VALUE, 0], [Number.MIN_VALUE, Number.MIN_VALUE],
    [-Number.MIN_VALUE, Number.MIN_VALUE], [1e-301, 1.0000000000000002e-301], [0, Number.MIN_VALUE]]) {
    await showP1([
      { ...lineChart, series: [{ key: 'a', label: 'A' }], items: [
        { label: '零', values: { a } }, { label: '最小正数', values: { a: b } },
      ] },
      { ...pieChart, items: [{ label: '最小正数', value: Number.MIN_VALUE }] },
      { ...scatterChart, items: [{ x: a, y: a }, { x: b, y: b }] },
    ]);
    await expect(page.locator('[data-dsui-host]')).toHaveCount(1);
    await expect(page.locator('.recharts-surface')).toHaveCount(3);
    await expect(page.locator('.recharts-line-dot')).toHaveCount(2);
    await expect(page.locator('.recharts-pie-sector')).toHaveCount(1);
    await expect(page.locator('.recharts-scatter-symbol')).toHaveCount(2);
    if (a !== b) {
      const y = await page.locator('.recharts-line-dot').evaluateAll((dots) => dots.map((dot) => Number(dot.getAttribute('cy'))));
      expect(y[1]).toBeLessThan(y[0]); // Distinct values must remain distinct on screen, even at the smallest scale.
    }
    expect(await page.locator('[data-dsui-host] svg *').evaluateAll((nodes) => nodes.every((node) =>
      [...node.attributes].every((attribute) => !/NaN|Infinity/.test(attribute.value))))).toBe(true);
  }
  for (const summary of await page.getByText('查看数据', { exact: true }).all()) await summary.click();
  const smallest = '5e-324';
  await expect(page.getByRole('table', { name: '每周趋势原始数据' }).getByRole('row').nth(2).getByRole('cell')).toHaveText(['最小正数', smallest]);
  await expect(page.getByRole('table', { name: '实验坐标原始数据' }).getByRole('row').nth(2).getByRole('cell')).toHaveText(['数据点 2', smallest, smallest]);
});

test('P1 panels support keyboard/touch, preserve visited state and whitespace streams, and keep cards inert', async ({}, testInfo) => {
  const literal = '<img src=x onerror=alert(1)>';
  const interactiveTabs = { ...tabs, items: [
    { ...tabs.items[0], blocks: [lineChart, { ...table, id: 'nested-table' }] },
    { ...tabs.items[1], blocks: [{ ...infoCard, description: literal }, progress] },
  ] };
  await showP1([interactiveTabs, accordion]);
  const trend = page.getByRole('tab', { name: '趋势', exact: true });
  const summary = page.getByRole('tab', { name: '摘要', exact: true });
  await expect(trend).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: /得分/ }).click();
  await page.getByRole('button', { name: /得分/ }).click();
  const rows = page.getByRole('table', { name: '对比详情', exact: true }).getByRole('row');
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('A');
  await trend.focus();
  await trend.press('ArrowRight');
  await expect(summary).toBeFocused();
  await expect(page.getByRole('progressbar', { name: '开发进度' })).toHaveAttribute('value', '72.5');
  await expect(page.getByText(literal, { exact: true })).toBeVisible();
  await expect(page.locator('[data-dsui-host]').locator('img,script,iframe')).toHaveCount(0);
  await page.locator('#stream').evaluate((node) => { node.textContent += '\n '; });
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await summary.press('Home');
  await expect(trend).toBeFocused();
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('A');
  const coordinates = page.getByRole('button', { name: '坐标明细', exact: true });
  await coordinates.focus();
  await coordinates.press('Enter');
  await expect(coordinates).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('img', { name: /实验坐标/ })).toBeVisible();
  await coordinates.press('Space');
  await expect(coordinates).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('img', { name: /实验坐标/ })).toBeHidden();
  await page.setViewportSize({ width: 360, height: 900 });
  await page.locator('html').evaluate((node) => node.classList.add('dark'));
  await summary.tap();
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('progressbar', { name: '开发进度' })).toBeVisible();
  await expect.poll(() => page.locator('.dsui-root').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('p1-panels-dark-mobile.png'), fullPage: true });
  await selectMode(/^Off/);
  await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  await expect(page.locator('#stream')).toBeVisible();
});

test('P1 reply budgets include nested blocks across separate code fences', async () => {
  await selectMode(/^Off/);
  await page.goto('https://chat.deepseek.com/a/chat/s/p1-budget');
  const group = (id: string, count: number) => ({ id, type: 'tabs', title: id, items: Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, label: `${i}`, blocks: [{ ...infoCard, id: `${id}-${i}` }],
  })) });
  const sources = [payload([group('first-group', 6)]), payload([group('second-group', 4)]), payload([progress])];
  await page.evaluate((texts) => {
    document.querySelector('#stream')!.textContent = texts[0];
    for (let i = 1; i < texts.length; i++) {
      const wrapper = document.createElement('div'); wrapper.className = 'md-code-block';
      const banner = document.createElement('div'); banner.className = 'md-code-block-banner';
      const language = document.createElement('span'); language.textContent = 'dsui'; banner.append(language);
      const pre = document.createElement('pre'); pre.id = `budget-extra-${i}`;
      const code = document.createElement('span'); code.textContent = texts[i]; pre.append(code);
      wrapper.append(banner, pre); document.querySelector('#first .ds-markdown')!.append(wrapper);
    }
  }, sources);
  await selectMode(/Auto/);
  await expect(page.locator('[data-dsui-host]')).toHaveCount(2);
  await expect(page.locator('#stream')).toBeHidden();
  await expect(page.locator('#budget-extra-1')).toBeHidden();
  await expect(page.locator('#budget-extra-2')).toBeVisible();
});

test('P1 invalid or partial nested payloads retain the original source and cannot bypass reply budgets', async () => {
  await showP1([]);
  const invalid = [
    { ...tabs, items: [{ ...tabs.items[0], blocks: [accordion] }] },
    { ...tabs, items: [{ ...tabs.items[0], blocks: [infoCard, infoCard] }] },
    { ...progress, value: 101 }, { ...pieChart, items: [{ label: '负值', value: -1 }] },
    { ...infoCard, html: '<script>alert(1)</script>' },
    { ...tabs, items: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, label: `${i}`, blocks: [
      { ...infoCard, id: `info-${i}` }, { ...progress, id: `progress-${i}` },
    ] })) },
  ];
  for (const source of invalid) {
    await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, payload([source]));
    await expect(page.locator('#stream')).toBeVisible();
    await expect(page.locator('[data-dsui-host]')).toHaveCount(0);
  }
  const complete = payload([tabs]);
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, complete.slice(0, -2));
  await expect(page.locator('#stream')).toBeVisible();
  await page.locator('#stream').evaluate((node, text) => { node.textContent = text; }, complete);
  await expect(page.getByRole('tab', { name: '趋势', exact: true })).toBeVisible();
});

test('P1 nested function plots retain slider state and resize after their tab is reopened', async () => {
  await showP1([{ ...tabs, items: [{ ...tabs.items[0], blocks: [quadratic] }, { ...tabs.items[1], blocks: [infoCard] }] }]);
  const slider = page.getByRole('slider', { name: 'a', exact: true });
  await expect(slider).toHaveValue('1');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('1.1');
  await page.getByRole('tab', { name: '摘要', exact: true }).click();
  await expect(slider).toBeHidden();
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('tab', { name: '趋势', exact: true }).tap();
  await expect(slider).toHaveValue('1.1');
  await expect.poll(() => page.locator('.plot-canvas svg').first().evaluate((svg) => svg.getBoundingClientRect().width <= svg.parentElement!.getBoundingClientRect().width + 1)).toBe(true);
  await expect(page.locator('.plot-canvas path.line')).not.toHaveAttribute('d', /NaN|Infinity/);
});

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
