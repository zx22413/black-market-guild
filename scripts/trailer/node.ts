// Node's modules for the trailer scripts, loaded untyped: the project compiles scripts without
// Node type definitions (as scripts/raster-ui-art.ts does), so only what the scripts use is typed.

interface Fs {
  mkdirSync(path: string, options?: { readonly recursive: boolean }): void;
  mkdtempSync(prefix: string): string;
  readFileSync(path: string, encoding: 'utf8'): string;
  writeFileSync(path: string, data: string | Uint8Array): void;
  readdirSync(path: string): string[];
  existsSync(path: string): boolean;
  rmSync(path: string, options: { readonly recursive: boolean; readonly force: boolean }): void;
}
export interface Child {
  kill(): void;
}
interface ChildProcess {
  spawn(command: string, args: readonly string[], options: { readonly stdio: 'ignore' | 'inherit' }): Child;
  execFileSync(command: string, args: readonly string[], options: { readonly stdio: 'inherit' | 'pipe'; readonly encoding?: 'utf8' }): string;
}
interface Os {
  tmpdir(): string;
}
interface Process {
  on(event: 'exit', listener: () => void): void;
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
}

const NODE_FS = 'node:fs';
const NODE_CHILD_PROCESS = 'node:child_process';
const NODE_OS = 'node:os';

export const fs = (await import(NODE_FS)) as Fs;
export const childProcess = (await import(NODE_CHILD_PROCESS)) as ChildProcess;
export const os = (await import(NODE_OS)) as Os;
export const proc = (globalThis as unknown as { process: Process }).process;

/** `--name value` pairs (repeatable names collect into a list) from the command line. */
export function args(): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  const list = proc.argv.slice(2);
  for (let i = 0; i < list.length; i++) {
    const key = list[i]!;
    if (!key.startsWith('--')) continue;
    const value = list[i + 1] !== undefined && !list[i + 1]!.startsWith('--') ? list[++i]! : 'true';
    out.set(key.slice(2), [...(out.get(key.slice(2)) ?? []), value]);
  }
  return out;
}

/** Base64 to bytes (a screenshot from the DevTools protocol). */
export function bytes(base64: string): Uint8Array {
  const text = atob(base64);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}
