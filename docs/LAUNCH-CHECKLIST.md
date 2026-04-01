# Project Launch Checklist

## 🚨 Critical (Blocker-Level)

### Observability
- [ ] Structured logging with correlation IDs (not console.log)
- [ ] Error reporting (Sentry/Datadog/LogRocket) with source maps
- [ ] Health checks + readiness/liveness endpoints
- [ ] Metrics collection (Prometheus/Datadog)
- [ ] Distributed tracing (OpenTelemetry) - optional but recommended

### Security
- [ ] Rate limiting & abuse protection on public endpoints
- [ ] Secure cookies, CSP, CORS configured
- [ ] Input sanitization on all user inputs
- [ ] Secrets in vault (not hardcoded)
- [ ] Authentication timeout configured
- [ ] .env in .gitignore

### Database
- [ ] Migration plan (lock + rollback + zero-downtime strategy)
- [ ] Backups & restore tested
- [ ] Connection pooling configured
- [ ] Query timeout configured

### Resilience
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker for external services
- [ ] Request timeouts configured (8-10 seconds)
- [ ] Graceful degradation for failures

## 🔴 High Priority

### Frontend
- [ ] Error boundaries (not just one global)
- [ ] Loading states for async operations
- [ ] Empty states for lists
- [ ] 404 page
- [ ] Graceful fallbacks for UI

### Backend
- [ ] Error handling middleware
- [ ] Request validation (Zod/similar)
- [ ] Response standardization
- [ ] Request ID middleware

### Monitoring & Alerts
- [ ] Monitoring on SLIs (5xx rate, latency P95/P99, error count)
- [ ] Alerting configured (PagerDuty/Slack)
- [ ] Dashboards created (SRE + Product)

### Configuration
- [ ] Feature flags for risky launches
- [ ] Environment-based configuration
- [ ] Secrets rotation plan

### Cache
- [ ] Cache invalidation strategy documented
- [ ] TTLs configured
- [ ] Cache purge endpoints

## 🟡 Nice-to-Have (Ship Early But Not Blocking)

### User Experience
- [ ] Offline/draft persistence for critical flows
- [ ] Service worker for asset caching
- [ ] State persistence (localStorage sync)

### Accessibility
- [ ] A11y audit for top pages
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] ARIA labels on interactive elements

### Performance
- [ ] Performance budget defined
- [ ] Bundle splitting configured
- [ ] Image optimization
- [ ] Lazy loading for routes

### Documentation
- [ ] Runbook for common incidents
- [ ] API documentation
- [ ] Setup instructions in README
- [ ] Architecture diagram

### Testing
- [ ] One automated E2E test per critical flow
- [ ] Smoke test script after deploy
- [ ] Load testing for critical endpoints

### Analytics
- [ ] Analytics events mapped to business KPIs
- [ ] Conversion funnels tracked
- [ ] User behavior tracking

## 📋 Minimum Deliverables Before "Go Live"

### Operations
- [ ] Runbook + on-call contact
- [ ] Postmortem template ready
- [ ] Rollback procedure documented
- [ ] Incident response plan

### Testing
- [ ] Smoke test script that runs after deploy
- [ ] One automated E2E test per critical flow
- [ ] Manual testing checklist completed

### Monitoring
- [ ] Health check endpoint working
- [ ] Error reporting configured
- [ ] Basic alerts configured
- [ ] Dashboards accessible

## 🎯 Post-Launch

### Week 1
- [ ] Monitor error rates daily
- [ ] Review logs for issues
- [ ] Check performance metrics
- [ ] Gather user feedback

### Week 2-4
- [ ] Performance optimization
- [ ] Fix critical bugs
- [ ] Improve monitoring
- [ ] Document learnings

## 💡 Pro Tips

1. **Start with Critical items** - These will cause production failures
2. **Don't skip observability** - You'll need it when things break
3. **Test rollback** - Know how to revert before you need to
4. **Document as you go** - Future you will thank present you
5. **Set up alerts early** - Catch issues before users do

---

**Use this checklist before every major release!** 🚀

