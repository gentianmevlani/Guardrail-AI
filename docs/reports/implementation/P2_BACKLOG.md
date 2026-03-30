# P2 Backlog - Feature Implementation Tracking

This document tracks less urgent but important features for product completeness and security. These items should be tackled after P0 and P1 fixes are complete.

**Status Legend:**
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Completed
- ⚪ Blocked/Deferred

---

## 1. Multi-Factor Auth (MFA) Tracking

**Status:** 🔴 Not Started  
**Priority:** High (Security)  
**Estimated Effort:** 2-3 days

### Description
Implement tracking and enforcement of Multi-Factor Authentication (MFA) for user accounts. This includes updating the user schema, implementing MFA setup flows, and enforcing MFA on sensitive operations.

### Implementation Steps

1. **Database Schema Updates**
   - Add MFA fields to User model:
     - `mfaEnabled: boolean @default(false)`
     - `mfaSecret: string?` (encrypted)
     - `mfaBackupCodes: string[]?` (encrypted)
     - `mfaVerifiedAt: DateTime?`
   - Create migration: `prisma migrate dev --name add_mfa_fields`

2. **MFA Setup Flow**
   - Add endpoint: `POST /api/auth/mfa/setup` - Generate QR code and secret
   - Add endpoint: `POST /api/auth/mfa/verify` - Verify setup code
   - Add endpoint: `POST /api/auth/mfa/disable` - Disable MFA (requires password)
   - Generate backup codes during setup

3. **MFA Enforcement**
   - Update `authMiddleware` to check MFA status
   - Require MFA for:
     - Admin operations
     - Billing changes
     - API key creation/deletion
     - Security settings changes
   - Add MFA challenge endpoint: `POST /api/auth/mfa/challenge`

4. **Frontend Integration**
   - MFA setup page in settings
   - QR code display for TOTP apps
   - Backup codes display/download
   - MFA challenge modal for protected operations

### Dependencies
- TOTP library: `otpauth` or `speakeasy`
- QR code generation: `qrcode`
- Encryption for secrets: Use existing crypto utilities

### Testing Checklist
- [ ] Unit test: MFA setup generates valid TOTP secret
- [ ] Unit test: MFA verification accepts correct code
- [ ] Unit test: MFA verification rejects incorrect code
- [ ] Integration test: Protected endpoint requires MFA when enabled
- [ ] E2E test: Complete MFA setup flow
- [ ] E2E test: Login with MFA enabled
- [ ] Security test: Backup codes work after primary method lost

### Related Files
- `prisma/schema.prisma` - User model
- `apps/api/src/middleware/fastify-auth.ts` - Auth middleware
- `apps/api/src/routes/auth-v1.ts` - Auth routes
- `apps/web-ui/src/app/(dashboard)/settings/page.tsx` - Settings UI

### Notes
- Consider making MFA mandatory for admin accounts
- Store MFA secrets encrypted at rest
- Rate limit MFA verification attempts
- Log all MFA events to SecurityEvent table

---

## 2. User Issue Tracking / Support Tickets

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Estimated Effort:** 3-4 days

### Description
Implement an in-app support ticket system for users to report issues, request features, or get help. This can integrate with external tools (Zendesk, Intercom) or be self-contained.

### Implementation Options

**Option A: Self-Contained System**
- Create `SupportTicket` model in Prisma
- Build ticket creation/viewing UI
- Email notifications to support team
- Admin dashboard for ticket management

**Option B: External Integration**
- Integrate with Zendesk API
- Create tickets via API when user submits form
- Sync ticket status back to app
- Display ticket history in user dashboard

**Option C: Hybrid**
- Store tickets in database for history
- Forward to external system for management
- Sync status updates back

### Implementation Steps (Option A - Self-Contained)

