import type { DeepPartial, TCustomConfig } from 'librechat-data-provider';
import { EModelEndpoint, defaultAssistantsVersion } from 'librechat-data-provider';
import { AppService, loadSummarizationConfig } from './service';
import logger from '~/config/winston';

jest.mock('~/config/winston', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('loadSummarizationConfig', () => {
  const warnSpy = logger.warn as jest.Mock;

  beforeEach(() => {
    warnSpy.mockClear();
  });

  it('returns undefined when no summarization config is provided', () => {
    expect(loadSummarizationConfig({} as DeepPartial<TCustomConfig>)).toBeUndefined();
  });

  it('accepts a valid token_ratio trigger', () => {
    const result = loadSummarizationConfig({
      summarization: {
        enabled: true,
        trigger: { type: 'token_ratio', value: 0.8 },
      },
    } as DeepPartial<TCustomConfig>);

    expect(result).toBeDefined();
    expect(result?.enabled).toBe(true);
    expect(result?.trigger).toEqual({ type: 'token_ratio', value: 0.8 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits a targeted migration warning when trigger.type is the legacy "token_count"', () => {
    const result = loadSummarizationConfig({
      summarization: {
        trigger: { type: 'token_count', value: 8000 },
      },
    } as unknown as DeepPartial<TCustomConfig>);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain('token_count');
    expect(message).toContain('token_ratio');
    expect(message).toContain('remaining_tokens');
    expect(message).toContain('messages_to_refine');
    expect(message).toContain('fall back');
  });

  it('falls back to the generic warning when trigger is a bare string (not an object)', () => {
    const result = loadSummarizationConfig({
      summarization: {
        trigger: 'token_count',
      },
    } as unknown as DeepPartial<TCustomConfig>);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('Invalid summarization config');
  });

  it('falls back to the generic warning for other schema violations', () => {
    const result = loadSummarizationConfig({
      summarization: {
        trigger: { type: 'token_ratio', value: 80 },
      },
    } as unknown as DeepPartial<TCustomConfig>);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('Invalid summarization config');
  });
});

describe('AppService assistants config', () => {
  it('preserves configured Assistants API versions', async () => {
    const config = {
      endpoints: {
        [EModelEndpoint.assistants]: {
          version: 'v3',
        },
        [EModelEndpoint.azureOpenAI]: {
          assistants: true,
          groups: [
            {
              group: 'azure-assistants-test',
              apiKey: 'test-key',
              instanceName: 'azure-assistants-test',
              assistants: true,
              version: '2024-02-15-preview',
              models: {
                'gpt-4': {
                  deploymentName: 'gpt-4',
                },
              },
            },
          ],
        },
        [EModelEndpoint.azureAssistants]: {
          version: 4,
        },
      },
    } as DeepPartial<TCustomConfig>;

    const result = await AppService({ config });

    expect(result.endpoints?.[EModelEndpoint.assistants]?.version).toBe('v3');
    expect(result.endpoints?.[EModelEndpoint.azureAssistants]?.version).toBe(4);
  });

  it('keeps Azure Assistants default version when only Azure OpenAI enables assistants', async () => {
    const config = {
      endpoints: {
        [EModelEndpoint.azureOpenAI]: {
          assistants: true,
          groups: [
            {
              group: 'azure-assistants-test',
              apiKey: 'test-key',
              instanceName: 'azure-assistants-test',
              assistants: true,
              version: '2024-02-15-preview',
              models: {
                'gpt-4': {
                  deploymentName: 'gpt-4',
                },
              },
            },
          ],
        },
      },
    } as DeepPartial<TCustomConfig>;

    const result = await AppService({ config });

    expect(result.endpoints?.[EModelEndpoint.azureAssistants]?.version).toBe(
      defaultAssistantsVersion.azureAssistants,
    );
  });
});

describe('AppService allowedDomains env resolution', () => {
  const ENV_KEY = 'TEST_MCP_ALLOWED_DOMAINS';

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('resolves ${ENV_VAR} and expands a comma-separated list in mcpSettings.allowedDomains', async () => {
    process.env[ENV_KEY] = 'http://mastra:4111,https://api.example.com';
    const config = {
      mcpSettings: { allowedDomains: ['${TEST_MCP_ALLOWED_DOMAINS}'] },
    } as DeepPartial<TCustomConfig>;

    const result = await AppService({ config });

    expect(result.mcpSettings?.allowedDomains).toEqual([
      'http://mastra:4111',
      'https://api.example.com',
    ]);
  });

  it('resolves env references in actions.allowedDomains', async () => {
    process.env[ENV_KEY] = 'a.com,b.com';
    const config = {
      actions: { allowedDomains: ['${TEST_MCP_ALLOWED_DOMAINS}'] },
    } as DeepPartial<TCustomConfig>;

    const result = await AppService({ config });

    expect(result.actions?.allowedDomains).toEqual(['a.com', 'b.com']);
  });

  it('leaves literal domains untouched', async () => {
    const config = {
      mcpSettings: { allowedDomains: ['http://mastra:4111', '*.example.com'] },
    } as DeepPartial<TCustomConfig>;

    const result = await AppService({ config });

    expect(result.mcpSettings?.allowedDomains).toEqual(['http://mastra:4111', '*.example.com']);
  });
});
