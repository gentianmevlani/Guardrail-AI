# Video Recording Guide - Step by Step

This guide tells you EXACTLY what to do for each shot. Follow it frame by frame.

---

## BEFORE YOU RECORD

### Setup Checklist

- [ ] Open Cursor or Windsurf
- [ ] Have `bad-code-example.ts` ready in `/examples/demo-for-video/`
- [ ] Have `good-code-example.ts` ready for comparison
- [ ] MCP server installed (`cd mcp-server && npm install`)
- [ ] MCP configured in your editor
- [ ] Screen recording software ready (OBS, Loom, etc.)
- [ ] Resolution: 1920x1080 or 2560x1440
- [ ] Dark theme recommended (looks better on video)
- [ ] Increase font size to 16-18px for readability

---

## SHOT LIST

### SHOT 1: The Problem (0:00 - 0:30)

**What to show:** Bad code with issues highlighted

1. Open `examples/demo-for-video/bad-code-example.ts`
2. Slowly scroll through the file
3. Pause briefly on each issue:
   - Line 5-6: TODO and FIXME comments
   - Line 12-15: mockUsers array
   - Line 17: fakeApiKey
   - Line 21-22: console.log statements
   - Line 25: localhost URL
   - Line 30-32: Empty catch block

**Voiceover timing:** Start speaking when file opens

---

### SHOT 2: Install (0:30 - 1:00)

**What to show:** Terminal running npm install

1. Open terminal (split view or separate window)
2. Type and run:

```bash
cd mcp-server
```

3. Then type and run:

```bash
npm install
```

4. Wait for install to complete (fast-forward in editing if slow)

**Expected output:**
```
added 45 packages, and audited 46 packages in 3s
found 0 vulnerabilities
```

---

### SHOT 3: Configure Editor - Cursor (1:00 - 1:45)

**What to show:** Cursor settings

1. Press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings
2. Type "MCP" in search bar
3. Click "Edit in settings.json"
4. Show existing config (if any)
5. Type or paste this config:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["C:/Users/YOUR_PATH/mcp-server/index.js"]
    }
  }
}
```

6. Save file (`Ctrl+S`)
7. Show the "Restart required" notification (if it appears)
8. Restart Cursor

---

### SHOT 4: Configure Editor - Windsurf (1:45 - 2:30)

**Alternative shot if showing Windsurf instead**

1. Press `Ctrl+Shift+P` to open Command Palette
2. Type "Windsurf MCP" and select "Open MCP Config"
3. Paste config:

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

4. Save and restart

---

### SHOT 5: Test Connection (2:30 - 3:00)

**What to show:** AI chat panel

1. Open AI chat panel (sidebar)
2. Type exactly:

```
What guardrail tools are available?
```

3. Wait for response

**Expected response (summarized):**
```
Available guardrail tools:
- guardrail.ship - Quick health check
- guardrail.scan - Deep analysis
- guardrail_checkpoint - Pre-write validation
- guardrail_architect_review - Code review
- guardrail_intent_start - Intent tracking
... (more tools listed)
```

4. Smile/nod - it's working!

---

### SHOT 6: First Ship Check (3:00 - 3:45)

**What to show:** Running ship check and seeing results

1. In AI chat, type:

```
Run guardrail ship check on this project
```

2. Wait for scan to run (10-30 seconds)

**Expected response:**
```
# 🚀 guardrail Ship

**Path:** C:/path/to/project

## Score: 45/100 (D)

**Verdict:** 🚫 NO-GO

### Issues Found:
- 🔴 8 console.log statements
- 🔴 3 TODO/FIXME comments  
- 🔴 2 hardcoded API keys
- 🟡 5 mock/placeholder data instances
- 🟡 2 empty catch blocks

Run `guardrail fix --plan` to see recommended fixes.
```

3. React to the NO-GO verdict
4. Scroll through issues list

---

### SHOT 7: Enable Checkpoint (3:45 - 4:30)

**What to show:** Setting strictness and seeing it block bad code

1. In AI chat, type:

```
Set guardrail checkpoint strictness to standard
```

**Expected response:**
```
🛡️ Checkpoint strictness set to: STANDARD