1. **Database Schema**
   ```prisma
   model SupportTicket {
     id          String   @id @default(cuid())
     userId      String
     subject     String
     description String   @db.Text
     status      String   @default("open") // open, in_progress, resolved, closed
     priority    String   @default("medium") // low, medium, high, urgent
     category    String   // bug, feature_request, question, billing
     attachments String[] // File URLs
     user        User     @relation(fields: [userId], references: [id])
     messages    SupportMessage[]
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
     resolvedAt  DateTime?
   }
   ```

2. **API Endpoints**
   - `POST /api/support/tickets` - Create ticket
   - `GET /api/support/tickets` - List user's tickets
   - `GET /api/support/tickets/:id` - Get ticket details
   - `POST /api/support/tickets/:id/messages` - Add message
   - `GET /api/admin/support/tickets` - Admin: List all tickets
   - `PATCH /api/admin/support/tickets/:id` - Admin: Update status

3. **Frontend**
   - Support page: `apps/web-ui/src/app/(dashboard)/support/page.tsx`
   - Ticket creation form
   - Ticket list view
   - Ticket detail view with message thread
   - Admin ticket management dashboard

4. **Notifications**
   - Email to support team on new ticket
   - Email to user on status updates
   - In-app notifications

### Testing Checklist
- [ ] User can create support ticket
- [ ] User can view their tickets
- [ ] User can add messages to ticket
- [ ] Admin can view all tickets
- [ ] Admin can update ticket status
- [ ] Email notifications sent correctly
- [ ] File attachments work

### Related Files
- `prisma/schema.prisma` - SupportTicket model
- `apps/api/src/routes/support.ts` - Support routes (new)
- `apps/web-ui/src/app/(dashboard)/support/` - Support UI (new)

### Notes
- Consider rate limiting ticket creation
- Add search/filter for tickets
- Consider adding ticket templates for common issues
- Integrate with existing email service

---

## 3. Stripe Metered Billing

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Estimated Effort:** 2-3 days

### Description
Implement Stripe's metered billing for usage-based features (scans, API calls, etc.). This requires creating usage records in Stripe and handling metered subscription items.

### Implementation Steps

1. **Stripe Setup**
   - Create metered price IDs in Stripe dashboard
   - Configure usage-based products
   - Set up usage aggregation (daily/monthly)

2. **Usage Tracking**
   - Already have usage tracking in `apps/api/src/routes/usage.ts`
   - Enhance to create Stripe usage records
   - Track: scans, API calls, storage, etc.

3. **Stripe Integration**
   - Create usage record endpoint: `POST /api/billing/usage/record`
   - Automatically record usage when events occur
   - Handle usage reporting webhooks from Stripe

4. **Billing Service Updates**
   - Update `billing-service.ts` to handle metered billing
   - Create usage records via Stripe API
   - Handle usage-based invoice line items

### Code Changes

```typescript
// In billing-service.ts
async function recordUsage(
  subscriptionItemId: string,
  quantity: number,
  timestamp?: Date
): Promise<void> {
  await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    {
      quantity,
      timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
    }
  );
}
```

### Testing Checklist
- [ ] Usage records created in Stripe
- [ ] Usage appears on invoices
- [ ] Usage aggregation works correctly
- [ ] Webhook handles usage events
- [ ] Overage charges calculated correctly

### Related Files
- `apps/api/src/services/billing-service.ts` - Billing service
- `apps/api/src/routes/usage.ts` - Usage tracking
- `apps/api/src/routes/billing-webhooks.ts` - Stripe webhooks

### Notes
- Stripe requires usage records within 5 minutes of the event
- Consider batching usage records for efficiency
- Handle timezone issues for daily/monthly aggregation

---

## 4. Customer Notifications (Complete Email/SMS)

**Status:** 🟡 In Progress (Email service implemented, need to add remaining notifications)  
**Priority:** Medium  
**Estimated Effort:** 1-2 days

### Description
Complete all customer notification flows using the newly implemented SendGrid email service. Add remaining notification types beyond trial ending and payment failures.

### Remaining Notifications to Implement

