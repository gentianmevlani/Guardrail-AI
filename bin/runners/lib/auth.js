const fs = require("fs");
const path = require("path");
const os = require("os");

// Config paths
function getConfigPath() {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "guardrail",
      "config.json",
    );
  }
  return path.join(home, ".config", "guardrail", "config.json");
}

function ensureConfigDir(configPath) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Get API Key
function getApiKey() {
  // 1. Env var (CI/Production)
  if (process.env.GUARDRAIL_API_KEY) {
    return { key: process.env.GUARDRAIL_API_KEY, source: "env" };
  }

  // 2. User config
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.apiKey) {
        return { key: config.apiKey, source: "user" };
      }
    }
  } catch (err) {
    // ignore config errors
  }

  return { key: null, source: null };
}

// 2. Save API Key
function saveApiKey(apiKey) {
  const configPath = getConfigPath();
  ensureConfigDir(configPath);

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (err) {
    // ignore, start fresh
  }

  config.apiKey = apiKey;
  // Also save a basic user structure if needed, but for now just key

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

// 3. Delete API Key
function deleteApiKey() {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      delete config.apiKey;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
        mode: 0o600,
      });
    }
  } catch (err) {
    // ignore
  }
}

// 4. Get Entitlements (Mocked for now, but ready for API)
// In real world: fetch from GET /v1/auth/whoami
async function getEntitlements(apiKey) {
  if (!apiKey) return null;

  // Check cache first
  const configPath = getConfigPath();
  const cachePath = path.join(
    path.dirname(configPath),
    "entitlements-cache.json",
  );

  try {
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      // Check if same key and fresh (10 mins)
      if (
        cache.keyHash === Buffer.from(apiKey).toString("base64") &&
        Date.now() - cache.timestamp < 10 * 60 * 1000
      ) {
        return cache.data;
      }
    }
  } catch (err) {
    // ignore cache errors
  }

  // Simulate API delay
  // await new Promise(r => setTimeout(r, 100));

  // Call the real API endpoint
  let res;
  try {
    // Try production API first, then fallback to localhost for development
    const apiUrl =
      process.env.GUARDRAIL_API_URL || "https://api.guardrail.dev";
    const urls = [apiUrl, "http://localhost:3000"];

    for (const url of urls) {
      try {
        res = await fetch(`${url}/v1/auth/whoami`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        if (res.ok) break;
      } catch (e) {
        // Try next URL
        continue;
      }
    }

    if (!res || !res.ok) {
      throw new Error("API unavailable");
    }
  } catch (error) {
    // SECURITY: Do not fallback to mock entitlements
    // If API is unavailable, fail gracefully with clear error message
    throw new Error(
      "Cannot connect to guardrail API. API connection required for this feature. " +
      "Please check your network connection and ensure GUARDRAIL_API_URL is set correctly."
    );
  }

  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${res.statusText}`);
  }

  const result = await res.json();

  // Write to cache
  try {
    ensureConfigDir(cachePath);
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          keyHash: Buffer.from(apiKey).toString("base64"),
          timestamp: Date.now(),
          data: result,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    // ignore cache write errors
  }

  return result;
}

// 5. Check Entitlement
async function checkEntitlement(requiredScope) {
  const { key } = getApiKey();
  if (!key) {
    return {
      allowed: false,
      reason:
        'No API key found. Run "guardrail login" or set GUARDRAIL_API_KEY.',
    };
  }

  const entitlements = await getEntitlements(key);
  if (!entitlements) {
    return { allowed: false, reason: "Invalid API key." };
  }

  if (
    entitlements.scopes.includes(requiredScope) ||
    entitlements.scopes.includes("*")
  ) {
    return { allowed: true, plan: entitlements.plan };
  }

  return {
    allowed: false,
    reason: `Plan '${entitlements.plan}' does not support this feature. Required scope: ${requiredScope}`,
  };
}

module.exports = {
  getApiKey,
  saveApiKey,
  deleteApiKey,
  getEntitlements,
  checkEntitlement,
  getConfigPath,
};