Active rules:
- no-todo: TODO comment - complete before moving on
- no-fixme: FIXME comment - fix it now
- no-mock-data: Mock data detected
- no-console-log: console.log - remove or use proper logging
- no-debugger: debugger statement
- no-localhost: Hardcoded localhost
- no-empty-catch: Empty catch block
```

2. Now try to write bad code. Type:

```
Add a new function that logs user data to console
```

3. Watch the AI attempt to write code and get BLOCKED

**Expected blocking message:**
```
🛑 CHECKPOINT BLOCKED
══════════════════════════════════════════════════
File: new-function.ts

  ❌ Line 3: console.log - remove or use proper logging
     console.log('User data:', userData);

══════════════════════════════════════════════════
Fix these issues before proceeding.
```

4. Show reaction - "See? It caught that!"

---

### SHOT 8: Intent Lock (4:30 - 5:00)

**What to show:** Locking intent and blocking scope creep

1. In AI chat, type:

```
Use guardrail intent start with prompt 'Add a login form with email validation' and lock it
```

**Expected response:**
```
🎯 Intent captured: "Add a login form with email validation..."

Intent: {
  id: "intent-1234567-abc",
  type: "feature",
  locked: true,
  expectedArtifacts: {
    routes: [{ method: "POST", path: "/api/login" }],
    components: ["LoginForm"],
    exports: ["authenticateUser", "verifyPassword"]
  }
}

Next step: Make your code changes, then call guardrail_intent_check to verify alignment.
```

2. Now try to expand scope. Type:

```
Actually, also add a registration form and password reset
```

3. Watch it get blocked

**Expected blocking message:**
```
🔒 INTENT LOCKED: Adding new feature not allowed. Complete current step first.

Original intent: "Add a login form with email validation..."

💡 Run "guardrail intent complete" or "guardrail intent unlock" to proceed.
```

4. Show reaction - "It keeps you focused!"

---

### SHOT 9: Before/After Comparison (optional B-roll)

**What to show:** Side-by-side code comparison

1. Split screen or picture-in-picture
2. Left: `bad-code-example.ts` with issues highlighted
3. Right: `good-code-example.ts` - clean version

Highlight differences:
- mockUsers → getUsers() from database
- console.log → logger.info
- any types → proper interfaces
- empty catch → proper error handling
- hardcoded keys → process.env

---

### SHOT 10: Outro (5:00 - 5:15)

**What to show:** Final summary

1. Show the Quick Reference Card in browser/editor
2. Show link to docs
3. Wave/thumbs up

---

## EDITING NOTES

### Speed Adjustments
- **Speed up:** npm install, waiting for responses
- **Slow down:** Typing commands, showing results
- **Real-time:** Reactions, explanations

### Zoom Suggestions
- Zoom in when typing commands
- Zoom in on error messages
- Full screen when showing file structure

### Text Overlays to Add
| Timestamp | Text |
|-----------|------|
| 0:05 | "Your AI leaves behind..." |
| 0:15 | "TODOs, console.logs, mock data" |
| 0:30 | "guardrail catches it all" |
| 1:00 | "Step 1: Install" |
| 1:30 | "Step 2: Configure" |
| 2:30 | "Step 3: Test" |
| 3:00 | "Step 4: Ship Check" |
| 3:45 | "Step 5: Auto-Blocking" |
| 4:30 | "Step 6: Stay Focused" |
| 5:00 | "Links in description ⬇️" |

### Audio
- Background music: Lo-fi or tech beats (low volume)
- Sound effects: Subtle "ding" on success, "buzz" on block

---

## BACKUP PLAN

If something doesn't work during recording:

1. **MCP not connecting:** Run `node mcp-server/index.js` manually in terminal to see errors
2. **No tools showing:** Restart editor completely
3. **Checkpoint not blocking:** Make sure strictness is set to "standard" or higher
4. **Intent not locking:** Make sure you said "and lock it" in the command

---

## QUICK COMMANDS REFERENCE

Copy-paste these exactly:

```
What guardrail tools are available?
```

```
Run guardrail ship check on this project
```

```
Set guardrail checkpoint strictness to standard
```

```
Add a new function that logs user data to console
```

```
Use guardrail intent start with prompt 'Add a login form with email validation' and lock it
```

```
Actually, also add a registration form and password reset
```

---

## POST-PRODUCTION

1. Export at 1080p or 4K
2. Add thumbnail (see VIDEO-SCRIPT for ideas)
3. Add end screen with subscribe button
4. Add chapters in YouTube description matching timestamps
5. Pin comment with links to docs
