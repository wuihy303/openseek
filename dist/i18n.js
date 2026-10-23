export const messages = {
  en: {
    pageTitle: 'OpenSeek — Find exactly what you need.',
    metaDescription: 'Find useful GitHub projects, web pages and online tools. Search in Chinese or English and open the original sources.',
    skipLink: 'Skip to main content', home: 'OpenSeek home', language: 'Interface language',
    heroTitle: 'Find exactly what you need.',
    githubIntro: "Describe the open-source tool you're looking for, in Chinese or English.",
    webIntro: 'Find useful websites and online tools. Search in Chinese or English.',
    searchScope: 'Choose where to search', githubSource: 'GitHub projects', webSource: 'Web & online tools',
    githubPlaceholder: 'Describe the tool you need…', webPlaceholder: 'Search websites and tools…',
    githubSearchLabel: 'Describe the open-source tool you need', webSearchLabel: 'Search websites and online tools',
    search: 'Search', suggestedSearches: 'Try a suggested search',
    suggestionAnalytics: 'Self-hosted analytics without cookies', suggestionPdf: 'Python library to extract tables from PDF',
    suggestionMarkdown: 'An offline Markdown editor', suggestionRust: 'Rust toolkit for interactive CLI prompts',
    suggestionImages: 'Image compression tools', suggestionWebMarkdown: 'Online Markdown editor',
    suggestionWord: 'Convert PDF to Word online', suggestionPhotos: 'Royalty-free image websites',
    results: 'Search results', githubLoading: 'Searching GitHub…', webLoading: 'Searching the web…',
    githubLoadingDescription: 'Finding repositories and reading their documentation.',
    webLoadingDescription: 'Finding websites and online tools you can use directly.',
    searchFailed: 'Search could not be completed.', unavailable: 'Search unavailable', retry: 'Try again',
    githubEmpty: 'No matching repositories found.', webEmpty: 'No matching web pages found.',
    githubEmptyDescription: 'Try a shorter description or the main tool category. You can search in Chinese or English.',
    webEmptyDescription: 'Try more specific keywords, such as “image compression” or “Markdown editor”.',
    trySuggestion: 'Try a suggested search', pagination: 'Search result pages', previous: '← Previous', next: 'Next →', page: 'Page {page}',
    githubNote: 'README mentions are text matches, not runtime verification. Installation snippets are quoted from the repository and are never executed.',
    webNote: 'Summaries come from search results. Open the original page to confirm its features and terms of use.',
    githubResults: '{count} results · {total} repositories found', webResults: '{count} web pages & online tools',
    githubLive: 'GitHub · live data', githubCached: 'GitHub · cached data', githubKeywords: 'GitHub · keyword search',
    webLive: '{provider} · web search', webCached: '{provider} · cached results', keywords: 'Search keywords: {query}',
    githubSearchingStatus: 'Searching GitHub and reading repository documentation.', webSearchingStatus: 'Searching websites and online tools.',
    githubResultStatus: '{count} repositories displayed. README mentions are source text matches, not runtime verification.',
    webResultStatus: '{count} web pages found. Open a result to visit its original website.',
    noDescription: 'No repository description provided.', notSpecified: 'Not specified', dateUnavailable: 'Update date unavailable', updated: 'Updated {date}',
    whyMatch: 'Why it matches', matchedKeywords: 'Keywords found in repository metadata or README: {terms}.',
    returnedByGithub: 'Returned by GitHub repository search; inspect the README for suitability.',
    viewGithub: 'View {repo} on GitHub', readmeMentions: 'README mentions', notEstablished: 'Not established',
    noFeatureMatches: 'No requested feature statements matched.', readmeUnavailable: 'README could not be loaded. Open the repository to view its documentation.',
    notTested: 'Repository behavior has not been tested.', missingFeature: 'No README statement found for: {feature}',
    readmeSources: 'README & installation sources', readmeExcerpt: 'README excerpt', sourceText: '· source text',
    install: 'Install', quoted: '· quoted, not executed', copy: 'Copy', copied: 'Copied',
    copyReadme: 'Copy README excerpt', copyInstall: 'Copy installation snippet',
    excerptTruncated: '[Excerpt truncated. View the full README on GitHub.]',
    noInstall: 'No installation command block was found in the available README. See the repository documentation.',
    installationSource: 'View installation source · {source}', webPage: 'Web page', openWeb: 'Open website',
    openWebLabel: 'Open website: {title}', noWebDescription: 'No summary was provided. Open the original page to learn more.', provider: 'Search source: {provider}',
    lightMode: 'Switch to light mode', darkMode: 'Switch to dark mode', copiedToast: 'Copied source text.', copyFailed: 'Select the source text and copy it manually.',
    featureSelfHosting: 'Self-hosting', featureNoCookies: 'No cookies', featureOffline: 'Offline use',
    featureTables: 'Table extraction', featurePrompts: 'Interactive prompts', featureWindows: 'Windows support', featureOcr: 'OCR',
    warningBroader: 'Broader repository keywords were used because the first search returned no results.',
    warningIncomplete: 'GitHub returned an incomplete search result set.',
    warningReadmes: 'README sources could not be loaded for {missing} of {total} repositories. Repository metadata is still available.',
    warningShorter: 'Shorter keywords were used to find relevant web pages.', warningOther: 'Some source data is unavailable. Open the original source to confirm the details.',
    errorInvalidQuery: 'Enter a search query of 2–500 characters without line breaks.',
    errorInvalidPagination: 'This page is unavailable. Return to the first page and try again.',
    errorInvalidSource: 'Choose GitHub projects or web search and try again.',
    errorInvalidRequest: 'The search request could not be read. Refresh the page and try again.',
    errorBodyTooLarge: 'The search request is too large. Shorten your query and try again.',
    errorRateLimited: 'Too many searches. Please wait a minute and try again.',
    errorGithubRateLimit: 'GitHub’s API limit has been reached. Please try again later.',
    errorGithubAuth: 'The server could not connect to GitHub with its current credentials. Please try again later.',
    errorGithubUnavailable: 'GitHub is temporarily unavailable. Please try again shortly.',
    errorBusy: 'Search is busy. Please try again in a few seconds.',
    errorWebUnavailable: 'Web search is temporarily unavailable. Please try again shortly.',
    errorUnavailable: 'Search is temporarily unavailable. Please try again.',
    errorNetwork: 'The request could not finish. Check your connection and try again.',
    errorTimeout: 'The search took too long. Please try again.',
    errorWebNotEnabled: 'Web search is not available on this server yet. Refresh the page after deployment.',
    errorReadmeNotFound: 'No README was found. Open the repository to view its documentation.'
  },
  zh: {
    pageTitle: 'OpenSeek — 找到你真正需要的工具。',
    metaDescription: '发现有用的 GitHub 项目、网页与在线工具。支持中英文搜索，直接查看原始来源。',
    skipLink: '跳转到主要内容', home: '返回 OpenSeek 首页', language: '界面语言',
    heroTitle: '找到你真正需要的工具。',
    githubIntro: '用中文或英文，描述你正在寻找的开源工具。',
    webIntro: '发现有用的网页、网站和在线工具，中英文都可以搜。',
    searchScope: '选择搜索范围', githubSource: 'GitHub 项目', webSource: '网页与在线工具',
    githubPlaceholder: '描述你需要的开源工具…', webPlaceholder: '搜索网页与在线工具…',
    githubSearchLabel: '描述你需要的开源工具', webSearchLabel: '搜索网页与在线工具',
    search: '搜索', suggestedSearches: '试试推荐搜索',
    suggestionAnalytics: '无需 Cookie 的自托管统计工具', suggestionPdf: '用 Python 提取 PDF 表格',
    suggestionMarkdown: '支持离线使用的 Markdown 编辑器', suggestionRust: 'Rust 交互式命令行工具包',
    suggestionImages: '图片压缩工具', suggestionWebMarkdown: '在线 Markdown 编辑器',
    suggestionWord: '在线 PDF 转 Word', suggestionPhotos: '免费图片素材网站',
    results: '搜索结果', githubLoading: '正在搜索 GitHub…', webLoading: '正在搜索网页…',
    githubLoadingDescription: '正在查找项目并阅读它们的文档。', webLoadingDescription: '正在查找网页和可以直接使用的在线工具。',
    searchFailed: '暂时无法完成搜索。', unavailable: '搜索暂不可用', retry: '重试',
    githubEmpty: '暂时没有找到相关项目。', webEmpty: '暂时没有找到相关网页。',
    githubEmptyDescription: '试试更简短的描述或工具类别，中文和英文都可以搜索。',
    webEmptyDescription: '换一些更具体的关键词试试，例如“图片压缩”或“Markdown editor”。',
    trySuggestion: '试试推荐搜索', pagination: '搜索结果分页', previous: '← 上一页', next: '下一页 →', page: '第 {page} 页',
    githubNote: '文档匹配仅表示 README 中出现相关措辞，不代表实际运行验证。安装代码摘录自仓库，仅供查看和复制。',
    webNote: '摘要来自搜索结果，请打开原网页确认具体功能和使用条件。',
    githubResults: '显示 {count} 个项目 · 共找到 {total} 个仓库', webResults: '{count} 个网页与在线工具',
    githubLive: 'GitHub · 实时数据', githubCached: 'GitHub · 缓存数据', githubKeywords: 'GitHub · 关键词搜索',
    webLive: '{provider} · 网页搜索', webCached: '{provider} · 缓存结果', keywords: '搜索关键词：{query}',
    githubSearchingStatus: '正在搜索 GitHub 并阅读项目文档。', webSearchingStatus: '正在搜索网页和在线工具。',
    githubResultStatus: '已显示 {count} 个项目。文档匹配表示原文出现相关措辞，不代表实际运行验证。',
    webResultStatus: '已找到 {count} 个网页，打开搜索结果即可访问原站。',
    noDescription: '该仓库暂未提供描述。', notSpecified: '未注明', dateUnavailable: '暂无更新日期', updated: '更新于 {date}',
    whyMatch: '匹配原因', matchedKeywords: '仓库信息或 README 中出现了以下关键词：{terms}。',
    returnedByGithub: '由 GitHub 仓库搜索返回，可阅读 README 确认是否适合。',
    viewGithub: '在 GitHub 查看 {repo}', readmeMentions: '文档中有提及', notEstablished: '尚未确认',
    noFeatureMatches: '未找到与所需功能匹配的文档表述。', readmeUnavailable: '暂时无法加载 README，可打开仓库查看文档。',
    notTested: '尚未实际运行并验证项目功能。', missingFeature: 'README 中未找到相关表述：{feature}',
    readmeSources: 'README 与安装来源', readmeExcerpt: 'README 摘录', sourceText: '· 来源原文',
    install: '安装方法', quoted: '· 原文摘录，仅供查看', copy: '复制', copied: '已复制',
    copyReadme: '复制 README 摘录', copyInstall: '复制安装代码',
    excerptTruncated: '［摘录已截断，请在 GitHub 查看完整 README。］',
    noInstall: '当前 README 中未找到安装命令块，请查看仓库文档。',
    installationSource: '查看安装来源 · {source}', webPage: '网页', openWeb: '打开网页',
    openWebLabel: '打开网页：{title}', noWebDescription: '搜索结果未提供摘要，可打开原网页查看。', provider: '搜索来源：{provider}',
    lightMode: '切换为浅色模式', darkMode: '切换为深色模式', copiedToast: '已复制来源原文。', copyFailed: '请选中来源原文并手动复制。',
    featureSelfHosting: '自托管', featureNoCookies: '无需 Cookie', featureOffline: '离线使用',
    featureTables: '表格提取', featurePrompts: '交互式提示', featureWindows: '支持 Windows', featureOcr: 'OCR 文字识别',
    warningBroader: '首次搜索没有结果，已使用更宽泛的项目关键词。', warningIncomplete: 'GitHub 返回的搜索结果可能不完整。',
    warningReadmes: '{total} 个项目中有 {missing} 个暂时无法加载 README，仓库信息仍可查看。',
    warningShorter: '为查找相关网页，已使用更简短的关键词。', warningOther: '部分来源数据暂不可用，可打开原始来源确认详情。',
    errorInvalidQuery: '请输入 2–500 个字符的搜索内容，请勿换行。',
    errorInvalidPagination: '当前页码不可用，请返回第一页后重试。', errorInvalidSource: '请选择 GitHub 项目或网页搜索后重试。',
    errorInvalidRequest: '无法读取搜索请求，请刷新页面后重试。', errorBodyTooLarge: '搜索请求过长，请缩短搜索内容后重试。',
    errorRateLimited: '搜索次数较多，请等待一分钟后重试。', errorGithubRateLimit: 'GitHub 接口额度暂时用尽，请稍后重试。',
    errorGithubAuth: '服务器暂时无法通过当前凭据连接 GitHub，请稍后重试。', errorGithubUnavailable: 'GitHub 暂时无法访问，请稍后重试。',
    errorBusy: '当前搜索繁忙，请稍等几秒后重试。', errorWebUnavailable: '网页搜索暂不可用，请稍后重试。',
    errorUnavailable: '搜索服务暂不可用，请稍后重试。', errorNetwork: '请求未能完成，请检查网络连接后重试。',
    errorTimeout: '搜索响应超时，请重试。', errorWebNotEnabled: '服务器暂未启用网页搜索，请在部署完成后刷新页面。',
    errorReadmeNotFound: '未找到 README，可打开仓库查看项目文档。'
  }
};

