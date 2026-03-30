# Compliance Package Database Schema Requirements

The compliance package requires additional database tables that are not currently in the Prisma schema:

## Required Tables:
- complianceReport
- reportSchedule  
- evidenceCollection
- auditEvent
- complianceSchedule

## Recommended Action:
These tables need to be added to the Prisma schema before the compliance package can function properly. The current errors are due to missing database models, not code issues.
