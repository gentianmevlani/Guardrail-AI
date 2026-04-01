/**
 * Regex patterns for TypeContractEngine — type/interface extraction and property access.
 */

/** interface Name { ... } or interface Name extends X { ... } */
export const INTERFACE_DECL_RE =
  /interface\s+(\w+)\s*(?:extends\s+[\w<>,\s]+)?\s*\{/g;

/** type Name = { ... } */
export const TYPE_ALIAS_OBJECT_RE = /type\s+(\w+)\s*=\s*\{/g;

/** Field inside { }: fieldName?: Type or fieldName: Type */
export const FIELD_EXTRACT_RE = /(\w+)\s*[?]?\s*:/g;

/** as TypeName assertion */
export const AS_TYPE_RE = /as\s+(\w+)/g;

/** : TypeName annotation on variable/param */
export const COLON_TYPE_RE = /:\s*(\w+)(?:\s*[;,\)\]\}]|$)/g;

/** Generic type param: useQuery<Type>, useMutation<Type> */
export const GENERIC_TYPE_RE = /<(?:[\w.]+\s*,\s*)*(\w+)>/g;

/** Property access: obj.prop */
export const PROP_ACCESS_RE = /(\w+)\.(\w+)/g;

/** Optional chaining: obj?.prop */
export const OPTIONAL_PROP_RE = /(\w+)\?\.(\w+)/g;

/** Known typed API patterns */
export const TYPED_API_PATTERNS = [
  /fetch\s*\([^)]*\)\s*\.then\s*\([^)]*=>\s*[^)]*\.json\s*\(\s*\)\s*\)\s*as\s+(\w+)/,
  /axios\.(?:get|post|put|delete)\s*<\s*(\w+)\s*>/,
  /supabase\.from\s*\([^)]+\)\.select\s*\([^)]*\)\.single\s*\(\s*\)/,
  /prisma\.\w+\.(?:findMany|findFirst|findUnique|create|update|delete)/,
  /JSON\.parse\s*\([^)]+\)\s*as\s+(\w+)/,
  /useQuery\s*<\s*(\w+)\s*>/,
  /useMutation\s*<\s*(\w+)\s*>/,
];
