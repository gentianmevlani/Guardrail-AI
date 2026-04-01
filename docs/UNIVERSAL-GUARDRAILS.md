# Universal Guardrails System

## 🎯 Works Across All Platforms

Our guardrails work universally across:
- ✅ **VS Code** (with GitHub Copilot)
- ✅ **Cursor**
- ✅ **Windsurf**
- ✅ **Claude Desktop**
- ✅ **Any MCP-compatible editor**

## 🛡️ Universal Rules

### File Organization
- ✅ **No root files** - Prevents clutter in root directory
- ✅ **Feature-based organization** - Enforces proper structure
- ✅ **Component placement** - Ensures components are in correct locations

### Code Quality
- ✅ **No mock data** - Prevents fake endpoints
- ✅ **No hardcoded secrets** - Security protection
- ✅ **No console.log** - Encourages proper logging
- ✅ **No "any" types** - TypeScript best practices
- ✅ **No deep relative imports** - Encourages path aliases

### API Safety
- ✅ **Endpoint validation** - Ensures registered endpoints
- ✅ **Request validation** - Zod schema validation
- ✅ **Error handling** - Standardized errors

## 🚀 Usage

### Check Guardrails
```bash
npm run validate
```

### Platform Detection
The system automatically detects your platform:
- Cursor → Uses `.cursorrules`
- Windsurf → Uses Windsurf config
- VS Code → Uses `.vscode/settings.json`
- Claude → Uses MCP config

### Custom Rules
Add your own rules:
```typescript
import { universalGuardrails } from './src/lib/universal-guardrails';

universalGuardrails.addRule({
  id: 'custom-rule',
  name: 'Custom Rule',
  description: 'Your custom rule',
  severity: 'error',
  platforms: ['all'],
  check: async (filePath, content) => {
    // Your validation logic
    return true;
  },
});
```

## 📋 Rule Severity

- **error** - Blocks operation
- **warning** - Shows warning but continues
- **info** - Informational only

## 🔧 Platform-Specific

### Cursor
- Uses `.cursorrules` file
- Leverages Cursor AI features
- Custom rules support

### Windsurf
- Uses Windsurf configuration
- Supports Windsurf AI features
- MCP integration

### VS Code
- Uses `.vscode/settings.json`
- Works with extensions
- GitHub Copilot compatible

### Claude Desktop
- Uses MCP configuration
- Claude-specific features
- Full MCP support

## 🎯 Benefits

### Consistency
- Same rules across all platforms
- No platform-specific quirks
- Universal best practices

### Safety
- Prevents common mistakes
- Security protection
- Code quality enforcement

### Developer Experience
- Clear error messages
- Automatic fixes (where possible)
- Platform detection

---

**All platforms, one set of rules!** 🛡️