export function normalizeLanguage(value) {
  if (typeof value !== 'string') return null;
  const language = value.toLowerCase().split(/[-_]/)[0];
  return language === 'zh' || language === 'en' ? language : null;
}

export function resolveLanguage({ query, saved, languages = [] } = {}) {
  return normalizeLanguage(query) || normalizeLanguage(saved) || languages.map(normalizeLanguage).find(Boolean) || 'en';
}

export function translate(language, key, values = {}) {
  const message = messages[normalizeLanguage(language) || 'en'][key];
  if (typeof message !== 'string') throw new Error(`Unknown translation: ${key}`);
  return message.replace(/\{(\w+)\}/g, (placeholder, name) => Object.hasOwn(values, name) ? String(values[name]) : placeholder);
}

const featureKeys = {
  'Self-hosting': 'featureSelfHosting', 'No cookies': 'featureNoCookies', 'Offline use': 'featureOffline',
  'Table extraction': 'featureTables', 'Interactive prompts': 'featurePrompts', 'Windows support': 'featureWindows', OCR: 'featureOcr'
};
export function localizeFeature(language, label) {
  return Object.hasOwn(featureKeys, label) ? translate(language, featureKeys[label]) : label;
}

export function localizeWarning(language, warning) {
  const readmes = /^README sources could not be loaded for (\d+) of (\d+) repositories\./.exec(warning);
  if (readmes) return translate(language, 'warningReadmes', { missing: readmes[1], total: readmes[2] });
  const warningKeys = {
    'Broader repository keywords were used because the first search returned no results.': 'warningBroader',
    'GitHub returned an incomplete search result set.': 'warningIncomplete',
    'Shorter keywords were used to find relevant web pages.': 'warningShorter'
  };
  return translate(language, Object.hasOwn(warningKeys, warning) ? warningKeys[warning] : 'warningOther');
}

const errorKeys = {
  INVALID_QUERY: 'errorInvalidQuery', INVALID_PAGINATION: 'errorInvalidPagination', INVALID_SOURCE: 'errorInvalidSource',
  INVALID_JSON: 'errorInvalidRequest', INVALID_CONTENT_TYPE: 'errorInvalidRequest', BODY_TOO_LARGE: 'errorBodyTooLarge',
  RATE_LIMITED: 'errorRateLimited', GITHUB_RATE_LIMIT: 'errorGithubRateLimit', GITHUB_AUTH_ERROR: 'errorGithubAuth',
  GITHUB_UNAVAILABLE: 'errorGithubUnavailable', SEARCH_BUSY: 'errorBusy', WEB_SEARCH_UNAVAILABLE: 'errorWebUnavailable',
  NETWORK_ERROR: 'errorNetwork', REQUEST_TIMEOUT: 'errorTimeout', WEB_NOT_ENABLED: 'errorWebNotEnabled',
  README_NOT_FOUND: 'errorReadmeNotFound', README_UNAVAILABLE: 'readmeUnavailable'
};
export function localizeError(language, code) {
  return translate(language, Object.hasOwn(errorKeys, code) ? errorKeys[code] : 'errorUnavailable');
}
