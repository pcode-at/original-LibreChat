import { filterCodeExecutionLanguages } from './code';

const ENV_KEY = 'LIBRECHAT_CODE_API_SUPPORTED_LANGS';
const ALL_LANGS = [
  'py',
  'js',
  'ts',
  'c',
  'cpp',
  'java',
  'php',
  'rs',
  'go',
  'd',
  'f90',
  'r',
  'bash',
] as const;

describe('filterCodeExecutionLanguages', () => {
  let original: string | undefined;

  beforeAll(() => {
    original = process.env[ENV_KEY];
  });

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterAll(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it('returns null when the env var is not set', () => {
    expect(filterCodeExecutionLanguages(ALL_LANGS)).toBeNull();
  });

  it('returns null when the env var is whitespace only', () => {
    process.env[ENV_KEY] = '   ';
    expect(filterCodeExecutionLanguages(ALL_LANGS)).toBeNull();
  });

  it('filters the enum to the allow-listed languages, preserving original order', () => {
    process.env[ENV_KEY] = 'r,py,go';
    expect(filterCodeExecutionLanguages(ALL_LANGS)).toEqual(['py', 'go', 'r']);
  });

  it('strips whitespace and lowercases entries before matching', () => {
    process.env[ENV_KEY] = '  PY ,  Js , Ts ';
    expect(filterCodeExecutionLanguages(ALL_LANGS)).toEqual(['py', 'js', 'ts']);
  });

  it('ignores entries that are not in the available list', () => {
    process.env[ENV_KEY] = 'py,kotlin,brainfuck,js';
    expect(filterCodeExecutionLanguages(ALL_LANGS)).toEqual(['py', 'js']);
  });

  it('returns null when no allow-listed entry matches an available language', () => {
    process.env[ENV_KEY] = 'kotlin,brainfuck';
    expect(filterCodeExecutionLanguages(ALL_LANGS)).toBeNull();
  });

  it('excludes bash for kubecoderun-style deployments', () => {
    process.env[ENV_KEY] = 'py,js,ts,c,cpp,java,php,rs,go,d,f90,r';
    expect(filterCodeExecutionLanguages(ALL_LANGS)).not.toContain('bash');
  });
});
