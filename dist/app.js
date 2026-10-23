import { resolveLanguage, normalizeLanguage, translate, localizeFeature, localizeWarning, localizeError } from './i18n.js?v=1.2.0';

(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const input = $('#search-input');
  const button = $('#search-button');
  const list = $('#result-list');
  let controller;
  let requestId = 0;
  let currentQuery = '';
  let currentPage = 1;
  let currentSource = 'github';
  let savedLanguage;
  try { savedLanguage = localStorage.getItem('openseek-language'); } catch { /* Storage is optional. */ }
  let language = resolveLanguage({ query: new URL(location.href).searchParams.get('lang'), saved: savedLanguage, languages: navigator.languages || [navigator.language] });
  let view = 'home';
  let lastData = null;
  let lastErrorCode = null;
  let toastKey = null;
  const t = (key, values) => translate(language, key, values);
  const locale = () => language === 'zh' ? 'zh-CN' : 'en-US';

  function localize(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel)); });
  }

  function applyLanguage(next, remember = false) {
    language = normalizeLanguage(next) || language;
    document.documentElement.lang = locale();
    document.querySelectorAll('[data-language]').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.language === language)));
    if (remember) {
      try { localStorage.setItem('openseek-language', language); } catch { /* The switch works without storage. */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(null, '', url);
    }
    localize();
    $('meta[name="description"]').content = t('metaDescription');
    updateMode(currentSource);
    updateThemeButton();
    updateView();
    if (toastKey) $('#toast').textContent = t(toastKey);
  }

  function updateMode(source) {
    currentSource = source;
    const web = source === 'web';
    document.querySelectorAll('[data-source]').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.source === source)));
    document.querySelectorAll('[data-suggestion]').forEach(suggestion => { suggestion.hidden = suggestion.dataset.suggestionSource !== source; });
    $('#intro p').textContent = t(web ? 'webIntro' : 'githubIntro');
    input.placeholder = t(web ? 'webPlaceholder' : 'githubPlaceholder');
    const searchLabel = t(web ? 'webSearchLabel' : 'githubSearchLabel');
    $('label[for="search-input"]').textContent = searchLabel;
    $('#search-form').setAttribute('aria-label', searchLabel);
    button.textContent = t('search');
    $('#loading-state h3').textContent = t(web ? 'webLoading' : 'githubLoading');
    $('#loading-state p').textContent = t(web ? 'webLoadingDescription' : 'githubLoadingDescription');
    $('#empty-state h3').textContent = t(web ? 'webEmpty' : 'githubEmpty');
    $('#empty-state p').textContent = t(web ? 'webEmptyDescription' : 'githubEmptyDescription');
    $('.results-note').textContent = t(web ? 'webNote' : 'githubNote');
  }

  function createWebCard(item, index, provider) {
    let href;
    try {
      const url = new URL(item.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
      href = url.href;
    } catch { return null; }
    const card = $('#web-result-template').content.firstElementChild.cloneNode(true);
    localize(card);
    const domain = new URL(href).hostname.replace(/^www\./, '');
    card.querySelector('.website-monogram').textContent = domain.charAt(0).toUpperCase();
    card.querySelector('.website-domain').textContent = domain;
    card.querySelector('.result-rank').textContent = `#${index + 1}`;
    const title = card.querySelector('.website-title');
    title.textContent = item.title;
    title.href = href;
    card.querySelector('.website-description').textContent = item.description || t('noWebDescription');
    card.querySelector('.web-open').href = href;
    card.querySelector('.web-open').setAttribute('aria-label', t('openWebLabel', { title: item.title }));
    card.querySelector('.web-provider').textContent = t('provider', { provider });
    return card;
  }

  function safeLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  function icon(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '9');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', kind === 'check' ? 'm8 12 3 3 5-6' : 'M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2m0 3h.01');
    svg.append(circle, path);
    return svg;
  }

  function evidenceItem(label, { source, excerpt, url } = {}, kind = 'question') {
    const item = document.createElement('li');
    item.className = 'evidence-item';
    const text = document.createElement('span');
    text.textContent = label;
    if (source) {
      const small = document.createElement('small');
      const href = safeLink(url);
      const link = document.createElement(href ? 'a' : 'span');
      link.textContent = source;
      if (href) { link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      small.append(link);
      text.append(small);
    }
    if (excerpt) { const quote = document.createElement('small'); quote.className = 'evidence-excerpt'; quote.textContent = excerpt; text.append(quote); }
    item.append(icon(kind), text);
    return item;
  }

  function createCard(repo, index) {
    const card = $('#result-template').content.firstElementChild.cloneNode(true);
    localize(card);
    const set = (selector, text) => { card.querySelector(selector).textContent = text; };
    set('.result-rank', `#${(currentPage - 1) * 5 + index + 1}`);
    set('.repo-owner', repo.owner);
    set('.repo-name', repo.name);
    set('.repo-description', !repo.description || repo.description === 'No repository description provided.' ? t('noDescription') : repo.description);
    set('.language span', repo.language || t('notSpecified'));
    set('.stars span', new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(repo.stars));
    const date = new Date(repo.updatedAt);
    set('.updated', Number.isNaN(date.valueOf()) ? t('dateUnavailable') : t('updated', { date: date.toLocaleDateString(locale()) }));
    set('.match-copy', repo.matchedTerms?.length ? t('matchedKeywords', { terms: repo.matchedTerms.join(language === 'zh' ? '、' : ', ') }) : t('returnedByGithub'));
    const link = card.querySelector('.github-link');
    const href = safeLink(repo.htmlUrl);
    if (href) link.href = href;
    else link.remove();
    link.setAttribute('aria-label', t('viewGithub', { repo: `${repo.owner}/${repo.name}` }));

    const mentions = card.querySelector('.verified ul');
    if (repo.evidence.length) mentions.append(...repo.evidence.map(item => evidenceItem(localizeFeature(language, item.label), item, 'check')));
    else mentions.append(evidenceItem(t(repo.readme ? 'noFeatureMatches' : 'readmeUnavailable')));
    const missing = repo.unverified.length ? repo.unverified.map(text => {
      const feature = /^No README statement found for: (.+)$/.exec(text);
      return feature ? t('missingFeature', { feature: localizeFeature(language, feature[1]) }) : t('notTested');
    }) : [t('notTested')];
    card.querySelector('.unverified ul').append(...missing.map(text => evidenceItem(text)));
    set('.readme-code', repo.readme ? repo.readme.text.slice(0, 20_000) + (repo.readme.text.length > 20_000 || repo.readme.truncated ? `\n\n${t('excerptTruncated')}` : '') : localizeError(language, repo.readmeErrorCode || 'README_UNAVAILABLE'));
    set('.install-code', repo.installation?.text || t('noInstall'));
    card.querySelectorAll('[data-copy]').forEach(copy => {
      const text = copy.dataset.copy === 'readme' ? repo.readme?.text.slice(0, 20_000) : repo.installation?.text;
      copy.disabled = !text;
      copy.addEventListener('click', () => copyText(text, copy));
    });
    if (repo.installation?.url && safeLink(repo.installation.url)) {
      const source = document.createElement('a');
      source.href = repo.installation.url; source.target = '_blank'; source.rel = 'noopener noreferrer';
      source.textContent = t('installationSource', { source: repo.installation.source });
      source.className = 'installation-source';
      card.querySelector('.readme-content').append(source);
    }
    return card;
  }

  function syncInput() { button.disabled = input.value.trim().length < 2; }

  function updateView() {
    const active = view !== 'home';
    const web = currentSource === 'web';
    const expanded = [...list.querySelectorAll('.readme-details')].map(details => details.open);
    $('.main-content').classList.toggle('has-results', active);
    $('#intro').hidden = active;
    $('#suggestions').hidden = active;
    $('#results-section').hidden = !active;
    for (const selector of ['#loading-state', '#error-state', '#empty-state', '#pagination', '#search-warning', '#query-summary']) $(selector).hidden = true;
    list.replaceChildren();
    $('#results-section').removeAttribute('aria-busy');
    document.title = active ? `${currentQuery} — OpenSeek` : t('pageTitle');
    $('#results-heading').textContent = t('results');
    $('#search-status').textContent = '';
    $('#source-badge').textContent = t(web ? 'webSource' : 'githubKeywords');
    if (!active) return;
    if (view === 'loading') {
      $('#results-heading').textContent = t(web ? 'webLoading' : 'githubLoading');
      $('#loading-state').hidden = false;
      $('#results-section').setAttribute('aria-busy', 'true');
      $('#search-status').textContent = t(web ? 'webSearchingStatus' : 'githubSearchingStatus');
      return;
    }
    if (view === 'error') {
      $('#results-heading').textContent = t('unavailable');
      $('#error-message').textContent = localizeError(language, lastErrorCode);
      $('#error-state').hidden = false;
      $('#search-status').textContent = $('#error-message').textContent;
      return;
    }
    const data = lastData;
    const count = data.items.length;
    $('#results-heading').textContent = t(web ? 'webResults' : 'githubResults', { count, total: new Intl.NumberFormat(locale()).format(data.totalCount) });
    $('#source-badge').textContent = t(web ? data.cached ? 'webCached' : 'webLive' : data.cached ? 'githubCached' : 'githubLive', { provider: data.provider });
    list.append(...(web ? data.items.map((item, index) => createWebCard(item, index, data.provider)).filter(Boolean) : data.items.map(createCard)));
    list.querySelectorAll('.readme-details').forEach((details, index) => { details.open = Boolean(expanded[index]); });
    $('#empty-state').hidden = count > 0;
    $('#query-summary').textContent = t('keywords', { query: web ? data.searchQuery : data.githubQuery });
    $('#query-summary').hidden = false;
    if (data.warnings?.length) {
      $('#search-warning').textContent = data.warnings.map(warning => localizeWarning(language, warning)).join(' ');
      $('#search-warning').hidden = false;
    }
    $('#previous-page').disabled = currentPage <= 1;
    $('#next-page').disabled = !data.hasMore;
    $('#page-label').textContent = t('page', { page: currentPage });
    $('#pagination').hidden = web || (currentPage <= 1 && !data.hasMore);
    $('#search-status').textContent = t(web ? 'webResultStatus' : 'githubResultStatus', { count });
  }

  async function renderSearch(query, page = 1, focus = false, source = currentSource) {
    controller?.abort();
    const id = ++requestId;
    currentQuery = query;
    currentPage = page;
    updateMode(source);
    const web = source === 'web';
    input.value = query;
    syncInput();
    view = query ? 'loading' : 'home';
    lastData = null;
    updateView();
    if (!query) return;
    if (focus) $('#results-heading').focus({ preventScroll: true });
    const activeController = new AbortController();
    controller = activeController;
    const timer = setTimeout(() => activeController.abort(), 35_000);
    try {
      const response = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, page, perPage: web ? 10 : 5, source }), signal: activeController.signal
      });
      const data = await response.json();
      if (id !== requestId) return;
      if (!response.ok) throw Object.assign(new Error('Search request failed'), { code: data.error?.code });
      if (web && data.source !== 'web') throw Object.assign(new Error('Web search is not enabled'), { code: 'WEB_NOT_ENABLED' });
      lastData = data;
      view = 'results';
      updateView();
    } catch (error) {
      if (id !== requestId) return;
      lastErrorCode = error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : error.name === 'TypeError' ? 'NETWORK_ERROR' : error.code;
      view = 'error';
      updateView();
    } finally {
      clearTimeout(timer);
      if (id === requestId) { $('#loading-state').hidden = true; $('#results-section').removeAttribute('aria-busy'); }
    }
  }

  function navigate(query, page = 1, source = currentSource) {
    const url = new URL(location.href);
    if (source === 'web') { url.searchParams.set('source', 'web'); page = 1; } else url.searchParams.delete('source');
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    if (page > 1) url.searchParams.set('page', String(page)); else url.searchParams.delete('page');
    if (url.href !== location.href) history.pushState(null, '', url);
    renderSearch(query, page, Boolean(query), source);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function readLocation() {
    const params = new URL(location.href).searchParams;
    const page = Number(params.get('page') || 1);
    const source = params.get('source') === 'web' ? 'web' : 'github';
    return { query: (params.get('q') || '').trim(), page: source === 'github' && Number.isInteger(page) && page >= 1 && page <= 10 ? page : 1, source };
  }
  $('#search-form').addEventListener('submit', event => { event.preventDefault(); const query = input.value.trim(); if (query.length >= 2) navigate(query); });
  input.addEventListener('input', syncInput);
  document.querySelectorAll('[data-suggestion]').forEach(suggestion => suggestion.addEventListener('click', () => navigate(suggestion.dataset.suggestion)));
  document.querySelectorAll('[data-source]').forEach(choice => choice.addEventListener('click', () => {
    if (choice.dataset.source === currentSource) return;
    const draft = input.value;
    const query = currentQuery && draft.trim().length >= 2 ? draft.trim() : '';
    navigate(query, 1, choice.dataset.source);
    if (!query) { input.value = draft; syncInput(); }
  }));
  function home() { navigate(''); input.focus(); }
  $('#home-button').addEventListener('click', home);
  $('#try-another').addEventListener('click', home);
  $('#retry-search').addEventListener('click', () => renderSearch(currentQuery, currentPage));
  $('#previous-page').addEventListener('click', () => navigate(currentQuery, currentPage - 1));
  $('#next-page').addEventListener('click', () => navigate(currentQuery, currentPage + 1));
  window.addEventListener('popstate', () => {
    applyLanguage(new URL(location.href).searchParams.get('lang'));
    const state = readLocation(); renderSearch(state.query, state.page, false, state.source);
  });
  document.querySelectorAll('[data-language]').forEach(choice => choice.addEventListener('click', () => applyLanguage(choice.dataset.language, true)));

  const theme = $('#theme-toggle');
  function updateThemeButton() {
    const label = t(document.documentElement.dataset.theme === 'dark' ? 'lightMode' : 'darkMode');
    theme.setAttribute('aria-label', label); theme.title = label;
  }
  theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('openseek-theme', next); } catch { /* Storage is optional. */ }
    updateThemeButton();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    let saved;
    try { saved = localStorage.getItem('openseek-theme'); } catch { /* Use system preference. */ }
    if (!saved) { document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; updateThemeButton(); }
  });

  let toastTimer;
  async function copyText(text, copyButton) {
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = t('copied');
      setTimeout(() => { copyButton.textContent = t('copy'); }, 1600);
      toastKey = 'copiedToast';
    } catch { toastKey = 'copyFailed'; }
    $('#toast').textContent = t(toastKey);
    clearTimeout(toastTimer);
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
  }
  applyLanguage(language);
  const initial = readLocation();
  renderSearch(initial.query, initial.page, false, initial.source);
})();
