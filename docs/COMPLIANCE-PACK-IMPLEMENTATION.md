# Compliance Pack Implementation

This document outlines the complete implementation of guardrail's Compliance Pack, providing GDPR compliance, consent management, and privacy features.

## Overview

The Compliance Pack delivers enterprise-grade privacy and data protection capabilities:

- **GDPR Data Export & Deletion**: Complete data portability and right to erasure
- **Cookie Consent Management**: GDPR-compliant cookie consent with granular controls
- **Legal Document Acceptance**: Versioned terms and privacy policy acceptance
- **Age Verification**: Defensible age gating for compliance requirements
- **Audit Trail**: Complete logging of all compliance-related actions

## Architecture

### Database Schema

New tables added for compliance:

```sql
-- Consent preferences with audit trail
consent_preferences (
  id, user_id, necessary, analytics, marketing, functional, 
  source, ip_hash, updated_at, created_at
)

-- Legal document acceptance with versioning
legal_acceptances (
  id, user_id, doc_type, version, accepted_at, 
  ip_hash, user_agent, locale
)

-- GDPR job tracking for async operations
gdpr_jobs (
  id, user_id, type, status, created_at, started_at, 
  completed_at, artifact_path, signed_url, failure_reason, metadata
)

-- Comprehensive audit logging
gdpr_audit_log (
  id, user_id, action, actor_user_id, timestamp, metadata
)
```

### API Endpoints

All compliance endpoints are under `/api/v1/legal/` and require authentication:

#### Consent Management
- `GET /consent` - Get user's consent preferences
- `POST /consent` - Update consent preferences

#### Legal Acceptance
- `GET /status` - Get legal acceptance status
- `POST /accept` - Accept legal document

#### GDPR Operations
- `POST /gdpr/export` - Create data export job
- `GET /gdpr/export/:jobId` - Get export job status
- `GET /gdpr/export/:jobId/download` - Download export file
- `POST /gdpr/delete` - Create account deletion job
- `GET /gdpr/delete/:jobId` - Get deletion job status

#### Age Verification
- `POST /age/confirm` - Confirm user age
- `GET /age/status` - Check age confirmation status

### Frontend Components

#### Cookie Consent Banner
- **Location**: `apps/web-ui/src/components/compliance/CookieConsentBanner.tsx`
- **Features**: 
  - Granular consent controls (necessary, analytics, marketing, functional)
  - Preference center with detailed explanations
  - IP-based audit logging
  - Automatic script blocking based on consent

#### GDPR Data Management
- **Location**: `apps/web-ui/src/components/compliance/GdprDataManagement.tsx`
- **Features**:
  - One-click data export with job tracking
  - Account deletion with multiple confirmations
  - Real-time job status updates
  - Legal rights information

#### Age Verification Gate
- **Location**: `apps/web-ui/src/components/compliance/AgeVerificationGate.tsx`
- **Features**:
  - Minimal but defensible age confirmation
  - GDPR-compliant (16+ age requirement)
  - Server-side verification with audit trail

#### Legal Acceptance Modal
- **Location**: `apps/web-ui/src/components/compliance/LegalAcceptanceModal.tsx`
- **Features**:
  - Versioned document acceptance
  - Full document preview
  - Bulk acceptance for required documents
  - Change detection for new versions

## Security Features

### Data Protection
- **IP Hashing**: All IP addresses are SHA-256 hashed with salt
- **Rate Limiting**: GDPR endpoints have strict rate limits
- **Authentication**: All endpoints require valid authentication
- **Audit Logging**: Every action is logged with actor and timestamp

### Privacy by Design
- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Clear purposes for data collection
- **Storage Limitation**: Automatic cleanup of temporary data
- **Right to Erasure**: Complete data deletion capability

## Implementation Details

### Export Data Assembly

The export functionality assembles all user-owned data:

```typescript
interface GdprExportData {
  user: User profile (identifiers, timestamps, preferences)
  projects: All projects and scan results
  usageRecords: Complete usage history
  subscriptions: Billing and subscription data
  apiKeys: API key metadata (no secrets)
  auditLogs: GDPR audit trail
  consentPreferences: Cookie consent history
  legalAcceptances: Terms/privacy acceptance history
}
```

### Deletion Process

Account deletion follows a strict sequence:

1. **User-owned data**: Projects, scans, usage records, API keys
2. **Compliance data**: Consent, legal acceptances, audit logs
3. **Authentication data**: Refresh tokens, sessions
4. **User profile**: Final account deletion
5. **Audit entry**: Log the deletion action

### Job Processing

GDPR operations are processed asynchronously:

```typescript
// Export job flow
pending → processing → completed (with download link)
                    → failed (with error reason)

// Deletion job flow  
pending → processing → completed (account deleted)
                    → failed (with error reason)
```

## Configuration

### Environment Variables

```bash
# Document versions (update when documents change)
TERMS_VERSION=1.0
PRIVACY_VERSION=1.0

# IP hashing salt (change per deployment)
IP_HASH_SALT=your-random-salt-here

# Age verification settings
MINIMUM_AGE=16
```

### Rate Limits

- Consent endpoints: 10 requests/minute
- Export creation: 1 request/hour
- Deletion creation: 1 request/day
- Age verification: 5 requests/hour

## Testing

