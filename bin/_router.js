const LEGACY_MAP = {
  // ship is now first-class command, not legacy
  // reality is now its own command - no longer routes to proof
  mockproof: { to: ["proof", "mocks"] },
  hygiene: { to: ["scan", "--only=hygiene"] },
  security: { to: ["scan", "--only=security"] },
  auth: { to: ["scan", "--only=auth"] },
  routes: { to: ["scan", "--only=routes"] },
  api: { to: ["scan", "--only=contracts"] }, // rename internal concept to contracts
  mock: { to: ["scan", "--only=mocks"] },
};

function routeArgv(argv) {
  const args = argv.slice(2);
  const first = args[0];

  // Handle top-level flags that act as commands
  if (first === "--version" || first === "-v") {
    return { legacyFrom: null, routed: ["version"] };
  }
  if (first === "--help" || first === "-h") {
    return { legacyFrom: null, routed: ["help"] };
  }

  // Default command if none
  if (!first || first.startsWith("-")) {
    return { legacyFrom: null, routed: ["scan", ...args] };
  }

  // Legacy alias handling
  if (LEGACY_MAP[first]) {
    const mapped = LEGACY_MAP[first].to;
    const rest = args.slice(1);
    return { legacyFrom: first, routed: [...mapped, ...rest] };
  }

  // validate logic
  if (first === "validate") {
    return { legacyFrom: null, routed: args };
  }

  // Already new-style
  return { legacyFrom: null, routed: args };
}

module.exports = { routeArgv };
