# guardrail Setup Walkthrough - Video Script

**Duration:** ~5 minutes  
**Target Audience:** Vibe coders, AI-assisted developers, beginners  
**Tone:** Friendly, casual, encouraging

---

## INTRO (0:00 - 0:30)

**[SCREEN: Show broken app with console errors]**

> Hey! So you've been coding with AI — Cursor, Windsurf, Claude, whatever — and it's amazing. But here's the thing...

**[SCREEN: Zoom in on a TODO comment in code]**

> Sometimes your AI leaves stuff behind. TODOs that never get done. Console.logs everywhere. Mock data that shouldn't go to production. And you don't notice until your users do.

**[SCREEN: Show guardrail logo]**

> guardrail catches all of that before you ship. Let me show you how to set it up in literally 5 minutes.

---

## STEP 1: INSTALL (0:30 - 1:00)

**[SCREEN: Terminal window]**

> First, open your terminal in your project folder. Navigate to the mcp-server directory and install:

```bash
cd mcp-server
npm install
```

**[SCREEN: Show npm install completing]**

> That's it for the install. Now we need to connect it to your AI editor.

---

## STEP 2: CONFIGURE YOUR EDITOR (1:00 - 2:30)

### For Cursor Users

**[SCREEN: Cursor settings]**

> If you're using Cursor, open your settings with Control-Comma or Command-Comma on Mac.

> Search for "MCP" and click "Edit in settings.json"

**[SCREEN: Show JSON config]**

> Add this configuration. The important part is the path — make sure it points to YOUR project's mcp-server folder.

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["C:/path/to/your/project/mcp-server/index.js"]
    }
  }
}
```

> Save the file and restart Cursor.

### For Windsurf Users

**[SCREEN: Windsurf command palette]**

> If you're on Windsurf, hit Control-Shift-P to open the command palette.

> Type "Windsurf MCP Config" and hit enter.

**[SCREEN: Show config file]**

> Same deal — add the guardrail server config:

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

> Save and restart.

---

## STEP 3: TEST IT (2:30 - 3:00)

**[SCREEN: Chat panel in editor]**

> Now let's make sure it's working. Open your AI chat and type:

> "What guardrail tools are available?"

**[SCREEN: Show AI listing tools]**

> If you see a list of tools like guardrail.ship, guardrail.scan, guardrail_checkpoint — you're connected!

---

## STEP 4: YOUR FIRST SHIP CHECK (3:00 - 3:45)

**[SCREEN: Chat panel]**

> Let's run your first check. Type:

> "Run guardrail ship check on my project"

**[SCREEN: Show ship check running with results]**

> guardrail scans your entire codebase and gives you a verdict:
> - Green GO means you're good to ship
> - Yellow WARN means there are some issues to look at
> - Red NO-GO means fix these before deploying

**[SCREEN: Show example issues found]**

> It'll show you exactly what it found — maybe some console.logs, a TODO you forgot, or mock data that shouldn't be in production.

---

## STEP 5: SET UP AUTOMATIC CHECKING (3:45 - 4:30)

**[SCREEN: Chat panel]**

> Here's the magic. You can have guardrail check your code BEFORE your AI even writes it.

> Type: "Set guardrail checkpoint strictness to standard"

**[SCREEN: Show confirmation]**

> Now, whenever your AI tries to write code with issues, it gets blocked. Watch this:

**[SCREEN: Show AI trying to write code with console.log, getting blocked]**

> See? It caught the console.log and said "fix this first." Your AI can't leave junk behind anymore.

**[SCREEN: Show strictness levels]**

> You can adjust how strict it is:
> - "Chill" just catches the obvious stuff — TODOs, mock data
> - "Standard" adds console.logs and debugger statements  
> - "Strict" catches bad TypeScript practices too
> - "Paranoid" is for when you really want clean code

---

## STEP 6: STAY FOCUSED (4:30 - 5:00)

**[SCREEN: Chat panel]**

> One more thing. If you find your AI going off-track — you asked for a login form but it's also adding password reset, email verification, and refactoring your database...

> Use Intent Lock.

> Type: "Use guardrail intent start with prompt 'Add login form with email validation' and lock it"

**[SCREEN: Show locked intent]**

> Now if anyone asks the AI to do something else, it'll say "Nope, finish what you started first."

**[SCREEN: Show scope creep being blocked]**

> This keeps your AI focused and your PRs clean.

---

## OUTRO (5:00 - 5:15)

**[SCREEN: Show guardrail logo and docs link]**

> That's it! You're set up. Keep the Quick Reference Card open while you code — there's a link in the description.

> And remember: every time you're about to deploy, just ask "Run guardrail ship check" and you'll know if it's really ready.

> Happy shipping!

---

## B-ROLL SUGGESTIONS

- Terminal with npm install
- Editor settings panels
- AI chat showing tool usage
- Code with highlighted issues (console.log, TODO, mock data)
- Green/yellow/red status indicators
- Before/after comparison of clean vs messy code

---

## ON-SCREEN TEXT OVERLAYS

**0:15** - "AI-generated code can have hidden issues"  
**0:30** - "guardrail catches them before you ship"  
**1:00** - "Step 1: Install"  
**1:30** - "Step 2: Configure your editor"  
**2:30** - "Step 3: Test the connection"  
**3:00** - "Step 4: Run your first check"  
**3:45** - "Step 5: Enable automatic checking"  
**4:30** - "Step 6: Keep your AI focused"  
**5:00** - "Links in description"

---

## CALL TO ACTION

- Link to Quick Reference Card
- Link to Getting Started guide
- Discord invite
- GitHub repo

---

## THUMBNAIL IDEAS

1. "STOP Shipping Broken AI Code" with broken robot
2. "5 Min Setup" with timer graphic
3. "Your AI Assistant Needs a Babysitter" with humorous illustration
4. Before/After split screen showing messy vs clean code
