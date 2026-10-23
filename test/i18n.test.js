import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { messages, normalizeLanguage, resolveLanguage, translate, localizeError, localizeWarning, localizeFeature } from '../dist/i18n.js';

test('Chinese and English cover the same messages and interpolation values', async () => {
  assert.deepEqual(Object.keys(messages.zh).sort(), Object.keys(messages.en).sort());
  for (const key of Object.keys(messages.en)) {
    const placeholders = language => [...messages[language][key].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders('zh'), placeholders('en'), key);
  }
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const [, key] of html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)) {
    assert.equal(typeof messages.en[key], 'string', key);
  }
});

test('explicit links override saved language, which overrides browser preferences', () => {
  assert.equal(resolveLanguage({ query: 'zh-CN', saved: 'en', languages: ['en-US'] }), 'zh');
  assert.equal(resolveLanguage({ saved: 'en', languages: ['zh-CN'] }), 'en');
  assert.equal(resolveLanguage({ query: 'invalid', saved: 'invalid', languages: ['fr-FR', 'zh-TW', 'en-US'] }), 'zh');
  assert.equal(resolveLanguage({ languages: ['fr-FR'] }), 'en');
  assert.equal(resolveLanguage(), 'en');
  assert.equal(normalizeLanguage(null), null);
  assert.equal(normalizeLanguage('EN_us'), 'en');
});

test('interpolation preserves source text and does not recursively replace it', () => {
  assert.equal(translate('zh', 'keywords', { query: 'online {query} editor <tag>' }), '搜索关键词：online {query} editor <tag>');
  assert.equal(translate('en', 'page', { page: 2 }), 'Page 2');
  assert.throws(() => translate('en', 'missingTranslation'), /Unknown translation/);
});

test('structured errors and upstream warnings are readable in both languages', () => {
  assert.match(localizeError('zh', 'RATE_LIMITED'), /一分钟/);
  assert.match(localizeError('en', 'RATE_LIMITED'), /minute/);
  assert.match(localizeError('zh', 'README_NOT_FOUND'), /未找到 README/);
  assert.equal(localizeError('zh', 'UNRECOGNIZED_ERROR'), messages.zh.errorUnavailable);
  assert.equal(localizeWarning('zh', 'README sources could not be loaded for 2 of 5 repositories. Repository metadata is still available.'), '5 个项目中有 2 个暂时无法加载 README，仓库信息仍可查看。');
  assert.equal(localizeWarning('en', 'Shorter keywords were used to find relevant web pages.'), messages.en.warningShorter);
  assert.equal(localizeFeature('zh', 'Offline use'), '离线使用');
  assert.equal(localizeFeature('en', 'Offline use'), 'Offline use');
});
