import { HttpError, TtlCache } from './cache.js';
import { safeGitHubUrl } from './github.js';

const STOP = new Set('a an the i need want find me to from for with without that and or in of is it use using support supports open source tool tools please files library toolkit can able be'.split(' '));
const TRANSLATIONS = [
  [/分析|统计|流量/g, ' analytics '], [/自托管|自行部署|私有部署/g, ' self-hosted '],
  [/无饼干|无追踪|无cookie|不使用cookie/gi, ' cookieless '], [/隐私/g, ' privacy '],
  [/提取|抽取|解析/g, ' extract '], [/表格/g, ' table '], [/文档/g, ' document '],
  [/离线|断网|本地使用/g, ' offline '], [/编辑器|编辑|写作/g, ' editor '],
  [/笔记/g, ' notes '], [/预览/g, ' preview '], [/命令行|终端/g, ' cli '],
  [/交互|提示/g, ' interactive prompt '], [/数据库/g, ' database '], [/向量/g, ' vector ']
];

const REQUIREMENTS = [
  { label: 'Self-hosting', query: /self[ -]?host|自托管|自行部署|私有部署/i, evidence: /self[ -]?host(?:ed|ing)?|自托管|自行部署/i },
  { label: 'No cookies', query: /cookieless|without cookies|no cookies|无.*cookie|不.*cookie/i, evidence: /cookieless|no cookies|without (?:using )?cookies|does not use cookies|不使用.?cookies?/i },
  { label: 'Offline use', query: /offline|离线|断网/i, evidence: /work(?:s|ing)? offline|offline (?:mode|support|use|access)|fully offline|离线/i },
  { label: 'Table extraction', query: /tables?|表格/i, evidence: /extract.{0,45}tables?|table extraction|表格提取|提取表格/i },
  { label: 'Interactive prompts', query: /interactive|prompts?|交互|提示/i, evidence: /interactive.{0,45}(?:prompts?|cli|terminal)|prompts?.{0,40}interactive|交互/i },
  { label: 'Windows support', query: /windows/i, evidence: /windows/i },
  { label: 'OCR', query: /\bocr\b|扫描/i, evidence: /\bocr\b/i }
];

export function buildSearchPlan(input) {
  if (typeof input !== 'string' || input.trim().length < 2 || input.trim().length > 500 || /[\x00-\x1f]/.test(input)) {
    throw new HttpError(400, 'Search query must contain 2–500 characters without control characters.', { code: 'INVALID_QUERY' });
  }
  const query = input.trim();
  let normalized = query.toLowerCase();
  TRANSLATIONS.forEach(([pattern, value]) => { normalized = normalized.replace(pattern, value); });
  const terms = [...new Set((normalized.match(/[a-z0-9]+(?:-[a-z0-9]+)*|[\u3400-\u9fff]{2,}/g) || []).filter(term => !STOP.has(term)))].slice(0, 12);
  if (!terms.length) throw new HttpError(400, 'Please describe a specific tool, language or feature.', { code: 'INVALID_QUERY' });
  const language = ['python', 'rust', 'typescript', 'javascript', 'golang', 'go'].find(item => terms.includes(item));
  const languageFilter = language ? ` language:${['golang', 'go'].includes(language) ? 'Go' : language}` : '';
  let retrieval;
  if (terms.includes('analytics')) retrieval = ['analytics', ...(normalized.includes('self-host') ? ['self-hosted'] : [])];
  else if (terms.includes('pdf')) retrieval = ['pdf', ...(terms.some(term => /^tables?$/.test(term)) ? ['table'] : [])];
  else if (terms.includes('markdown')) retrieval = ['markdown', ...(terms.includes('editor') ? ['editor'] : [])];
  else if (terms.includes('cli') || terms.includes('prompt') || terms.includes('prompts')) retrieval = ['cli', 'prompt'];
  else retrieval = terms.filter(term => term !== language).slice(0, 5);
  if (!retrieval.length) retrieval = [language];
  const suffix = `${languageFilter} in:name,description archived:false`;
  return { query, terms, githubQuery: retrieval.join(' ') + suffix, fallbackQuery: retrieval[0] + suffix, requirements: REQUIREMENTS.filter(item => item.query.test(query)) };
}

export function extractReadmeEvidence(readme, requirements) {
  const lines = readme?.text.split(/\r?\n/) || [];
  const found = [];
  const missing = [];
  for (const requirement of requirements) {
    const index = lines.findIndex(line => requirement.evidence.test(line) && !/not supported|does not support|not available|unsupported|不支持/i.test(line));
    if (index < 0) { missing.push(`No README statement found for: ${requirement.label}`); continue; }
    found.push({ label: requirement.label, source: `${readme.path}:L${index + 1}`, excerpt: lines[index].trim().slice(0, 400), url: readme.htmlUrl ? `${readme.htmlUrl}#L${index + 1}` : null });
  }
  return { found, missing };
}