1. **Welcome Email** ✅ (Already implemented in `email-service.ts`)
2. **Trial Ending** ✅ (Implemented in billing-webhooks.ts)
3. **Payment Failed** ✅ (Implemented in billing-webhooks.ts)
4. **Payment Action Required** ✅ (Implemented in billing-webhooks.ts)
5. **Subscription Activated** 🔴
6. **Subscription Cancelled** 🔴
7. **Subscription Renewed** 🔴
8. **Password Reset** 🔴
9. **Account Locked** 🔴
10. **Security Alert** 🔴 (e.g., new device login)
11. **Scan Complete** 🔴
12. **Critical Finding Alert** 🔴

### Implementation Steps

1. **Create Email Templates**
   - Subscription activated template
   - Subscription cancelled template
   - Password reset template
   - Security alert template
   - Scan complete template

2. **Update Billing Webhooks**
   - Add email to `handleSubscriptionCreated`
   - Add email to `handleSubscriptionCancelled`
   - Add email to `handleSubscriptionRenewed`

3. **Update Auth Routes**
   - Add email to password reset flow
   - Add email to account lockout

4. **Update Security Service**
   - Add email to security event service for critical events
   - New device login alerts

5. **Update Scan Service**
   - Add email notification when scan completes
   - Add email for critical findings

### Testing Checklist
- [ ] Each notification type sends correctly
- [ ] Email templates render properly
- [ ] Links in emails work correctly
- [ ] Unsubscribe handling (if implemented)
- [ ] Email delivery tracking

### Related Files
- `apps/api/src/services/email-notification-service.ts` - Email service
- `apps/api/src/routes/billing-webhooks.ts` - Billing webhooks
- `apps/api/src/routes/auth-v1.ts` - Auth routes
- `apps/api/src/services/security-event-service.ts` - Security events

### Notes
- Use email templates from `email-notification-service.ts`
- Test each notification via Stripe webhook testing
- Consider adding email preferences for users
- Add SMS notifications if Twilio is configured

---

## 5. Malware Scanning for Uploads

**Status:** 🔴 Not Started  
**Priority:** Medium (Security)  
**Estimated Effort:** 2-3 days

### Description
Integrate malware scanning into the file upload flow to ensure uploaded files are safe before storage. Options include ClamAV (self-hosted), VirusTotal API, or AWS GuardDuty.

### Implementation Options

**Option A: VirusTotal API**
- Pros: Easy integration, comprehensive scanning
- Cons: API rate limits, cost per scan
- Best for: Production with budget

**Option B: ClamAV (Self-hosted)**
- Pros: Free, no API limits
- Cons: Requires server setup, maintenance
- Best for: Self-hosted deployments

**Option C: AWS GuardDuty / S3 Object Scanning**
- Pros: Integrated with S3, automated
- Cons: AWS-specific, additional cost
- Best for: AWS deployments

### Implementation Steps (Option A - VirusTotal)

1. **Environment Variables**
   ```env
   VIRUSTOTAL_API_KEY=your_api_key
   ENABLE_MALWARE_SCANNING=true
   ```

2. **Update File Storage Service**
   - Enhance `scanForMalware()` in `file-storage-service.ts`
   - Add VirusTotal API integration
   - Handle scan results (clean/quarantine/reject)

3. **Scanning Logic**
   ```typescript
   async function scanWithVirusTotal(fileBuffer: Buffer): Promise<ScanResult> {
     const formData = new FormData();
     formData.append('file', fileBuffer, { filename: 'scan-file' });
     
     const response = await fetch('https://www.virustotal.com/vtapi/v2/file/scan', {
       method: 'POST',
       headers: {
         'x-apikey': process.env.VIRUSTOTAL_API_KEY,
       },
       body: formData,
     });
     
     // Poll for results or use webhook
     return await getScanResults(response.data.scan_id);
   }
   ```

4. **Quarantine System**
   - Store infected files in quarantine bucket/folder
   - Log security event for infected uploads
   - Notify admins of infected files

