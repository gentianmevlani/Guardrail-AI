# Subscription Tiers & Pricing

## 🎯 Tiered Subscription Based on Codebase Size

Our subscription system scales with your codebase size, ensuring you only pay for what you need.

## 📊 Tiers

### 🆓 Free Tier
**Perfect for:** Small projects, learning, personal projects

**Limits:**
- 500 files max
- 10,000 lines of code max
- 5MB codebase size max
- 1 project
- 1 team member

**Features:**
- ✅ Basic guardrails
- ✅ Error boundary
- ✅ 404 page
- ✅ Basic templates

**Price:** Free forever

---

### 🚀 Starter Tier
**Perfect for:** Small teams, startups, side projects

**Limits:**
- 2,000 files max
- 50,000 lines of code max
- 25MB codebase size max
- 3 projects
- 3 team members

**Features:**
- ✅ All free features
- ✅ Breadcrumbs
- ✅ Loading states
- ✅ Empty states
- ✅ Backend middleware
- ✅ Email support

**Price:** $19/month or $190/year (save 17%)

---

### 💼 Pro Tier
**Perfect for:** Growing companies, multiple projects

**Limits:**
- 10,000 files max
- 250,000 lines of code max
- 100MB codebase size max
- 10 projects
- 10 team members

**Features:**
- ✅ All starter features
- ✅ Advanced guardrails
- ✅ Custom rules
- ✅ Priority support
- ✅ Analytics dashboard
- ✅ API access

**Price:** $49/month or $490/year (save 17%)

---

### 🏢 Enterprise Tier
**Perfect for:** Large organizations, enterprise apps

**Limits:**
- 50,000 files max
- 1,000,000 lines of code max
- 500MB codebase size max
- 50 projects
- 50 team members

**Features:**
- ✅ All pro features
- ✅ Unlimited custom rules
- ✅ Dedicated support
- ✅ SLA guarantee
- ✅ Custom integrations
- ✅ On-premise option

**Price:** $199/month or $1,990/year (save 17%)

---

### ♾️ Unlimited Tier
**Perfect for:** Enterprise with unlimited needs

**Limits:**
- Unlimited files
- Unlimited lines
- Unlimited size
- Unlimited projects
- Unlimited team members

**Features:**
- ✅ Everything
- ✅ Custom pricing
- ✅ White-label option
- ✅ Dedicated account manager

**Price:** Custom pricing (contact sales)

---

## 📏 How Codebase Size is Calculated

We measure:
- **Total files** - All code files in your project
- **Total lines** - Lines of code across all files
- **Total size** - Combined file size in bytes

**Excluded:**
- `node_modules`
- `.git`
- `dist`/`build` folders
- Test files (optional)
- Documentation files (optional)

## 🔄 Usage Tracking

### Check Your Usage
```bash
npm run check-subscription [tier]
```

### Enforce Limits
```bash
npm run enforce-subscription [tier]
```

### Track Project
```bash
npm run track-usage [project-path] [tier]
```

## 🚨 What Happens When You Exceed Limits?

1. **Warning** - You'll receive a notification
2. **Recommendation** - We'll suggest the appropriate tier
3. **Grace Period** - 7 days to upgrade
4. **Enforcement** - Features limited until upgrade

## 💡 Upgrade Path

### Automatic Recommendations
The system automatically detects when you need to upgrade:

```bash
npm run check-subscription
```

**Output:**
```
❌ Usage exceeds limits:
   ⚠️  Files: 2,500 > 2,000
   ⚠️  Lines: 55,000 > 50,000

💡 Your codebase exceeds starter tier limits. 
   Upgrade to pro ($49/month) to continue.

📈 Recommended Tier: PRO
   Price: $49/month ($490/year)
```

## 🎯 Choosing the Right Tier

### Free
- Learning projects
- Small personal apps
- Prototypes

### Starter
- Small startups
- Side projects
- 1-3 developers

### Pro
- Growing companies
- Multiple projects
- 5-10 developers

### Enterprise
- Large organizations
- Many projects
- 10+ developers

### Unlimited
- Enterprise scale
- Custom needs
- White-label

## 🔐 Security & Privacy

- Usage data is stored locally
- No code is sent to servers
- All calculations are done client-side
- Optional telemetry (can be disabled)

## 📞 Support

- **Free/Starter:** Community support
- **Pro:** Priority email support
- **Enterprise:** Dedicated support channel
- **Unlimited:** Dedicated account manager

---

**Ready to check your usage?** Run `npm run check-subscription` now! 🚀

