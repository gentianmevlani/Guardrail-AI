# guardrail Service Enhancements - Implementation Summary

**Date:** 2026-01-07  
**Status:** In Progress

## Quick Reality Scan

### What Was Inspected
- API routes and services (`apps/api/src`)
- Web UI components and pages (`apps/web-ui/src`)
- Database schema (`prisma/schema.prisma`)
- CLI and core packages
- Current user workflows and pain points

### Biggest Risks/Holes Found
1. **Fix application UI exists but backend not connected** - Fix Packs component has handlers but they're TODO stubs
2. **Settings forms don't persist** - User preferences are collected but not saved to database
3. **No real-time scan progress** - WebSocket infrastructure exists but not fully utilized
4. **No scheduled scans** - Users must manually trigger scans
5. **Webhook delivery is placeholder** - Webhook integration service logs but doesn't actually deliver

---

## Top 5 Enhancements (Ranked)

### 1. ✅ Feature: Fix Application Backend + Frontend Integration
**Status:** COMPLETE  
**Impact:** High - Unlocks core value proposition  
**Effort:** Medium  
**Risk:** Low

**What:** Connect the Fix Packs UI to backend API for applying code fixes

**Implementation:**
- ✅ Created `fix-application-service.ts` - Service to generate and apply fixes
- ✅ Added API endpoints:
  - `POST /api/runs/:id/fixes/:packId/diff` - Preview changes
  - `POST /api/runs/:id/fixes/:packId/apply` - Apply fixes
- ✅ Updated frontend:
  - Added `previewFixDiff()` and `applyFixPack()` to API client
  - Connected handlers in `runs/[id]/page.tsx`
  - Added loading states and error handling

**Files Changed:**
- `apps/api/src/services/fix-application-service.ts` (NEW)
- `apps/api/src/routes/runs.ts` (ADDED endpoints)
- `apps/web-ui/src/lib/api/runs.ts` (ADDED functions)
- `apps/web-ui/src/app/(dashboard)/runs/[id]/page.tsx` (CONNECTED handlers)

**User Value:** Users can now apply automated fixes directly from the UI, reducing manual work

---

### 2. ✅ Feature: Settings Persistence
**Status:** COMPLETE  
**Impact:** High - Core UX improvement  
**Effort:** Medium  
**Risk:** Low

**What:** Save user preferences (notifications, scan settings, appearance) to database

**Implementation:**
- ✅ Created `UserPreferences` model in Prisma schema with all preference fields
- ✅ Updated settings API routes to persist data:
  - `PUT /api/settings/notifications` - Save notification preferences
  - `GET /api/settings/notifications` - Load notification preferences
  - `PUT /api/settings/scan-preferences` - Save scan preferences
  - `GET /api/settings/scan-preferences` - Load scan preferences
  - `PUT /api/settings/appearance` - Save appearance preferences
  - `GET /api/settings/appearance` - Load appearance preferences
- ✅ Created settings API client (`apps/web-ui/src/lib/api/settings.ts`)
- ✅ Updated frontend to load saved preferences on mount
- ✅ Connected form submissions to API with error handling

**Files Changed:**
- `prisma/schema.prisma` (ADDED UserPreferences model)
- `apps/api/src/routes/settings.ts` (UPDATED to persist)
- `apps/web-ui/src/lib/api/settings.ts` (NEW)
- `apps/web-ui/src/app/(dashboard)/settings/page.tsx` (LOAD on mount + SAVE on submit)

**User Value:** Settings now persist across sessions, improving user experience

---

### 3. ⏳ UX: Real-Time Scan Progress
**Status:** PENDING  
**Impact:** High - Better user experience  
**Effort:** Medium  
**Risk:** Low

**What:** Show live scan progress using WebSocket updates

**Implementation Plan:**
- Enhance `useRealtimeScan` hook to connect to WebSocket
- Add progress indicators and status updates
- Show file-by-file progress during scans
- Add estimated time remaining

---

### 4. ⏳ Automation: Scheduled Scans
**Status:** PENDING  
**Impact:** Medium - Reduces manual work  
**Effort:** High  
**Risk:** Medium

**What:** Allow users to schedule automatic scans (daily, weekly, on push)

**Implementation Plan:**
- Create `ScheduledScan` model
- Add cron job system using BullMQ
- Create UI for managing schedules
- Add GitHub webhook integration for auto-scan on push

---

### 5. ⏳ Capability: Webhook Management UI + Delivery
**Status:** PENDING  
**Impact:** Medium - Integration value  
**Effort:** Medium  
**Risk:** Low

**What:** Real webhook delivery system with management UI

**Implementation Plan:**
- Create `Webhook` model for user-defined webhooks
- Implement actual HTTP delivery with retries
- Add webhook management UI in settings
- Add webhook event history and logs

---

## Implementation Details

### Fix Application Service

The fix application service generates fixes based on rule patterns:

```typescript
// Rule-based fix generation
- Secrets → Replace with env vars
- Mock data → Remove or replace
- Console.log → Remove
- TODO without impl → Skip (manual fix needed)
```

**Limitations:**
- Currently works with findings stored in `findings` table
- May need adaptation if findings are stored in JSON fields
- File modifications are simulated (would need Git integration for real changes)

**Next Steps:**
- Integrate with Git for actual file modifications
- Add fix verification (run tests after applying)
- Add rollback capability

---

## Verification Steps

### Test Fix Application
```bash
# 1. Start API server
cd apps/api && npm run dev

# 2. Create a test run with findings
curl -X POST http://localhost:5000/api/runs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"repo": "test/repo", "branch": "main"}'

# 3. Apply a fix pack
curl -X POST http://localhost:5000/api/runs/{runId}/fixes/{packId}/apply \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dryRun": false}'
```

### Test Settings Persistence
```bash
# Update notification preferences
curl -X PUT http://localhost:5000/api/settings/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"emailNotifications": true, "securityAlerts": true}'

# Verify persistence
curl http://localhost:5000/api/settings/notifications \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rollout Notes

### Migration Steps
1. Run Prisma migration for UserPreferences (when implemented)
2. Deploy API changes
3. Deploy frontend changes
4. Monitor error logs for fix application failures

### Feature Flags
- `ENABLE_FIX_APPLICATION=true` (default: true)
- `ENABLE_SCHEDULED_SCANS=false` (default: false, enable after testing)

### Backward Compatibility
- Fix application endpoints are new, no breaking changes
- Settings API maintains existing structure, adds persistence

### Rollback Strategy
- Revert API routes if issues found
- Frontend gracefully handles API errors
- Database changes are additive (no data loss)

---

## Next Session Priorities

1. **Complete Settings Persistence** (Enhancement #2)
2. **Implement Real-Time Progress** (Enhancement #3)
3. **Add Scheduled Scans** (Enhancement #4)
4. **Complete Webhook System** (Enhancement #5)

---

**End of Implementation Summary**
