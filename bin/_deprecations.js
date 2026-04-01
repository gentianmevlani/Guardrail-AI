const fs = require("fs");
const os = require("os");
const path = require("path");

function cachePath() {
  return path.join(os.homedir(), ".guardrail", "deprecations.json");
}

function warnDeprecationOnce(legacyFrom, suggestion, version = "dev") {
  if (!legacyFrom) return;
  if (process.env.GUARDRAIL_SILENCE_DEPRECATIONS === "1") return;

  const file = cachePath();
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}

  const key = `${legacyFrom}@${version}`;
  if (cache[key]) return;

  process.stderr.write(
    `Deprecation: 'guardrail ${legacyFrom}' → use 'guardrail ${suggestion}'\n`,
  );

  cache[key] = new Date().toISOString();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2));
  } catch (err) {
    // Ignore cache write errors (e.g. permission issues)
  }
}

module.exports = { warnDeprecationOnce };