### Testing Checklist
- [ ] Clean file passes scan
- [ ] Infected file is quarantined
- [ ] Scan timeout handled correctly
- [ ] API rate limits handled
- [ ] Security events logged for infections

### Related Files
- `apps/api/src/services/file-storage-service.ts` - File storage
- `apps/api/src/services/security-event-service.ts` - Security events
- `env.example` - Environment variables

### Notes
- Consider caching scan results for identical files (hash-based)
- Add retry logic for API failures
- Consider async scanning for large files
- Update `env.example` with VirusTotal config

---

## 6. Thumbnail Generation

**Status:** 🔴 Not Started  
**Priority:** Low  
**Estimated Effort:** 1-2 days

### Description
Implement image thumbnail generation for uploaded images to improve performance and reduce bandwidth usage when displaying image galleries or previews.

### Implementation Steps

1. **Add Sharp Library**
   ```bash
   npm install sharp
   npm install --save-dev @types/sharp
   ```

2. **Update File Storage Service**
   - Enhance `generateThumbnail()` in `file-storage-service.ts`
   - Use Sharp to resize images
   - Generate multiple sizes (thumb, medium, large)
   - Store thumbnails alongside original

3. **Thumbnail Sizes**
   - Thumbnail: 150x150px
   - Medium: 300x300px
   - Large: 800x600px
   - Maintain aspect ratio

4. **Storage**
   - Store thumbnails in same storage provider
   - Use naming convention: `{originalId}_thumb.jpg`
   - Update FileMetadata to include thumbnail URLs

### Code Example

```typescript
import sharp from 'sharp';

async function generateThumbnail(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return await sharp(buffer)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
```

### Testing Checklist
- [ ] Thumbnails generated for images
- [ ] Aspect ratio maintained
- [ ] Non-image files skipped
- [ ] Thumbnails stored correctly
- [ ] Thumbnail URLs accessible

### Related Files
- `apps/api/src/services/file-storage-service.ts` - File storage
- `apps/api/package.json` - Dependencies

### Notes
- Only generate thumbnails for image MIME types
- Consider background job for large batches
- Add image optimization (WebP conversion)

---

## 7. Outgoing Webhook Deliveries

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Estimated Effort:** 3-4 days

### Description
Complete the webhook integration service to send outgoing webhooks to external systems (GitHub, Slack, Discord, etc.) when certain events occur, rather than just logging.

### Implementation Steps

1. **Database Schema**
   ```prisma
   model WebhookEndpoint {
     id          String   @id @default(cuid())
     userId      String
     url         String
     secret      String   // For signature verification
     events      String[] // Event types to subscribe to
     isActive    Boolean  @default(true)
     headers     Json?    // Custom headers
     user        User     @relation(fields: [userId], references: [id])
     deliveries  WebhookDelivery[]
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   
   model WebhookDelivery {
     id          String   @id @default(cuid())
     endpointId  String
     eventType   String
     payload     Json
     status      String   // pending, success, failed
     statusCode  Int?
     response    String?  @db.Text
     attempts    Int      @default(0)
     endpoint    WebhookEndpoint @relation(fields: [endpointId], references: [id])
     createdAt   DateTime @default(now())
     deliveredAt DateTime?
   }
   ```

2. **Webhook Service**
   - Create `webhook-delivery-service.ts`
   - Queue webhook deliveries
   - Retry failed deliveries
   - Sign payloads with HMAC

3. **Event Integration**
   - Hook into existing events:
     - Scan completed
     - Critical finding detected
     - Payment failed
     - User signed up
     - Subscription changed

4. **API Endpoints**
   - `POST /api/webhooks/endpoints` - Create webhook endpoint
   - `GET /api/webhooks/endpoints` - List endpoints
   - `DELETE /api/webhooks/endpoints/:id` - Delete endpoint
   - `GET /api/webhooks/deliveries` - View delivery history

5. **Worker Process**
   - Background job to process webhook queue
   - Retry logic with exponential backoff
   - Dead letter queue for failed deliveries

