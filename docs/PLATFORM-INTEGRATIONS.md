# Platform Integrations Guide

## 🔌 Supported Platforms

guardrail AI integrates seamlessly with all major deployment platforms:

- ✅ **Netlify** - Full plugin support
- ✅ **Supabase** - Edge functions + config
- ✅ **Vercel** - Build plugins + config
- ✅ **Railway** - Deployment config
- ✅ **Render** - Service config
- ✅ **Fly.io** - App config
- ✅ **Cloudflare Pages** - Workers + Pages

## 🚀 Quick Install

### Netlify
```bash
npm run install-platform netlify
```

### Supabase
```bash
npm run install-platform supabase
```

### Vercel
```bash
npm run install-platform vercel
```

### All Others
```bash
npm run install-platform [platform-name]
```

## 📋 What Gets Installed

### Netlify
- `netlify.toml` - Build configuration
- `.netlify/plugins/guardrails` - Guardrails plugin
- Pre-build validation
- Post-build polish checks

### Supabase
- `supabase/config.toml` - Supabase config
- `supabase/functions/guardrails` - Edge function
- Health check endpoint
- Validation API

### Vercel
- `vercel.json` - Vercel configuration
- `.vercel/plugins/guardrails` - Build plugin
- Security headers
- Function runtime config

### Railway
- `railway.json` - Railway configuration
- Build and deploy settings

### Render
- `render.yaml` - Render service config
- Environment variables

### Fly.io
- `fly.toml` - Fly.io app configuration
- Service settings

### Cloudflare
- `wrangler.toml` - Workers/Pages config
- `_redirects` - Pages redirects

## 🎯 Integration Features

### Automatic Validation
All platforms run guardrails validation:
- Before build (pre-build)
- After build (post-build)
- On deployment

### Health Checks
Platform-specific health endpoints:
- `/guardrails/health` - Health status
- `/guardrails/validate` - Validation API

### Environment Variables
Each platform gets:
- Required env vars documented
- Secure defaults
- Platform-specific configs

## 💡 Usage Examples

### Netlify
```bash
# Install
npm run install-platform netlify

# Deploy
npm run deploy
# or
netlify deploy --prod
```

### Supabase
```bash
# Install
npm run install-platform supabase

# Start locally
npm run supabase:start

# Deploy
npm run supabase:deploy
```

### Vercel
```bash
# Install
npm run install-platform vercel

# Deploy
npm run deploy:prod
# or
vercel --prod
```

## 🔧 Customization

Each platform config can be customized:
- Edit the generated config files
- Add platform-specific settings
- Extend with custom plugins

## 📊 Platform Comparison

| Platform | Plugin | Config | Health Check | Auto-Deploy |
|----------|--------|--------|--------------|-------------|
| Netlify | ✅ | ✅ | ✅ | ✅ |
| Supabase | ✅ | ✅ | ✅ | ✅ |
| Vercel | ✅ | ✅ | ✅ | ✅ |
| Railway | ❌ | ✅ | ✅ | ✅ |
| Render | ❌ | ✅ | ✅ | ✅ |
| Fly.io | ❌ | ✅ | ✅ | ✅ |
| Cloudflare | ❌ | ✅ | ✅ | ✅ |

## 🎯 Benefits

### For You
- ✅ One-command setup
- ✅ Automatic validation
- ✅ Platform-optimized
- ✅ Production-ready

### For Your Project
- ✅ Consistent deployments
- ✅ Quality checks
- ✅ Health monitoring
- ✅ Platform best practices

---

**Deploy with confidence on any platform!** 🚀

