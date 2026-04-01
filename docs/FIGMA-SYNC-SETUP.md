# Figma Sync Setup for Paradox Wallet

## Quick Setup (5 minutes)

### Step 1: Add npm scripts to package.json

```json
{
  "scripts": {
    "sync:figma": "ts-node scripts/sync-figma-tokens.ts",
    "sync:figma:dry": "ts-node scripts/sync-figma-tokens.ts --dry-run"
  }
}
```

### Step 2: Install dependencies (if not already installed)

```bash
npm install -D ts-node typescript @types/node
```

### Step 3: Set up Figma

1. Open your Figma file
2. Install **Tokens Studio for Figma** plugin (search in Figma plugins)
3. Create tokens matching this structure:

```
📁 global/
├── 📁 colors/
│   ├── white
│   ├── black
│   ├── bg-primary
│   ├── bg-secondary
│   ├── bg-tertiary
│   ├── bg-overlay
│   ├── bg-glass-subtle
│   ├── bg-glass-medium
│   ├── bg-glass-strong
│   ├── text-primary
│   ├── text-secondary
│   ├── text-tertiary
│   ├── text-muted
│   ├── border-subtle
│   ├── border-normal
│   ├── border-strong
│   └── border-focus
│
├── 📁 typography/
│   ├── 📁 fontFamilies/
│   │   ├── primary ('Rajdhani', sans-serif)
│   │   ├── mono (monospace)
│   │   └── system (system fonts)
│   │
│   ├── 📁 fontSizes/
│   │   ├── hero (clamp(48px, 10vw, 120px))
│   │   ├── title (clamp(32px, 5vw, 48px))
│   │   ├── heading (clamp(24px, 4vw, 42px))
│   │   ├── subheading (clamp(20px, 2vw, 28px))
│   │   ├── body (clamp(14px, 2vw, 18px))
│   │   ├── small (clamp(12px, 2vw, 14px))
│   │   └── xs (12px)
│   │
│   ├── 📁 fontWeights/
│   │   ├── black (900)
│   │   ├── extrabold (800)
│   │   ├── bold (700)
│   │   ├── semibold (600)
│   │   ├── medium (500)
│   │   └── normal (400)
│   │
│   └── 📁 letterSpacing/
│       ├── tighter (-0.02em)
│       ├── tight (-0.01em)
│       ├── normal (0em)
│       ├── wide (0.05em)
│       ├── wider (0.1em)
│       └── widest (0.2em)
│
├── 📁 spacing/
│   ├── 1 (4px)
│   ├── 2 (8px)
│   ├── 3 (12px)
│   ├── 4 (16px)
│   ├── 6 (24px)
│   ├── 8 (32px)
│   ├── 12 (48px)
│   └── 16 (64px)
│
├── 📁 borderRadius/
│   ├── sm (8px)
│   ├── md (12px)
│   ├── lg (16px)
│   ├── xl (24px)
│   ├── 2xl (32px)
│   ├── 3xl (40px)
│   └── full (9999px)
│
└── 📁 effects/
    ├── 📁 blur/
    │   ├── sm (10px)
    │   ├── md (20px)
    │   └── lg (40px)
    │
    └── 📁 shadows/
        ├── sm
        ├── md
        └── lg

📁 degen/
└── 📁 colors/
    ├── degen-primary (#ff3366)
    ├── degen-secondary (#ff9500)
    ├── degen-tertiary (#ff6b6b)
    ├── degen-dark (#cc0000)
    ├── degen-darker (#990000)
    └── degen-darkest (#660000)

📁 regen/
└── 📁 colors/
    ├── regen-primary (#00d4ff)
    ├── regen-secondary (#00ff88)
    ├── regen-tertiary (#00aaff)
    ├── regen-dark (#0066cc)
    ├── regen-darker (#004099)
    └── regen-darkest (#003366)
```

### Step 4: Export from Figma

1. Open Tokens Studio plugin
2. Click **Export** button
3. Select **JSON** format
4. Save as `figma-tokens.json` in your project root

### Step 5: Run sync

```bash
# Dry run first (see what will change without writing files)
npm run sync:figma:dry

# Then actually sync
npm run sync:figma
```

---

## Workflow

### When you update Figma:

```bash
# 1. Export tokens from Figma (overwrite figma-tokens.json)
# 2. Run sync
npm run sync:figma

# 3. Review changes
git diff src/design-system/

# 4. Test your app
npm run dev

# 5. Commit
git add .
git commit -m "chore: sync design tokens from Figma"
```

### Files that get updated:

| File | What changes |
|------|--------------|
| `src/design-system/tokens.ts` | All TypeScript tokens |
| `src/design-system/globals.css` | All CSS variables & utilities |

### Files that DON'T change (manual only):

| File | Why |
|------|-----|
| `tailwind.config.ts` | Rarely changes, review manually |
| `GlassCard.tsx` | Component logic, not just values |

---

## Troubleshooting

### "figma-tokens.json not found"
Make sure you exported from Tokens Studio and saved to project root.

### Tokens not parsing correctly
Check the `figma-tokens.example.json` file for the expected format.
Tokens Studio exports in a specific nested structure.

### Values not updating
1. Check the dry run output: `npm run sync:figma:dry`
2. Verify your Figma token names match the expected keys
3. Check backups in `./backups/design-system/` if you need to restore

### "ts-node not found"
```bash
npm install -D ts-node typescript @types/node
```

---

## Advanced: GitHub Actions Auto-Sync

You can automate syncing when tokens change:

```yaml
# .github/workflows/sync-figma.yml
name: Sync Figma Tokens

on:
  push:
    paths:
      - 'figma-tokens.json'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run sync:figma
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: auto-sync design tokens from Figma'
```

---

## Token Naming Convention

For the sync script to work correctly, use these exact names in Figma:

### Colors
- `white`, `black`
- `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-overlay`
- `bg-glass-subtle`, `bg-glass-medium`, `bg-glass-strong`
- `text-primary`, `text-secondary`, `text-tertiary`, `text-muted`
- `border-subtle`, `border-normal`, `border-strong`, `border-focus`
- `degen-primary`, `degen-secondary`, `degen-tertiary`
- `regen-primary`, `regen-secondary`, `regen-tertiary`

### Typography
- fontFamilies: `primary`, `mono`, `system`
- fontSizes: `hero`, `title`, `heading`, `subheading`, `body`, `small`, `xs`
- fontWeights: `black`, `extrabold`, `bold`, `semibold`, `medium`, `normal`
- letterSpacing: `tighter`, `tight`, `normal`, `wide`, `wider`, `widest`

### Spacing
- `1` through `24` (representing 4px increments)

### Border Radius  
- `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`

### Effects
- blur: `sm`, `md`, `lg`
- shadows: `sm`, `md`, `lg`

---

## Need Help?

1. Check `figma-tokens.example.json` for correct format
2. Run dry-run to debug: `npm run sync:figma:dry`
3. Check backups if something broke: `./backups/design-system/`
