# OpenSeek

中英文开源工具检索应用。Node.js 后端调用真实 GitHub API，前端展示仓库数据、README 原文证据与安装片段。

## 快速运行

需要 **Node.js 24 或以上**，无第三方运行依赖。

```sh
git clone https://github.com/wuihy303/openseek.git
cd openseek
npm ci
cp .env.example .env
npm start
```

访问 <http://localhost:3000>。开发时使用 `npm run dev` 自动重启后端。

不配置 Token 也可以搜索公开仓库。GitHub 匿名 API 配额较低，长期运行建议在服务器 `.env` 中设置 `GITHUB_TOKEN`。它只用于查询公开仓库及 README，不需要仓库写入权限。不要把 `.env` 提交到 GitHub。

## 已实现

- 真实 GitHub 仓库搜索：描述、语言、Star 数、最近推送时间、真实仓库链接。
- 中英文关键词处理与语言限定；常见中文领域词映射为英文关键词。
- README 原文获取、能力关键词定位，附文件名、行号和 GitHub 原文链接。
- 从 README 安装/快速开始章节提取命令块，供查看和复制。
- 当前页按 README 匹配与关键词相关度排序，支持翻页。
- 5 分钟内存缓存、并发请求去重、搜索并发上限和按客户端地址限流。
- 查询、请求体和分页校验；GitHub 超时、配额、授权错误有结构化响应。
- 同一个 Node 服务提供前端和 API；移动端布局、主题记忆、请求取消与重试。
- 自动化测试和 GitHub Actions CI。

## 能力边界

这不是大模型语义搜索：检索使用规则化关键词和 GitHub 搜索，中文词表可在 `server/search.js` 扩展。排序在 GitHub 返回的当前页候选中进行。

“README mentions”表示文档中找到相关措辞，附原文供核对，不代表实际运行验证。未找到原文也不代表项目一定不支持该能力。安装代码仅摘录展示，应用不会执行它。

无数据库、账号系统或持久化查询记录。缓存和限流在单进程内存中，重启后清空；多实例部署时可替换为共享存储。默认不信任 `X-Forwarded-For`，反向代理后会按代理连接地址限流。

## API

### `GET /api/health`

应用存活检查，不会调用 GitHub：

```json
{"status":"ok","service":"openseek","version":"1.0.0"}
```

### `POST /api/search`

```sh
curl -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"Python library to extract tables from PDF","page":1,"perPage":5}'
```

同时支持 `GET /api/search?q=markdown%20editor&page=1&perPage=5`。

参数：

| 字段 | 说明 |
| --- | --- |
| `query` / `q` | 必填，去除首尾空白后 2–500 字符 |
| `page` | 1–10，默认 1 |
| `perPage` | 1–10，默认 5 |

返回包括 `items`、`totalCount`、`hasMore`、`githubQuery`、`fetchedAt`、`cached` 和 `warnings`。仓库项含 `owner`、`name`、`htmlUrl`、`stars`、`language`、`updatedAt`、`matchedTerms`、`evidence`、`unverified`、`readme`、`readmeError`、`installation`。

README 获取失败时保留仓库元数据，返回 `readmeError`；不会填入演示数据。`evidence` 包含匹配行原文、行号和来源链接。`installation` 没有匹配片段时为 `null`。

错误格式：

```json
{"error":{"code":"INVALID_QUERY","message":"Search query must contain 2–500 characters without control characters."}}
```

常见状态：`400` 参数无效、`413` 请求体过大、`415` 内容类型不正确、`429` 本地限流、`502` GitHub 访问失败、`503` GitHub 配额耗尽或搜索繁忙、`504` 上游超时。有明确重试时间时返回 `Retry-After`。

## 配置

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `GITHUB_TOKEN` | 无 | 可选，服务端 GitHub API Token |
| `SEARCH_RATE_LIMIT` | `20` | 每个连接地址每分钟搜索次数 |
| `CACHE_TTL_SECONDS` | `300` | 缓存秒数 |
| `GITHUB_TIMEOUT_MS` | `10000` | 单个上游请求超时毫秒数 |
| `NODE_USE_ENV_PROXY` | 未设置 | 需要继承 `HTTP_PROXY` / `HTTPS_PROXY` 时设为 `1` |

应用不向浏览器返回 Token。前端只向同源 `/api/search` 发送请求，不需要在 JavaScript 中配置密钥。

## 测试

```sh
npm run check
npm test
```

测试使用隔离的 GitHub 响应，覆盖请求验证、真实数据映射、README 证据与安装提取、缓存和去重、并发限制、限流、上游错误、分页及静态文件边界。运行测试不消耗 GitHub API 配额。

## 部署

可部署到支持 Node.js 24 的 VPS 或 Node Web Service：

- 启动命令：`npm start`
- 健康检查路径：`/api/health`
- 端口：读取平台提供的 `PORT`
- HTTPS：由部署平台或反向代理终止

也可以使用 Docker：

```sh
docker build -t openseek .
docker run --rm -p 3000:3000 --env-file .env openseek
```

GitHub 仓库存放源代码和运行说明。GitHub Pages 只能提供静态页面，不能运行本项目的 Node.js 后端。

## 目录

```text
server/       HTTP 服务、GitHub 客户端、搜索和证据提取
 dist/        前端静态文件及本地字体
 test/        自动化测试
.github/      CI 工作流
.env.example  环境变量模板
Dockerfile    容器运行配置
```

界面依据用户提供的 OpenSeek 预览独立实现。字体位于 `dist/assets`，保留对应 OFL 许可。
