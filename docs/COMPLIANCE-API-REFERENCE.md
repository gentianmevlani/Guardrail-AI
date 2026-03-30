# Compliance API Documentation

## Overview

The guardrail Compliance API provides GDPR-compliant data management, consent handling, and privacy features. All endpoints require authentication and follow strict security practices.

## Base URL

```
https://api.guardrail.dev/api/v1/legal
```

## Authentication

All API requests must include a valid JWT token:

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Consent Management

#### Get Consent Preferences

Retrieve the user's current cookie consent preferences.

```http
GET /consent
```

**Response:**
```json
{
  "success": true,
  "data": {
    "necessary": true,
    "analytics": false,
    "marketing": false,
    "functional": false
  }
}
```

#### Update Consent Preferences

Update the user's cookie consent preferences.

```http
POST /consent
```

**Request Body:**
```json
{
  "necessary": true,
  "analytics": true,
  "marketing": false,
  "functional": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "necessary": true,
    "analytics": true,
    "marketing": false,
    "functional": true
  }
}
```

### Legal Document Acceptance

#### Get Legal Acceptance Status

Check which legal documents the user has accepted and if updates are needed.

```http
GET /status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "terms": {
      "accepted": true,
      "version": "1.0",
      "acceptedAt": "2024-01-01T00:00:00Z",
      "currentVersion": "1.0",
      "needsUpdate": false
    },
    "privacy": {
      "accepted": false,
      "version": null,
      "acceptedAt": null,
      "currentVersion": "1.0",
      "needsUpdate": false
    }
  }
}
```

#### Accept Legal Document

Record acceptance of a legal document with version tracking.

```http
POST /accept
```

**Request Body:**
```json
{
  "docType": "terms",
  "version": "1.0",
  "locale": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "acceptance-123",
    "userId": "user-123",
    "docType": "terms",
    "version": "1.0",
    "acceptedAt": "2024-01-01T00:00:00Z",
    "ipHash": "hashed-ip",
    "userAgent": "Mozilla/5.0...",
    "locale": "en"
  }
}
```

### GDPR Data Export

#### Create Export Job

Initiate a GDPR data export job that will compile all user data.

```http
POST /gdpr/export
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job-123"
  }
}
```

#### Get Export Job Status

Check the status of an export job and get download link when ready.

```http
GET /gdpr/export/{jobId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job-123",
    "status": "completed",
    "createdAt": "2024-01-01T00:00:00Z",
    "startedAt": "2024-01-01T00:01:00Z",
    "completedAt": "2024-01-01T00:05:00Z",
    "downloadUrl": "/api/v1/legal/gdpr/export/job-123/download"
  }
}
```

#### Download Export File

Download the completed export file.

```http
GET /gdpr/export/{jobId}/download
```

**Response:** Binary file download with appropriate headers.

### GDPR Account Deletion

#### Create Deletion Job

Initiate permanent account deletion (requires strong confirmations).

```http
POST /gdpr/delete
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job-456"
  }
}
```

#### Get Deletion Job Status

Check the status of an account deletion job.

```http
GET /gdpr/delete/{jobId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job-456",
    "status": "completed",
    "createdAt": "2024-01-01T00:00:00Z",
    "startedAt": "2024-01-01T00:01:00Z",
    "completedAt": "2024-01-01T00:03:00Z"
  }
}
```

### Age Verification

#### Confirm Age

Confirm user meets minimum age requirement (16+ for GDPR).

```http
POST /age/confirm
```

**Request Body:**
```json
{
  "age": 18
}
```

**Response:**
```json
{
  "success": true,
  "message": "Age confirmed successfully"
}
```

#### Check Age Status

Check if user has completed age verification.

```http
GET /age/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isAgeConfirmed": true
  }
}
```

## Data Models

### Consent Preferences

```typescript
interface ConsentPreferences {
  necessary: boolean;  // Always required for operation
  analytics: boolean; // Google Analytics, etc.
  marketing: boolean; // Email marketing, ads
  functional: boolean; // Preferences, personalization
}
```

### Legal Acceptance

