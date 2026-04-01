# Interactive Project Setup Wizard

## 🎯 Overview

The Interactive Project Setup Wizard makes it **dead simple** to start a new project. Just answer a few questions, and we'll build everything for you!

## 🚀 Quick Start

```bash
# Run the wizard
npx ai-agent-guardrails wizard

# Or if installed globally
guardrails wizard
```

## 📋 How It Works

### Step 1: Welcome Screen
The wizard greets you and explains what it will do.

### Step 2: Project Information
- Project name
- Description
- Author name

### Step 3: Select Project Type
Choose what you're building:
- 🌐 **Full-Stack Web Application**
- 🎨 **Frontend-Only Application**
- ⚙️ **Backend API Only**
- 📄 **Landing Page**
- 📊 **Admin Dashboard**
- 🚪 **API Gateway**

### Step 4: Answer Questions
Based on your project type, answer a few questions:
- Framework (Next.js, React, Vue)
- Database (PostgreSQL, MongoDB, MySQL)
- ORM (Prisma, Drizzle, Mongoose)
- Authentication (JWT, OAuth)
- Styling (Tailwind, CSS Modules)

### Step 5: Automatic Setup
The wizard automatically:
- ✅ Creates project structure
- ✅ Generates configuration files
- ✅ Sets up templates
- ✅ Installs dependencies
- ✅ Configures guardrails

## 🎨 Project Types

### Full-Stack Web Application
**Perfect for:** Complete web apps with frontend, backend, and database

**Includes:**
- Frontend framework setup
- Backend API structure
- Database configuration
- Authentication system
- UI components
- State management
- Testing setup

**Questions:**
- Frontend framework?
- Database?
- ORM?
- Authentication?
- Styling?

### Frontend-Only Application
**Perfect for:** Frontend apps that connect to external APIs

**Includes:**
- Frontend framework
- UI components
- Design system
- State management
- API client setup

**Questions:**
- Framework?
- Styling?
- API URL?

### Backend API Only
**Perfect for:** REST/GraphQL APIs

**Includes:**
- API architecture
- Database setup
- Authentication
- Testing
- Environment config

**Questions:**
- API style?
- Database?
- ORM?
- Authentication?

### Landing Page
**Perfect for:** Marketing pages, portfolios

**Includes:**
- Framework setup
- Design system
- UI components

**Questions:**
- Framework?
- Styling?

### Admin Dashboard
**Perfect for:** Admin panels, data dashboards

**Includes:**
- Framework setup
- UI components
- State management
- Authentication
- Design system

**Questions:**
- Framework?
- Styling?
- Authentication?

### API Gateway
**Perfect for:** Microservices gateways

**Includes:**
- API structure
- Authentication
- Environment config

**Questions:**
- API style?
- Authentication?

## 📁 What Gets Generated

### Project Structure
```
your-project/
├── src/
│   ├── app/              # Next.js routes (if applicable)
│   ├── components/      # UI components
│   ├── features/         # Feature modules
│   ├── lib/              # Utilities
│   ├── server/           # Backend code (if applicable)
│   └── types/            # TypeScript types
├── prisma/               # Database schema (if applicable)
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── eslint.config.js      # ESLint config
├── .cursorrules          # AI agent rules
└── README.md             # Project docs
```

### Configuration Files
- `package.json` - With all dependencies
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - Linting rules
- `.prettierrc` - Code formatting
- `.env.example` - Environment variables
- `.cursorrules` - AI guardrails

### Template Files
Based on your selections, templates are automatically applied:
- Architecture templates
- API templates
- UI/UX templates
- Design system templates
- Authentication templates
- Database templates

## 💡 Example Flow

```bash
$ npx ai-agent-guardrails wizard

╔══════════════════════════════════════════════════════════════╗
║     🛡️  AI Agent Guardrails - Project Setup Wizard          ║
╚══════════════════════════════════════════════════════════════╝

📋 Let's start with some basic information:

Project name? [my-awesome-project]: my-blog
Project description? []: A modern blog platform
Author name? []: John Doe

🎯 What are you building?

  1. Full-Stack Web Application - Complete web app
  2. Frontend-Only Application - Frontend app
  3. Backend API Only - REST/GraphQL API
  4. Landing Page - Marketing page
  5. Admin Dashboard - Admin panel
  6. API Gateway - Microservices gateway

Select option (1-6): 1

📝 Answer a few questions about your Full-Stack Web Application:

Frontend framework? (nextjs/react/vue) [nextjs]: 
Database? (postgresql/mongodb/mysql) [postgresql]: 
ORM? (prisma/drizzle/none) [prisma]: 
Authentication? (jwt/oauth/both) [jwt]: 
Styling? (tailwind/css-modules/styled-components) [tailwind]: 

📋 Summary:
   Project: my-blog
   Type: Full-Stack Web Application
   Location: ./my-blog

Create project? (yes/no) [yes]: 

📁 Creating project structure...
   ✅ src/
   ✅ src/components/
   ✅ src/app/
   ✅ src/server/
   ✅ prisma/

📝 Generating configuration files...
   ✅ package.json
   ✅ tsconfig.json
   ✅ .env.example
   ✅ README.md

📄 Generating template files...
   📋 Applying template 03...
   📋 Applying template 04...
   🛡️  Setting up AI Agent Guardrails...
      ✅ eslint.config.js
      ✅ .prettierrc
      ✅ .cursorrules

📦 Installing dependencies...

✅ Project Created!

Next steps:
  1. cd my-blog
  2. npm run dev
```

## 🎯 Benefits

### For Users
- **Zero Configuration** - Everything set up automatically
- **Best Practices** - Follows industry standards
- **Guardrails Included** - AI agents stay on track
- **Ready to Code** - Start building immediately

### For You
- **Faster Onboarding** - Users get started instantly
- **Consistent Projects** - All projects follow same structure
- **Less Support** - Fewer setup questions
- **Better Experience** - Users love simplicity

## 🔧 Customization

After generation, users can:
- Customize configuration files
- Add/remove features
- Modify templates
- Extend functionality

## 📚 Next Steps

After running the wizard:
1. `cd your-project`
2. `npm install` (if not done automatically)
3. `npm run dev`
4. Start building!

## 🎉 That's It!

The wizard makes it **dead simple** to start a project. Just answer questions, and we handle the rest!

---

**Ready to try it?** Run `npx ai-agent-guardrails wizard` now! 🚀

