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
    const set = (selector, text) => { card.querySelector(selector).textContent = text; };
    set('.result-rank', `#${(currentPage - 1) * 5 + index + 1}`);
    set('.repo-owner', repo.owner);
    set('.repo-name', repo.name);
    set('.repo-description', repo.description);
    set('.language span', repo.language || 'Not specified');
    set('.stars span', new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(repo.stars));
    const date = new Date(repo.updatedAt);
    set('.updated', Number.isNaN(date.valueOf()) ? 'Update date unavailable' : `Updated ${date.toLocaleDateString()}`);
    set('.match-copy', repo.matchReason);
    const link = card.querySelector('.github-link');
    const href = safeLink(repo.htmlUrl);
    if (href) link.href = href;
    else link.remove();
    link.setAttribute('aria-label', `View ${repo.owner}/${repo.name} on GitHub`);

    const mentions = card.querySelector('.verified ul');
    if (repo.evidence.length) mentions.append(...repo.evidence.map(item => evidenceItem(item.label, item, 'check')));
    else mentions.append(evidenceItem(repo.readme ? 'No requested feature statements matched.' : 'README could not be loaded.'));
    const missing = repo.unverified.length ? repo.unverified : ['Repository behavior has not been tested.'];
    card.querySelector('.unverified ul').append(...missing.map(text => evidenceItem(text)));
    set('.readme-code', repo.readme ? repo.readme.text.slice(0, 20_000) + (repo.readme.text.length > 20_000 || repo.readme.truncated ? '\n\n[Excerpt truncated. View the full README on GitHub.]' : '') : repo.readmeError || 'No README available.');
    set('.install-code', repo.installation?.text || 'No installation command block was found in the available README. See the repository documentation.');
    card.querySelectorAll('[data-copy]').forEach(copy => {
      const text = copy.dataset.copy === 'readme' ? repo.readme?.text.slice(0, 20_000) : repo.installation?.text;
      copy.disabled = !text;
      copy.addEventListener('click', () => copyText(text, copy));
    });
    if (repo.installation?.url && safeLink(repo.installation.url)) {
      const source = document.createElement('a');
      source.href = repo.installation.url; source.target = '_blank'; source.rel = 'noopener noreferrer';
      source.textContent = `View installation source · ${repo.installation.source}`;
      source.className = 'installation-source';
      card.querySelector('.readme-content').append(source);
    }
    return card;
  }

  function syncInput() { button.disabled = input.value.trim().length < 2; }

  async function renderSearch(query, page = 1, focus = false) {
    controller?.abort();
    const id = ++requestId;
    currentQuery = query;
    currentPage = page;
    input.value = query;
    syncInput();
    const active = Boolean(query);
    $('.main-content').classList.toggle('has-results', active);
    $('#intro').hidden = active;
    $('#suggestions').hidden = active;
    $('#results-section').hidden = !active;
    for (const selector of ['#loading-state', '#error-state', '#empty-state', '#pagination', '#search-warning', '#query-summary']) $(selector).hidden = true;
    list.replaceChildren();
    $('#results-section').removeAttribute('aria-busy');
    if (!active) {
      document.title = 'OpenSeek — Find exactly what you need.';
      $('#search-status').textContent = '';
      return;
    }
    document.title = `${query} — OpenSeek`;
    $('#results-heading').textContent = 'Searching GitHub…';
    $('#source-badge').textContent = 'GitHub · keyword search';
    $('#loading-state').hidden = false;
    $('#results-section').setAttribute('aria-busy', 'true');
    $('#search-status').textContent = 'Searching GitHub and reading repository documentation.';
    if (focus) $('#results-heading').focus({ preventScroll: true });
    const activeController = new AbortController();
    controller = activeController;
    const timer = setTimeout(() => activeController.abort(), 35_000);
    try {
      const response = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, page, perPage: 5 }), signal: activeController.signal
      });
      const data = await response.json();
      if (id !== requestId) return;
      if (!response.ok) throw new Error(data.error?.message || 'Search is temporarily unavailable.');
      $('#results-heading').textContent = `${data.items.length} results · ${new Intl.NumberFormat().format(data.totalCount)} repositories found`;
      $('#source-badge').textContent = data.cached ? 'GitHub · cached data' : 'GitHub · live data';
      list.append(...data.items.map(createCard));
      $('#empty-state').hidden = data.items.length > 0;
      $('#query-summary').textContent = `Search keywords: ${data.githubQuery}`;
      $('#query-summary').hidden = false;
      if (data.warnings.length) { $('#search-warning').textContent = data.warnings.join(' '); $('#search-warning').hidden = false; }
      $('#previous-page').disabled = page <= 1;
      $('#next-page').disabled = !data.hasMore;
      $('#page-label').textContent = `Page ${page}`;
      $('#pagination').hidden = page <= 1 && !data.hasMore;
      $('#search-status').textContent = `${data.items.length} repositories displayed. README mentions are source text matches, not runtime verification.`;
    } catch (error) {
      if (id !== requestId) return;
      $('#results-heading').textContent = 'Search unavailable';
      $('#error-message').textContent = error.name === 'AbortError' || error.name === 'TypeError' ? 'The request could not finish. Check your connection and try again.' : error.message;
      $('#error-state').hidden = false;
      $('#search-status').textContent = $('#error-message').textContent;
    } finally {
      clearTimeout(timer);
      if (id === requestId) { $('#loading-state').hidden = true; $('#results-section').removeAttribute('aria-busy'); }
    }
  }

  function navigate(query, page = 1) {
    const url = new URL(location.href);
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    if (page > 1) url.searchParams.set('page', String(page)); else url.searchParams.delete('page');
    if (url.href !== location.href) history.pushState(null, '', url);
    renderSearch(query, page, Boolean(query));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function readLocation() {
    const params = new URL(location.href).searchParams;
    const page = Number(params.get('page') || 1);
    return { query: (params.get('q') || '').trim(), page: Number.isInteger(page) && page >= 1 && page <= 10 ? page : 1 };
  }
  $('#search-form').addEventListener('submit', event => { event.preventDefault(); const query = input.value.trim(); if (query.length >= 2) navigate(query); });
  input.addEventListener('input', syncInput);
  document.querySelectorAll('[data-suggestion]').forEach(suggestion => suggestion.addEventListener('click', () => navigate(suggestion.dataset.suggestion)));
  function home() { navigate(''); input.focus(); }
  $('#home-button').addEventListener('click', home);
  $('#try-another').addEventListener('click', home);
  $('#retry-search').addEventListener('click', () => renderSearch(currentQuery, currentPage));
  $('#previous-page').addEventListener('click', () => navigate(currentQuery, currentPage - 1));
  $('#next-page').addEventListener('click', () => navigate(currentQuery, currentPage + 1));
  window.addEventListener('popstate', () => { const state = readLocation(); renderSearch(state.query, state.page); });

  const theme = $('#theme-toggle');
  function updateThemeButton() {
    const label = document.documentElement.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
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
      copyButton.textContent = 'Copied';
      setTimeout(() => { copyButton.textContent = 'Copy'; }, 1600);
      $('#toast').textContent = 'Copied source text.';
    } catch { $('#toast').textContent = 'Select the source text and copy it manually.'; }
    clearTimeout(toastTimer);
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
  }
  updateThemeButton();
  const initial = readLocation();
  renderSearch(initial.query, initial.page);
})();