### Unit Tests
- **Service Layer**: `apps/api/src/services/__tests__/compliance-service.test.ts`
- **API Routes**: `apps/api/src/routes/__tests__/compliance-v1.test.ts`

### Test Coverage
- Consent preference management
- Legal document acceptance
- GDPR export/deletion workflows
- Age verification
- Error handling and edge cases
- Security validation

### Integration Testing
- End-to-end API workflows
- Database transaction integrity
- Authentication and authorization
- Rate limiting enforcement

## Operational Runbooks

### Data Export Requests

1. **User Request**: User initiates export via UI or API
2. **Job Creation**: System creates async export job
3. **Data Assembly**: Gather all user-owned data
4. **File Generation**: Create JSON export with metadata
5. **Notification**: User notified of completion
6. **Download**: Secure download link provided
7. **Cleanup**: Export file deleted after 7 days

### Account Deletion Requests

1. **User Request**: Multiple confirmations required
2. **Job Creation**: System creates deletion job
3. **Data Removal**: Delete all user-owned data
4. **Account Cleanup**: Remove authentication tokens
5. **Audit Logging**: Log deletion with actor
6. **Confirmation**: Notify completion

### Legal Document Updates

1. **Version Update**: Increment document version
2. **Environment Update**: Set new version in env vars
3. **User Detection**: System detects outdated acceptances
4. **Re-acceptance**: Users must accept new version
5. **Audit Trail**: Track all acceptance changes

## Compliance Checklist

### GDPR Compliance
- [x] Right to Access (Data Export)
- [x] Right to Erasure (Account Deletion)
- [x] Right to Rectification (Profile Updates)
- [x] Right to Portability (Structured Export)
- [x] Consent Management (Cookie Banner)
- [x] Age Verification (16+ Requirement)
- [x] Audit Trail (Complete Logging)
- [x] Data Protection (Encryption, Hashing)

### ePrivacy Directive
- [x] Cookie Consent (Granular Controls)
- [x] Consent Records (IP Hashed Logs)
- [x] Withdrawal Consent (Preference Updates)
- [x] Non-Essential Blocking (Script Control)

### Security Standards
- [x] Authentication Required (All Endpoints)
- [x] Rate Limiting (Abuse Prevention)
- [x] Input Validation (Schema Enforcement)
- [x] Error Handling (No Data Leakage)
- [x] Audit Logging (Action Tracking)

## Monitoring and Alerts

### Key Metrics
- Export request volume
- Deletion request volume
- Consent acceptance rates
- Age verification completion
- API error rates

### Alert Conditions
- High deletion request volume
- Export job failures
- Consent update failures
- Authentication failures
- Rate limit breaches

## Data Retention

### Export Files
- **Retention**: 7 days after generation
- **Storage**: Secure cloud storage
- **Access**: Authenticated download only
- **Cleanup**: Automatic deletion

### Audit Logs
- **Retention**: 2 years (legal requirement)
- **Storage**: Database with encryption
- **Access**: Admin only
- **Backup**: Regular backups included

### Consent Records
- **Retention**: Until consent withdrawal
- **Storage**: Database with IP hashing
- **Access**: User and admin
- **Updates**: Full version history

## Deployment Notes

### Database Migration
```bash
# Apply compliance schema changes
npx prisma migrate deploy

# Generate new Prisma client
npx prisma generate
```

### Environment Setup
```bash
# Set required environment variables
export TERMS_VERSION=1.0
export PRIVACY_VERSION=1.0
export IP_HASH_SALT=$(openssl rand -hex 32)
export MINIMUM_AGE=16
```

### Frontend Integration
```tsx
// Add to main app layout
import { CookieConsentBanner } from '@/components/compliance';

function App() {
  return (
    <>
      <CookieConsentBanner />
      {/* Rest of app */}
    </>
  );
}
```

## Support and Troubleshooting

### Common Issues

**Export Job Stuck**
- Check job status in database
- Verify file storage permissions
- Review worker process logs

**Consent Not Saving**
- Verify authentication token
- Check rate limiting status
- Review database connectivity

**Age Verification Failing**
- Confirm minimum age setting
- Check user authentication
- Verify database schema

### Debug Commands
```sql
-- Check pending jobs
SELECT * FROM gdpr_jobs WHERE status = 'pending';

-- Verify consent records
SELECT * FROM consent_preferences WHERE user_id = 'user-id';

-- Review audit trail
SELECT * FROM gdpr_audit_log WHERE user_id = 'user-id' ORDER BY timestamp DESC;
```

### Support Contacts
- **Technical Issues**: engineering@guardrail.dev
- **Privacy Questions**: privacy@guardrail.dev
- **Legal Compliance**: legal@guardrail.dev

## Future Enhancements

### Planned Features
- [ ] Data processing agreements integration
- [ ] Automated consent renewal
- [ ] Advanced audit reporting
- [ ] Multi-jurisdiction compliance
- [ ] Consent management API for third parties

### Compliance Roadmap
- **Q1 2026**: CCPA compliance enhancements
- **Q2 2026**: Data processing records
- **Q3 2026**: Automated compliance reporting
- **Q4 2026**: Multi-region data residency

---

This Compliance Pack provides a comprehensive foundation for GDPR and privacy compliance. Regular reviews and updates are essential to maintain compliance with evolving regulations.
