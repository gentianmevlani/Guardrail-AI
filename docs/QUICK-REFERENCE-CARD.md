# guardrail Quick Reference Card

> Print this or keep it open while coding!

---

## Setup (One Time)

```bash
cd mcp-server && npm install
```

Then add to your AI editor config:
```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["./mcp-server/index.js"]
    }
  }
}
```

---

## The 5 Commands You'll Use Most

| Command | What It Does | When To Use |
|---------|-------------|-------------|
| **Ship Check** | "Is this ready?" | Before deploying |
| **Checkpoint** | Block bad code | Always on |
| **Architect** | Get coding advice | Before new features |
| **Intent** | Stay focused | Complex tasks |
| **Reality** | Browser testing | After building UI |

---

## Copy-Paste Prompts

### Before You Deploy
```
Run guardrail ship check on this project
```

### Set Code Quality Level
```
Set guardrail checkpoint strictness to standard
```
Options: `chill` | `standard` | `strict` | `paranoid`

### Before Building Something New
```
Use guardrail architect suggest for [what you're building]
```

### Stay Focused on One Task
```
Use guardrail intent start with prompt '[your task]' and lock it
```

### Check If You Drifted
```
Use guardrail intent check
```

### Test In Real Browser
```
Run guardrail reality mode on http://localhost:3000
```

### Find Fake/Mock Data
```
Run guardrail proof mocks
```

---

## Strictness Levels Explained

| Level | Blocks These |
|-------|-------------|
| **Chill** | TODOs, FIXMEs, mock data, "lorem ipsum" |
| **Standard** | + console.log, debugger, localhost URLs |
| **Strict** | + `any` types, @ts-ignore, eslint-disable |
| **Paranoid** | + nested ternaries, inline styles |

---

## Status Icons

| Icon | Meaning |
|------|---------|
| ✅ GO | Safe to ship |
| ⚠️ WARN | Has issues, review them |
| 🚫 NO-GO | Fix before shipping |
| 🔒 LOCKED | Intent is locked |
| 🎯 ALIGNED | Code matches intent |
| ❌ DRIFTED | Code went off-track |

---

## If Something Goes Wrong

**Server not connecting?**
1. Check the path in your config
2. Restart your editor
3. Run `node mcp-server/index.js` manually to see errors

**Too many blocks?**
```
Set guardrail checkpoint strictness to chill
```

**Want to unlock intent?**
```
Use guardrail intent unlock
```

---

## File Locations

| What | Where |
|------|-------|
| MCP Server | `mcp-server/index.js` |
| Config | `guardrail.config.json` |
| Reports | `.guardrail/` folder |
| Rules | `.cursorrules` or `.windsurf/rules/` |

---

**Full docs:** `/docs/GETTING-STARTED-FOR-VIBE-CODERS.md`
