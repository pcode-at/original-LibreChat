import http from 'http';
import https from 'https';

/**
 * Dedicated agents for code-server requests, preventing socket pool contamination.
 * follow-redirects (used by axios) leaks `socket.destroy` as a timeout listener;
 * on Node 19+ (keepAlive: true by default), tainted sockets re-enter the global pool
 * and kill unrelated requests (e.g., node-fetch in CodeExecutor) after the idle timeout.
 */
export const codeServerHttpAgent = new http.Agent({ keepAlive: false });
export const codeServerHttpsAgent = new https.Agent({ keepAlive: false });

/**
 * Narrows the `execute_code` tool's advertised language enum to those the
 * configured code-execution backend actually supports. The agents library
 * advertises every language it can dispatch (incl. `bash`), but a given
 * sandbox (e.g. kubecoderun) may accept only a subset; without filtering,
 * models pick rejected runtimes and the call 400s with
 * `Unsupported programming language`.
 *
 * Reads `LIBRECHAT_CODE_API_SUPPORTED_LANGS` — a comma-separated allow-list
 * (e.g. `py,js,ts,go,r`). Unknown entries are ignored, empty/unset returns
 * `null` (caller keeps the library default), and an entirely empty result
 * after filtering also returns `null` to avoid producing an unusable
 * zero-language enum.
 */
export function filterCodeExecutionLanguages<T extends string>(
  available: readonly T[],
): T[] | null {
  const raw = process.env.LIBRECHAT_CODE_API_SUPPORTED_LANGS;
  if (raw == null || raw.trim() === '') {
    return null;
  }
  const requested = new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== ''),
  );
  if (requested.size === 0) {
    return null;
  }
  const filtered = available.filter((lang) => requested.has(lang.toLowerCase()));
  return filtered.length > 0 ? filtered : null;
}
