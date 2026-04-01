---
name: Lint Cleanup Task
about: Track ESLint warning cleanup progress
title: "[Lint] Clean up warnings in [FILE]"
labels: "tech-debt, lint, good first issue"
assignees: ""
---

## File to Clean Up

`apps/web-ui/src/[PATH]`

## Current Warnings

<!-- List the specific warnings from `pnpm run lint` -->

- [ ] Warning 1: `description`
- [ ] Warning 2: `description`

## Warning Type

<!-- Check the type of warnings -->

- [ ] `react-hooks/exhaustive-deps` - Missing dependencies
- [ ] `react-hooks/rules-of-hooks` - Hook called incorrectly
- [ ] `@next/next/no-img-element` - Should use Next.js Image
- [ ] Other: \_\_\_

## Suggested Fix

<!-- Describe how to fix or link to relevant docs -->

## Priority

<!-- P0 = bug, P1 = performance, P2 = style -->

- [ ] P0 - Actual bug (rules-of-hooks)
- [ ] P1 - Performance issue (exhaustive-deps that matters)
- [ ] P2 - Style/optimization (can defer)

## Acceptance Criteria

- [ ] Warning count in file reduced to 0
- [ ] No new warnings introduced
- [ ] Tests still pass
- [ ] Build succeeds

## Resources

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [ESLint exhaustive-deps](https://github.com/facebook/react/issues/14920)
- [Next.js Image](https://nextjs.org/docs/pages/api-reference/components/image)