### Testing Checklist
- [ ] Webhook endpoint created successfully
- [ ] Webhook delivered on event trigger
- [ ] Payload signature verified correctly
- [ ] Failed deliveries retried
- [ ] Delivery history tracked
- [ ] Webhook disabled when endpoint deleted

### Related Files
- `prisma/schema.prisma` - Webhook models
- `apps/api/src/services/webhook-delivery-service.ts` - New service
- `apps/api/src/routes/webhooks.ts` - Webhook routes (extend)
- `apps/api/src/worker.ts` - Worker process

### Notes
- Use HMAC-SHA256 for payload signing
- Implement retry with exponential backoff (1s, 5s, 30s, 5m)
- Store delivery attempts for debugging
- Consider webhook testing endpoint

---

## 8. Security Report Data

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Estimated Effort:** 2-3 days

### Description
Improve the security report generator to pull real scan data from the database, replacing any "Section not implemented" placeholders with actual content.

### Implementation Steps

1. **Audit Current Report Generator**
   - Find `security-report-generator.ts`
   - Identify placeholder sections
   - List data sources needed

2. **Data Sources**
   - Scan results from `Scan` table
   - Findings from `Finding` table
   - Security events from `SecurityEvent` table
   - Usage statistics from usage tracking
   - Compliance status from compliance tables

3. **Report Sections to Implement**
   - Executive Summary (real metrics)
   - Scan Results Overview (from database)
   - Critical Findings (from Finding table)
   - Security Events Timeline (from SecurityEvent)
   - Compliance Status (from compliance data)
   - Recommendations (based on findings)

4. **Report Generation**
   - Query database for report period
   - Aggregate data by severity/category
   - Generate charts/graphs
   - Export to PDF/HTML

### Testing Checklist
- [ ] Report includes real scan data
- [ ] Report includes real findings
- [ ] Report includes security events
- [ ] Report exports to PDF correctly
- [ ] Report data is accurate for date range
- [ ] Report performance is acceptable

### Related Files
- `apps/api/src/services/security-report-generator.ts` - Report generator
- `prisma/schema.prisma` - Database models
- `apps/api/src/routes/reports.ts` - Report routes

### Notes
- Consider caching report data for performance
- Add report scheduling (daily/weekly/monthly)
- Email reports to stakeholders
- Add report templates for different audiences

---

## Implementation Priority Order

Based on security and product impact:

1. **Multi-Factor Auth Tracking** - Security critical
2. **Customer Notifications** - User experience, partially done
3. **Malware Scanning** - Security important
4. **Stripe Metered Billing** - Revenue impact
5. **Outgoing Webhook Deliveries** - Integration value
6. **Security Report Data** - Product completeness
7. **User Issue Tracking** - Support efficiency
8. **Thumbnail Generation** - Performance optimization

---

## Testing Strategy

For each P2 item:

1. **Unit Tests**
   - Test core logic in isolation
   - Mock external dependencies
   - Test error cases

2. **Integration Tests**
   - Test with real database
   - Test API endpoints
   - Test service integrations

3. **Manual Testing**
   - Test end-to-end flows
   - Test UI interactions
   - Test error handling

4. **Security Testing**
   - Test authentication/authorization
   - Test input validation
   - Test rate limiting

---

## Documentation Updates

For each completed item:

- [ ] Update README.md with new features
- [ ] Update API documentation
- [ ] Update env.example with new variables
- [ ] Add migration notes if schema changed
- [ ] Update deployment guides if needed

---

## Progress Tracking

Use this section to track completion:

- [ ] Multi-Factor Auth Tracking
- [ ] User Issue Tracking
- [ ] Stripe Metered Billing
- [ ] Customer Notifications (Complete)
- [ ] Malware Scanning for Uploads
- [ ] Thumbnail Generation
- [ ] Outgoing Webhook Deliveries
- [ ] Security Report Data

---

**Last Updated:** 2025-01-XX  
**Next Review:** After P1 items complete
