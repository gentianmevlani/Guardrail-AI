# Backup & Restore Runbook

## Overview
This runbook provides step-by-step instructions for backing up and restoring guardrail production data.

## Prerequisites
- Docker and Docker Compose installed
- Access to production database credentials
- Sufficient storage for backups (at least 2x current database size)
- Backup storage location (S3 bucket, local storage, etc.)

## Backup Procedures

### 1. Database Backup

#### Automated Daily Backup
```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="guardrail_backup_${TIMESTAMP}.sql"
S3_BUCKET="your-backup-bucket"

echo "Starting database backup: ${BACKUP_FILE}"

# Extract database credentials from environment
DB_URL=${DATABASE_URL}
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=${DB_PASSWORD}

# Create backup using pg_dump
docker exec guardrail-postgres pg_dump \
  -h ${DB_HOST} \
  -p ${DB_PORT} \
  -U ${DB_USER} \
  -d ${DB_NAME} \
  --no-password \
  --verbose \
  --clean \
  --if-exists \
  --format=custom \
  --compress=9 \
  --file=/tmp/${BACKUP_FILE}

# Copy backup from container
docker cp guardrail-postgres:/tmp/${BACKUP_FILE} ./

# Upload to S3 (optional)
if [ ! -z "$S3_BUCKET" ]; then
  aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/database/
  echo "Backup uploaded to S3: s3://${S3_BUCKET}/database/${BACKUP_FILE}"
fi

# Clean up local file (keep last 7 days)
find . -name "guardrail_backup_*.sql" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}"
EOF

chmod +x backup-db.sh
```

#### Manual Backup
```bash
# Immediate backup
./backup-db.sh

# Or using docker directly
docker exec guardrail-postgres pg_dump \
  -U postgres \
  -d guardrail \
  --format=custom \
  --compress=9 \
  --file=manual_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. File System Backup

```bash
# Backup user uploads and important files
tar -czf files_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  uploads/ \
  logs/ \
  config/ \
  --exclude=node_modules \
  --exclude=.git
```

### 3. Configuration Backup

```bash
# Backup environment and configuration
cp .env.production .env.backup.$(date +%Y%m%d_%H%M%S)
cp docker-compose.prod.yml docker-compose.prod.backup.$(date +%Y%m%d_%H%M%S)
```

## Restore Procedures

### 1. Preparation

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Create restore directory
mkdir -p restore
cd restore
```

### 2. Database Restore

#### From Local Backup
```bash
# Copy backup file to restore directory
cp ../guardrail_backup_YYYYMMDD_HHMMSS.sql ./

# Stop PostgreSQL if running
docker-compose -f docker-compose.prod.yml stop postgres

# Remove existing data volume (WARNING: This deletes current data)
docker volume rm guardrail_postgres_data

# Start PostgreSQL
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for PostgreSQL to be ready
sleep 30

# Restore database
docker cp guardrail_backup_YYYYMMDD_HHMMSS.sql guardrail-postgres:/tmp/restore.sql

docker exec guardrail-postgres psql \
  -U postgres \
  -c "DROP DATABASE IF EXISTS guardrail;"
  
docker exec guardrail-postgres psql \
  -U postgres \
  -c "CREATE DATABASE guardrail;"

docker exec guardrail-postgres pg_restore \
  -h localhost \
  -p 5432 \
  -U postgres \
  -d guardrail \
  --verbose \
  --clean \
  --if-exists \
  /tmp/restore.sql
```

#### From S3 Backup
```bash
# Download backup from S3
aws s3 cp s3://your-backup-bucket/database/guardrail_backup_YYYYMMDD_HHMMSS.sql ./

# Then follow the same restore procedure as above
```

### 3. File System Restore

```bash
# Restore files
tar -xzf ../files_backup_YYYYMMDD_HHMMSS.tar.gz -C ../

# Restore configuration
cp ../.env.backup.YYYYMMDD_HHMMSS ../.env.production
```

### 4. Service Restart

```bash
# Start all services
cd ..
docker-compose -f docker-compose.prod.yml up -d

# Check service health
./scripts/health-check.sh

# Verify database connectivity
docker exec guardrail-api npm run db:migrate
```

## Validation & Smoke Tests

### 1. Database Validation

```bash
# Check user count
docker exec guardrail-postgres psql \
  -U postgres \
  -d guardrail \
  -c "SELECT COUNT(*) FROM users;"

# Check critical tables
docker exec guardrail-postgres psql \
  -U postgres \
  -d guardrail \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

### 2. API Health Check

```bash
# Test API endpoints
curl -f http://localhost:3000/health || exit 1
curl -f http://localhost:3000/api/v1/status || exit 1

# Test authentication (if working)
curl -f -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}' || echo "Auth test failed (expected if no test user)"
```

### 3. Application Smoke Test

```bash
# Run application smoke tests
cd apps/web-ui
npm run test:smoke || exit 1

cd ../..
npm run test:integration || exit 1
```

## Monitoring & Alerting

### 1. Backup Monitoring

```bash
# Check backup success in logs
docker logs guardrail-backup | grep "Backup completed"

# Monitor backup file sizes
ls -lh *.sql | tail -5
```

### 2. Restore Monitoring

```bash
# Monitor database restore progress
docker logs guardrail-postgres | tail -20

# Check service startup
docker-compose -f docker-compose.prod.yml ps
```

## Emergency Procedures

### 1. Point-in-Time Recovery (PITR)

```bash
# If using WAL archiving, restore to specific time
docker exec guardrail-postgres pg_basebackup \
  -h localhost \
  -D /tmp/pitr_backup \
  -U postgres \
  -v \
  -P \
  -W

# Then use pg_walfile to replay to specific time
```

### 2. Partial Restore

```bash
# Restore specific tables only
pg_restore -h localhost -U postgres -d guardrail \
  --table=users \
  --table=projects \
  backup_file.sql
```

### 3. Rollback Procedures

```bash
# If restore fails, rollback to previous state
docker-compose -f docker-compose.prod.yml down
docker volume rm guardrail_postgres_data
docker-compose -f docker-compose.prod.yml up -d postgres
# Then restore from previous backup
```

## Security Considerations

1. **Backup Encryption**: Ensure backups are encrypted at rest
2. **Access Control**: Limit backup/restore access to authorized personnel
3. **Audit Logging**: Log all backup/restore operations
4. **Off-site Storage**: Store backups in geographically separate locations

## Schedule & Retention

- **Daily Backups**: Keep for 30 days
- **Weekly Backups**: Keep for 12 weeks
- **Monthly Backups**: Keep for 12 months
- **Annual Backups**: Keep for 7 years

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check Docker volumes and file permissions
2. **Connection Failed**: Verify database connectivity and credentials
3. **Corrupted Backup**: Test backup integrity immediately after creation
4. **Space Issues**: Monitor disk space during backup/restore operations

### Recovery Commands

```bash
# Check PostgreSQL logs
docker logs guardrail-postgres

# Check Docker volumes
docker volume ls

# Force remove corrupted volume
docker volume rm -f guardrail_postgres_data

# Recreate from scratch
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

## Contact Information

- **Primary**: DevOps Team (devops@guardrail.dev)
- **Escalation**: CTO (cto@guardrail.dev)
- **Emergency**: +1-555-EMERGENCY

---

**Last Updated**: 2026-01-06
**Version**: 1.0
**Next Review**: 2026-04-06
