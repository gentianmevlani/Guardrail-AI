# guardrail Demo: Mock Data in Production (and how to stop it)

This repo demonstrates a common failure: **mock data and fake API responses shipping to production** because they are valid code that passes CI.

## Problem

Mock data in production happens when:

- test fixtures or stubs are included in a production build
- missing env vars trigger fallback clients that return fabricated responses
- tests validate shapes instead of real integrations

The result is often **plausible but wrong** data, which is worse than an obvious crash.

## The Failure Pattern

- Code compiles ✅
- Tests pass ✅
- Production serves fake data ❌

## Example Code

`src/app.ts` uses a fallback that returns fake data if config is missing.

## How to prevent it

Add a deploy gate that checks for:

- mock/stub imports in production graph
- build artifacts containing `__mocks__`, `fixtures`, `fake`, `seed`
- required env vars missing (which triggers fake fallbacks)
- placeholder handlers in production routes

## Run (demo)

```bash
npm install
npm run start
```

## guardrail (example usage)

```bash
npx guardrail mockproof
npx guardrail gate
```

## Why this matters for AI-assisted coding

AI-generated code often hallucinates plausible behavior. It compiles, type-checks, and ships unless you add a reality gate.