export function extractInstallation(readme) {
  if (!readme) return null;
  const lines = readme.text.split(/\r?\n/);
  let inInstall = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^#{1,6}\s+/.test(line)) inInstall = /install|getting started|quick.?start|setup|安装|快速开始/i.test(line);
    if (!inInstall || !/^\s*```(?:sh|shell|bash|console|zsh|powershell|cmd)?\s*$/.test(line)) continue;
    const start = index + 1;
    const end = lines.findIndex((value, current) => current >= start && /^\s*```/.test(value));
    if (end < 0) continue;
    const text = lines.slice(start, Math.min(end, start + 20)).join('\n').trim();
    if (text && text.length <= 2500) return { text, source: `${readme.path}:L${start + 1}`, url: readme.htmlUrl ? `${readme.htmlUrl}#L${start + 1}-L${end}` : null };
  }
  return null;
}

export function createSearchService({ github, ttl = 300_000, maxConcurrent = 4 } = {}) {
  const cache = new TtlCache({ ttl, max: 100 });
  const pending = new Map();
  let active = 0;

  return async function search({ query, page = 1, perPage = 5 }) {
    const plan = buildSearchPlan(query);
    if (!Number.isInteger(page) || page < 1 || page > 10 || !Number.isInteger(perPage) || perPage < 1 || perPage > 10) {
      throw new HttpError(400, 'page must be 1–10 and perPage must be 1–10.', { code: 'INVALID_PAGINATION' });
    }
    const key = JSON.stringify([plan.query.toLowerCase(), page, perPage]);
    const cached = cache.get(key);
    if (cached) return { ...cached, cached: true };
    if (pending.has(key)) return pending.get(key);
    if (active >= maxConcurrent) throw new HttpError(503, 'Search is busy. Please retry shortly.', { code: 'SEARCH_BUSY', retryAfter: 5 });
    active++;
    const task = (async () => {
      let githubQuery = plan.githubQuery;
      let data = await github.search(githubQuery, { page, perPage });
      if (data.total_count === 0 && plan.fallbackQuery !== githubQuery) {
        githubQuery = plan.fallbackQuery;
        data = await github.search(githubQuery, { page, perPage });
      }
      const warnings = [];
      if (githubQuery !== plan.githubQuery) warnings.push('Broader repository keywords were used because the first search returned no results.');
      if (data.incomplete_results) warnings.push('GitHub returned an incomplete search result set.');
      const repos = Array.isArray(data.items) ? data.items.filter(repo => safeGitHubUrl(repo.html_url) && repo.owner?.login && repo.name).slice(0, perPage) : [];
      const items = await Promise.all(repos.map(async repo => {
        let readme = null;
        let readmeError = null;
        try { readme = await github.readme(repo.owner.login, repo.name); }
        catch (error) { readmeError = error instanceof HttpError ? error.message : 'README could not be loaded.'; }
        const evidence = extractReadmeEvidence(readme, plan.requirements);
        const haystack = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')} ${readme?.text || ''}`.toLowerCase();
        const matches = plan.terms.filter(term => haystack.includes(term));
        return {
          id: repo.id, owner: repo.owner.login, name: repo.name,
          htmlUrl: safeGitHubUrl(repo.html_url), description: repo.description || 'No repository description provided.',
          language: repo.language, stars: repo.stargazers_count || 0,
          updatedAt: repo.pushed_at || repo.updated_at, license: repo.license?.spdx_id || null,
          topics: repo.topics || [], matchedTerms: matches,
          matchReason: matches.length ? `Keywords found in repository metadata or README: ${matches.join(', ')}.` : 'Returned by GitHub repository search; inspect the README for suitability.',
          evidence: evidence.found, unverified: evidence.missing,
          readme, readmeError, installation: extractInstallation(readme)
        };
      }));
      items.sort((a, b) => (b.evidence.length * 5 + b.matchedTerms.length) - (a.evidence.length * 5 + a.matchedTerms.length));
      const result = { query: plan.query, githubQuery, source: 'github', mode: 'keyword',
        totalCount: Number(data.total_count) || 0, page, perPage,
        hasMore: page < 10 && page * perPage < Math.min(1000, Number(data.total_count) || 0),
        fetchedAt: new Date().toISOString(), cached: false, warnings, items };
      return cache.set(key, result);
    })();
    pending.set(key, task);
    try { return await task; } finally { active--; pending.delete(key); }
  };
}
