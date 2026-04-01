# Project Healer - Fix Broken Projects

## 🎯 The Problem

You've started a project, but:
- ❌ Files are in wrong locations
- ❌ Missing dependencies
- ❌ Broken imports
- ❌ Inconsistent designs
- ❌ No animations
- ❌ Structure issues

**Project Healer fixes all of this!**

## 🚀 Quick Start

```bash
# Analyze your project
npm run heal

# Or specify a path
npm run heal ./my-project
```

## 🔍 What It Does

### 1. Analyzes Your Project
- Checks file locations
- Finds missing dependencies
- Detects broken imports
- Identifies design inconsistencies
- Finds missing animations
- Checks project structure

### 2. Shows Issues
- Groups by severity (critical, high, medium, low)
- Shows what's wrong
- Suggests fixes
- Estimates fix time

### 3. Auto-Fixes
- Automatically fixes what it can
- Moves files to correct locations
- Installs missing dependencies
- Creates missing directories
- Adds missing animations

## 📋 Example Output

```
╔══════════════════════════════════════════════════════════════╗
║              🔧 Project Healer - Fix Broken Projects         ║
╚══════════════════════════════════════════════════════════════╝

Analyzing project: ./my-project

🔍 Analyzing project...

📊 Project Health Score: 65/100

⚠️  Found 5 issue(s):

🚨 CRITICAL ISSUES:
   1. File "UserProfile.tsx" is in root directory. Should be in /src/ subdirectory.
      Fix: Move UserProfile.tsx to appropriate /src/ subdirectory
      File: UserProfile.tsx

⚠️  HIGH PRIORITY:
   1. Missing dependency: gsap
      Fix: Install gsap: npm install gsap
   2. Missing required directory: src/components
      Fix: Create directory: src/components

📋 MEDIUM PRIORITY:
   1. Found 12 components without animations. Consider adding GSAP or Framer Motion.
      Fix: Install GSAP: npm install gsap, or add animation hooks

⏱️  Estimated fix time: 8 minutes

🔧 3 issue(s) can be fixed automatically.

Auto-fix these issues? (yes/no): yes

🔧 Applying fixes...

✅ Fixed: 3
   ✅ Missing dependency: gsap
   ✅ Missing required directory: src/components
   ✅ Found 12 components without animations
```

## 🎯 What Gets Fixed

### Auto-Fixable:
- ✅ Missing dependencies
- ✅ Missing directories
- ✅ Missing animation setup
- ✅ Basic structure issues

### Manual Fixes Needed:
- ⚠️ File locations (needs destination)
- ⚠️ Broken imports (needs context)
- ⚠️ Design inconsistencies (needs review)

## 💡 Use Cases

### 1. Fix Existing Project
```bash
cd my-broken-project
npm run heal
# Follow prompts to fix issues
```

### 2. Check Before Committing
```bash
npm run heal
# Fix issues before committing
```

### 3. Onboarding New Team Member
```bash
npm run heal
# Ensures project is set up correctly
```

## 🔧 Integration with Templates

After healing, you can:
1. Add enhanced components template
2. Add GSAP animations
3. Add animated buttons
4. Add transition effects

All the polish that AI agents miss!

## 🎉 Benefits

- ✅ **Fixes broken projects** - Gets you back on track
- ✅ **Saves time** - Auto-fixes what it can
- ✅ **Prevents issues** - Catches problems early
- ✅ **Improves quality** - Ensures best practices
- ✅ **Easy to use** - Just run one command

## 📚 Next Steps

After healing:
1. Review remaining manual fixes
2. Add enhanced components template
3. Add animations
4. Lock design system
5. Validate project

---

**Ready to fix your project?** Run `npm run heal` now! 🔧

