# P2 Backlog - Quick Checklist

Quick reference checklist for P2 items. See `P2_BACKLOG.md` for detailed implementation notes.

## 🔴 Not Started

### 1. Multi-Factor Auth (MFA) Tracking
- [ ] Database schema update (mfaEnabled, mfaSecret, etc.)
- [ ] MFA setup endpoints (setup, verify, disable)
- [ ] MFA enforcement in auth middleware
- [ ] Frontend MFA setup UI
- [ ] Tests (unit, integration, E2E)
- [ ] Documentation

### 2. User Issue Tracking / Support Tickets
- [ ] Database schema (SupportTicket model)
- [ ] API endpoints (create, list, update)
- [ ] Frontend support page
- [ ] Admin ticket management
- [ ] Email notifications
- [ ] Tests
- [ ] Documentation

### 3. Stripe Metered Billing
- [ ] Stripe metered price setup
- [ ] Usage record creation endpoint
- [ ] Automatic usage recording
- [ ] Usage webhook handling
- [ ] Invoice integration
- [ ] Tests
- [ ] Documentation

### 4. Customer Notifications (Complete)
- [ ] Subscription activated email
- [ ] Subscription cancelled email
- [ ] Subscription renewed email
- [ ] Password reset email
- [ ] Account locked email
- [ ] Security alert emails
- [ ] Scan complete email
- [ ] Critical finding alert email
- [ ] Tests
- [ ] Documentation

### 5. Malware Scanning for Uploads
- [ ] Choose scanning provider (VirusTotal/ClamAV)
- [ ] Environment variables setup
- [ ] Integrate scanner into file upload flow
- [ ] Quarantine system
- [ ] Security event logging
- [ ] Tests
- [ ] Documentation

### 6. Thumbnail Generation
- [ ] Install Sharp library
- [ ] Implement thumbnail generation
- [ ] Multiple size support
- [ ] Storage integration
- [ ] Tests
- [ ] Documentation

### 7. Outgoing Webhook Deliveries
- [ ] Database schema (WebhookEndpoint, WebhookDelivery)
- [ ] Webhook delivery service
- [ ] Event integration
- [ ] API endpoints
- [ ] Worker process for queue
- [ ] Retry logic
- [ ] Tests
- [ ] Documentation

### 8. Security Report Data
- [ ] Audit current report generator
- [ ] Implement real scan data queries
- [ ] Implement findings data
- [ ] Implement security events data
- [ ] Implement compliance data
- [ ] Report export (PDF/HTML)
- [ ] Tests
- [ ] Documentation

---

## Implementation Order (Recommended)

1. **Multi-Factor Auth** (Security critical)
2. **Customer Notifications** (Partially done, finish remaining)
3. **Malware Scanning** (Security important)
4. **Stripe Metered Billing** (Revenue impact)
5. **Outgoing Webhook Deliveries** (Integration value)
6. **Security Report Data** (Product completeness)
7. **User Issue Tracking** (Support efficiency)
8. **Thumbnail Generation** (Performance optimization)

---

## Notes

- Each item should be completed fully before moving to the next
- Write tests as you implement
- Update documentation after completion
- Test manually before marking complete
- Update this checklist as you progress