```typescript
interface LegalAcceptance {
  id: string;
  userId: string;
  docType: 'terms' | 'privacy';
  version: string;
  acceptedAt: string;
  ipHash?: string;
  userAgent?: string;
  locale?: string;
}
```

### GDPR Job

```typescript
interface GdprJob {
  id: string;
  userId: string;
  type: 'EXPORT' | 'DELETE';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  artifactPath?: string;
  signedUrl?: string;
  failureReason?: string;
  metadata?: any;
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Invalid or missing authentication
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Resource already exists (e.g., duplicate export job)
- `VALIDATION_ERROR` (400): Invalid request data
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

## Rate Limits

| Endpoint | Limit | Duration |
|----------|-------|----------|
| Consent endpoints | 10 requests | 1 minute |
| Export creation | 1 request | 1 hour |
| Deletion creation | 1 request | 1 day |
| Age verification | 5 requests | 1 hour |

## Security Features

### IP Hashing
All IP addresses are SHA-256 hashed with a unique salt per deployment for privacy compliance.

### Audit Trail
Every compliance action is logged with:
- User ID and actor ID (if different)
- Action performed
- Timestamp
- Metadata (IP hash, user agent, etc.)

### Data Encryption
- All sensitive data encrypted at rest
- API connections use TLS 1.3
- Export files signed with integrity hashes

## Export Data Format

The GDPR export produces a JSON file containing:

```json
{
  "exportInfo": {
    "userId": "user-123",
    "exportDate": "2024-01-01T00:00:00Z",
    "version": "1.0"
  },
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "isAgeConfirmed": true,
    "ageConfirmedAt": "2024-01-01T00:00:00Z"
  },
  "projects": [...],
  "usageRecords": [...],
  "subscriptions": [...],
  "apiKeys": [...],
  "auditLogs": [...],
  "consentPreferences": {...},
  "legalAcceptances": [...]
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
// Get consent preferences
const response = await fetch('/api/v1/legal/consent', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();

// Update consent
await fetch('/api/v1/legal/consent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    necessary: true,
    analytics: true,
    marketing: false,
    functional: false
  })
});

// Create export job
const exportResponse = await fetch('/api/v1/legal/gdpr/export', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const { jobId } = (await exportResponse.json()).data;

// Poll for completion
let status;
do {
  const statusResponse = await fetch(`/api/v1/legal/gdpr/export/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  status = (await statusResponse.json()).data;
  
  if (status.status === 'completed') {
    // Download the file
    window.open(status.downloadUrl);
    break;
  }
  
  await new Promise(resolve => setTimeout(resolve, 5000));
} while (status.status === 'pending' || status.status === 'processing');
```

### Python

```python
import requests
import time

base_url = "https://api.guardrail.dev/api/v1/legal"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Get consent preferences
response = requests.get(f"{base_url}/consent", headers=headers)
consent_data = response.json()

# Update consent
consent_update = {
    "necessary": True,
    "analytics": True,
    "marketing": False,
    "functional": False
}
response = requests.post(f"{base_url}/consent", headers=headers, json=consent_update)

# Create export job
response = requests.post(f"{base_url}/gdpr/export", headers=headers)
job_id = response.json()["data"]["jobId"]

# Poll for completion
while True:
    response = requests.get(f"{base_url}/gdpr/export/{job_id}", headers=headers)
    job_status = response.json()["data"]
    
    if job_status["status"] == "completed":
        print(f"Export ready: {job_status['downloadUrl']}")
        break
    elif job_status["status"] == "failed":
        print(f"Export failed: {job_status['failureReason']}")
        break
    
    time.sleep(5)
```

## Support

For API support and questions:
- **Technical Issues**: api-support@guardrail.dev
- **Privacy Questions**: privacy@guardrail.dev
- **Documentation**: docs.guardrail.dev/compliance-api

## Changelog

### v1.0.0 (2024-01-01)
- Initial release of Compliance API
- GDPR export and deletion endpoints
- Consent management
- Legal document acceptance
- Age verification
- Complete audit trail functionality
