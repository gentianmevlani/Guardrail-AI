/**
 * Regex patterns for PerformanceAntipatternEngine — performance anti-pattern detection.
 */

// PERF001 — N+1: await DB call inside loop
export const LOOP_START_RE = /(?:for\s*\(|for\s*\(const|while\s*\(|\.forEach\s*\(|\.map\s*\(|\.reduce\s*\()/;
export const DB_AWAIT_RE =
  /await\s+(?:prisma\.\w+\.(?:findMany|findFirst|findUnique|create|update|delete)|(?:db|pool|knex|sequelize)\.(?:query|raw)|mongoose\.\w+\.(?:find|findOne)|\.(?:find|findOne|findMany)\s*\()/;

// PERF002 — Unbounded query without pagination
export const UNBOUNDED_QUERY_RE =
  /(?:prisma\.\w+\.findMany|\.find\s*\(\s*\{\s*\}|\.findMany\s*\(\s*\)|\.toArray\s*\(\s*\))/;
export const PAGINATION_PARAMS = /take|skip|limit|first|cursor|page|pageSize/;

// PERF003 — React component in map without memo
export const COMPONENT_IN_MAP_RE = /\.map\s*\(\s*(?:\w+|\s*\(\s*\w+\s*\))\s*=>\s*<\s*\w+/;
export const REACT_MEMO_RE = /React\.memo|useMemo/;

// PERF004 — Sync file I/O at module level
export const SYNC_IO_RE =
  /(?:readFileSync|writeFileSync|existsSync|readdirSync|statSync)\s*\(/;

// PERF005 — Unoptimized img in Next.js
export const RAW_IMG_RE = /<img\s+/;
export const NEXT_IMAGE_RE = /next\/image|Image\s+from\s+['"]next\/image['"]/;

// PERF006 — String search without index hint
export const STRING_SEARCH_RE =
  /(?:contains|startsWith|like|LIKE)\s*(?:\(|:)/i;
export const ORDER_BY_RE = /orderBy|order by/i;

// PERF007 — Fetch in React render body (not in useEffect)
export const FETCH_IN_RENDER_RE =
  /(?:fetch|axios\.(?:get|post))\s*\([^)]*\)\s*(?:\.then|;)/;
