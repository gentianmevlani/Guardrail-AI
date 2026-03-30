/**
 * Minimal typings for `glob@7` (callback API). Keeps `tsc` happy when `@types/glob`
 * is not hoisted or devDeps are skipped in constrained installs.
 */
declare module 'glob' {
  export interface IOptions {
    cwd?: string;
    root?: string;
    dot?: boolean;
    nomount?: boolean;
    mark?: boolean;
    nosort?: boolean;
    stat?: boolean;
    silent?: boolean;
    strict?: boolean;
    cache?: Record<string, boolean | string | string[]>;
    symlinks?: Record<string, boolean>;
    sync?: boolean;
    nounique?: boolean;
    nonull?: boolean;
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    noext?: boolean;
    nocase?: boolean;
    matchBase?: boolean;
    nodir?: boolean;
    ignore?: string | readonly string[];
    follow?: boolean;
    realpath?: boolean;
    absolute?: boolean;
  }

  function glob(pattern: string, cb: (err: Error | null, matches: string[]) => void): void;
  function glob(pattern: string, options: IOptions, cb: (err: Error | null, matches: string[]) => void): void;

  export = glob;
}
