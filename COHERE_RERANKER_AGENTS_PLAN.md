# Implementation Plan: Configurable Cohere Reranker URL in `@librechat/agents`

## Context

LibreChat issue [#12328](https://github.com/danny-avila/LibreChat/issues/12328) requests support for a configurable Cohere reranker endpoint so users can target Azure AI Foundry's serverless Cohere deployments (or any other Cohere-compatible host) instead of the hardcoded `https://api.cohere.com/v2/rerank`.

The LibreChat-side changes are already merged on branch `claude/review-librechat-issue-9XgW7` (PR target: `danny-avila/LibreChat`). The schema, config loader, SSRF allowlist, UI dialog, locales, env example, and tests all surface a new optional `cohereApiUrl` field.

**The remaining piece is in `@librechat/agents`** — the `CohereReranker` class still hardcodes the URL and `createReranker` does not accept `cohereApiUrl`. This plan covers exactly that gap. Once shipped, LibreChat's already-merged `cohereApiUrl` flow takes effect end-to-end without any further LibreChat changes.

## Repository

- Repo: `https://github.com/danny-avila/agents`
- Package name: `@librechat/agents`
- Current version (verified at time of writing): `3.1.78`
- Language: TypeScript

## Branch & Commit Convention

- Branch: `feat/cohere-reranker-api-url` (slash-based, descriptive)
- Commit format: `feat: <description>` — semantic, lowercase
- Bump to **`3.1.79`** (patch is fine: additive, fully backwards compatible)

## Target Files (verified to exist on `main`)

| File | Role |
|---|---|
| `src/tools/search/rerankers.ts` | `CohereReranker` class + `createReranker` factory |
| `src/tools/search/types.ts` | `SearchToolConfig` and reranker option types |
| `src/tools/search/tool.ts` | `createSearchTool` destructures auth fields and forwards to `createReranker` |
| `src/tools/search/jina-reranker.test.ts` | Existing test that mirrors the desired pattern |
| `src/tools/search/cohere-reranker.test.ts` | **NEW** — test file to be added |
| `package.json` | Version bump |

## Detailed Changes

### 1. `src/tools/search/rerankers.ts`

**Current `CohereReranker` constructor (verbatim):**

```ts
export class CohereReranker extends BaseReranker {
  constructor({
    apiKey = process.env.COHERE_API_KEY,
    logger,
  }: {
    apiKey?: string;
    logger?: t.Logger;
  }) {
    super(logger);
    this.apiKey = apiKey;
  }
```

**Replace with** (mirroring `JinaReranker` exactly):

```ts
export class CohereReranker extends BaseReranker {
  private apiUrl: string;

  constructor({
    apiKey = process.env.COHERE_API_KEY,
    apiUrl = process.env.COHERE_API_URL || 'https://api.cohere.com/v2/rerank',
    logger,
  }: {
    apiKey?: string;
    apiUrl?: string;
    logger?: t.Logger;
  }) {
    super(logger);
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }
```

**Current `rerank()` body — hardcoded URL** (verbatim, find this exact string):

```ts
      const response = await axios.post<t.CohereRerankerResponse | undefined>(
        'https://api.cohere.com/v2/rerank',
        requestData,
```

**Replace with:**

```ts
      const response = await axios.post<t.CohereRerankerResponse | undefined>(
        this.apiUrl,
        requestData,
```

**Also update the debug log** at the top of `rerank()`:

Current:
```ts
this.logger.debug(`Reranking ${documents.length} chunks with Cohere`);
```

Replace with:
```ts
this.logger.debug(`Reranking ${documents.length} chunks with Cohere using API URL: ${this.apiUrl}`);
```

**Update `createReranker` factory** — current (verbatim):

```ts
export const createReranker = (config: {
  rerankerType: t.RerankerType;
  jinaApiKey?: string;
  jinaApiUrl?: string;
  cohereApiKey?: string;
  logger?: t.Logger;
}): BaseReranker | undefined => {
  const { rerankerType, jinaApiKey, jinaApiUrl, cohereApiKey, logger } = config;

  // Create a default logger if none is provided
  const defaultLogger = logger || createDefaultLogger();

  switch (rerankerType.toLowerCase()) {
  case 'jina':
    return new JinaReranker({ apiKey: jinaApiKey, apiUrl: jinaApiUrl, logger: defaultLogger });
  case 'cohere':
    return new CohereReranker({
      apiKey: cohereApiKey,
      logger: defaultLogger,
    });
```

**Replace with:**

```ts
export const createReranker = (config: {
  rerankerType: t.RerankerType;
  jinaApiKey?: string;
  jinaApiUrl?: string;
  cohereApiKey?: string;
  cohereApiUrl?: string;
  logger?: t.Logger;
}): BaseReranker | undefined => {
  const { rerankerType, jinaApiKey, jinaApiUrl, cohereApiKey, cohereApiUrl, logger } = config;

  // Create a default logger if none is provided
  const defaultLogger = logger || createDefaultLogger();

  switch (rerankerType.toLowerCase()) {
  case 'jina':
    return new JinaReranker({ apiKey: jinaApiKey, apiUrl: jinaApiUrl, logger: defaultLogger });
  case 'cohere':
    return new CohereReranker({
      apiKey: cohereApiKey,
      apiUrl: cohereApiUrl,
      logger: defaultLogger,
    });
```

> Do NOT touch the `'infinity'`, `'none'`, or `default` switch arms.

### 2. `src/tools/search/types.ts`

Locate the `SearchToolConfig`-style interface around line 219 (the block that contains `jinaApiKey`, `jinaApiUrl`, `cohereApiKey`).

**Current (verbatim, lines ~219–221):**

```ts
  jinaApiKey?: string;
  jinaApiUrl?: string;
  cohereApiKey?: string;
```

**Replace with:**

```ts
  jinaApiKey?: string;
  jinaApiUrl?: string;
  cohereApiKey?: string;
  cohereApiUrl?: string;
```

> The interface name lives a few lines above the match; keep the indentation identical to neighbouring fields.

### 3. `src/tools/search/tool.ts`

Around line 354–356 the destructure pulls `jinaApiKey`, `jinaApiUrl`, `cohereApiKey` from `config`.

**Find:**
```ts
    jinaApiKey,
    jinaApiUrl,
    cohereApiKey,
    onSearchResults: _onSearchResults,
```

**Replace with:**
```ts
    jinaApiKey,
    jinaApiUrl,
    cohereApiKey,
    cohereApiUrl,
    onSearchResults: _onSearchResults,
```

Around line 431–435 the destructured fields are passed into `createReranker`.

**Find:**
```ts
  const selectedReranker = createReranker({
    rerankerType,
    jinaApiKey,
    jinaApiUrl,
    cohereApiKey,
```

**Replace with:**
```ts
  const selectedReranker = createReranker({
    rerankerType,
    jinaApiKey,
    jinaApiUrl,
    cohereApiKey,
    cohereApiUrl,
```

### 4. `src/tools/search/cohere-reranker.test.ts` (NEW)

Mirror `jina-reranker.test.ts` exactly. The constructor-level tests are the important ones — the network path doesn't need to be exercised.

```ts
import { CohereReranker } from './rerankers';
import { createDefaultLogger } from './utils';

describe('CohereReranker', () => {
  const mockLogger = createDefaultLogger();

  describe('constructor', () => {
    it('should use default API URL when no apiUrl is provided', () => {
      const originalEnv = process.env.COHERE_API_URL;
      delete process.env.COHERE_API_URL;

      const reranker = new CohereReranker({
        apiKey: 'test-key',
        logger: mockLogger,
      });

      // Access private property for testing
      const apiUrl = (reranker as any).apiUrl;
      expect(apiUrl).toBe('https://api.cohere.com/v2/rerank');

      if (originalEnv) {
        process.env.COHERE_API_URL = originalEnv;
      }
    });

    it('should use custom API URL when provided', () => {
      const customUrl = 'https://my-azure.endpoint.com/v1/rerank';
      const reranker = new CohereReranker({
        apiKey: 'test-key',
        apiUrl: customUrl,
        logger: mockLogger,
      });

      const apiUrl = (reranker as any).apiUrl;
      expect(apiUrl).toBe(customUrl);
    });

    it('should use environment variable COHERE_API_URL when available', () => {
      const originalEnv = process.env.COHERE_API_URL;
      process.env.COHERE_API_URL = 'https://env-cohere.example.com/v2/rerank';

      const reranker = new CohereReranker({
        apiKey: 'test-key',
        logger: mockLogger,
      });

      const apiUrl = (reranker as any).apiUrl;
      expect(apiUrl).toBe('https://env-cohere.example.com/v2/rerank');

      if (originalEnv) {
        process.env.COHERE_API_URL = originalEnv;
      } else {
        delete process.env.COHERE_API_URL;
      }
    });

    it('should prioritize explicit apiUrl over environment variable', () => {
      const originalEnv = process.env.COHERE_API_URL;
      process.env.COHERE_API_URL = 'https://env-cohere.example.com/v2/rerank';

      const customUrl = 'https://explicit-cohere.example.com/v2/rerank';
      const reranker = new CohereReranker({
        apiKey: 'test-key',
        apiUrl: customUrl,
        logger: mockLogger,
      });

      const apiUrl = (reranker as any).apiUrl;
      expect(apiUrl).toBe(customUrl);

      if (originalEnv) {
        process.env.COHERE_API_URL = originalEnv;
      } else {
        delete process.env.COHERE_API_URL;
      }
    });
  });
});
```

### 5. `package.json`

Bump:

```diff
- "version": "3.1.78",
+ "version": "3.1.79",
```

## Verification

Run from repo root:

```bash
npm install
npm run lint           # must pass clean
npm run build          # tsc must succeed
npm test -- src/tools/search/cohere-reranker.test.ts
npm test -- src/tools/search/jina-reranker.test.ts   # regression check
npm test               # full suite
```

All must pass. The lint config enforces import ordering and type-safety rules — no `any` outside the `(reranker as any).apiUrl` test helper that mirrors the existing Jina test pattern.

## Smoke Test (manual, optional)

Quick sanity check from a Node REPL once built:

```ts
import { CohereReranker } from '@librechat/agents';

const r1 = new CohereReranker({ apiKey: 'x' });
console.log((r1 as any).apiUrl);
// → 'https://api.cohere.com/v2/rerank'

const r2 = new CohereReranker({ apiKey: 'x', apiUrl: 'https://azure-host/rerank' });
console.log((r2 as any).apiUrl);
// → 'https://azure-host/rerank'
```

## Commit & PR

Single commit (squash on merge if maintainer prefers):

```
feat: configurable Cohere reranker API URL

Mirror the JinaReranker pattern by accepting an optional `apiUrl`
in the CohereReranker constructor (with COHERE_API_URL env-var
fallback) and propagating `cohereApiUrl` through `createReranker`
and the `createSearchTool` config.

Defaults to https://api.cohere.com/v2/rerank, fully backwards
compatible. Enables Azure AI Foundry serverless Cohere endpoints
and other Cohere-compatible deployments.

Refs https://github.com/danny-avila/LibreChat/issues/12328
```

PR title: `feat: configurable Cohere reranker API URL`

PR body must include:
- Link to LibreChat issue #12328.
- Note that the LibreChat-side wiring (schema, UI, env, SSRF allowlist) is already on branch `claude/review-librechat-issue-9XgW7` and will pick up `cohereApiUrl` automatically once this version ships.
- Backwards compatibility statement: existing callers that omit `apiUrl`/`cohereApiUrl` keep the current behaviour bit-for-bit.

## Out of Scope (do NOT include here)

- **Custom auth headers (e.g. `api-key:` instead of `Authorization: Bearer`).** Azure AI Foundry's Cohere serverless endpoints accept `Authorization: Bearer <key>`, so the URL change alone solves the primary use case. If a future Azure ML route needs `api-key:`, it can be a follow-up PR adding optional `authHeaderName` / `authHeaderPrefix` options.
- **Changes to `InfinityReranker` or `JinaReranker`** — leave untouched.
- **Cohere model selection.** `'rerank-v3.5'` stays the default; if Azure exposes a different model name, that's a separate option.
- **Any LibreChat repo changes** — already done on `claude/review-librechat-issue-9XgW7`.

## After Merge & npm Publish

Once `@librechat/agents@3.1.79` is published to npm, LibreChat needs a one-line follow-up bump:

In `LibreChat/api/package.json`:
```diff
-    "@librechat/agents": "^3.1.78",
+    "@librechat/agents": "^3.1.79",
```

Then `npm install` to refresh the lockfile and commit. That commit can ride on the existing `claude/review-librechat-issue-9XgW7` branch or be a separate small PR — whichever the LibreChat maintainers prefer.

## Acceptance Criteria

- [ ] `CohereReranker` accepts optional `apiUrl`; defaults preserved.
- [ ] `process.env.COHERE_API_URL` is honoured when constructor `apiUrl` is omitted.
- [ ] Explicit constructor `apiUrl` wins over the env var.
- [ ] `createReranker` accepts and forwards `cohereApiUrl`.
- [ ] `createSearchTool` config destructures `cohereApiUrl` and passes it to `createReranker`.
- [ ] `SearchToolConfig` (or equivalent in `types.ts`) declares `cohereApiUrl?: string`.
- [ ] New test file covers the four constructor cases (default, explicit, env, explicit-overrides-env).
- [ ] Existing Jina, Cohere (network mocked, if any), and Infinity tests still pass.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.
- [ ] Version bumped to `3.1.79` in `package.json`.
- [ ] PR opened against `main` referencing LibreChat issue #12328.
