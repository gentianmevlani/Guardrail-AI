# GitHub App Integration Guide

This document describes the GitHub App integration for automatic security scans on pull requests.

## Overview

The GitHub App integration enables:
- Automatic security scans when pull requests are opened or updated
- GitHub Check Runs with annotations for critical/high findings
- PR comments with scan summaries
- Idempotent processing (no duplicate comments/checks)

## Architecture

### Components

1. **Webhook Handler** (`apps/api/src/routes/webhooks.ts`)
   - Receives GitHub webhook events
   - Verifies webhook signatures
   - Handles installation, PR, and push events

2. **GitHub App Service** (`apps/api/src/services/github-app-service.ts`)
   - Manages GitHub App authentication (JWT)
   - Gets installation tokens
   - Creates/updates check runs
   - Posts/updates PR comments

3. **Scan Service** (integrated in webhook handler)
   - Clones repository at specific SHA
   - Runs security scan
   - Stores findings in database

4. **Dashboard UI** (`apps/web-ui/src/components/settings/github-app-status.tsx`)
   - Shows connected organizations/repositories
   - Displays last webhook activity

## Setup

### 1. Create GitHub App

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **GitHub App name**: guardrail Security
   - **Homepage URL**: `https://your-domain.com`
   - **Webhook URL**: `https://your-domain.com/api/webhooks/github`
   - **Webhook secret**: Generate a secure random string
3. Set permissions:
   - **Checks**: Read & Write
   - **Pull requests**: Read & Write
   - **Contents**: Read-only
   - **Metadata**: Read-only
4. Subscribe to events:
   - `pull_request`
   - `push`
   - `installation`
   - `installation_repositories`
5. Save and note:
   - App ID
   - Generate and download private key

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Required
GITHUB_WEBHOOK_SECRET=your_webhook_secret_from_step_1
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key_pem_or_base64

# Optional (for OAuth flows)
GITHUB_APP_CLIENT_ID=your_client_id
GITHUB_APP_CLIENT_SECRET=your_client_secret

# Frontend URL for generating run links
FRONTEND_URL=https://your-domain.com
```

**Note**: `GITHUB_APP_PRIVATE_KEY` can be:
- PEM format (starts with `-----BEGIN RSA PRIVATE KEY-----`)
- Base64 encoded (will be decoded automatically)

### 3. Install GitHub App

1. Go to your GitHub App settings
2. Click "Install App"
3. Select organization/user and repositories
4. Install

The webhook will automatically create installation and repository records in the database.

## How It Works

### Pull Request Flow

1. **PR Event Received**
   - GitHub sends webhook to `/api/webhooks/github`
   - Signature is verified using `GITHUB_WEBHOOK_SECRET`
   - Event is stored in `github_webhook_events` table

2. **Idempotency Check**
   - Checks if this SHA has already been processed
   - Prevents duplicate check runs/comments

3. **Repository Clone**
   - Clones repository at PR branch and SHA
   - Uses temporary directory

4. **Security Scan**
   - Scans code for security issues:
     - Hardcoded secrets (API keys, passwords, tokens)
     - Unsafe code patterns (eval, innerHTML, SQL injection risks)
     - XSS vulnerabilities
   - Stores findings in database

5. **Check Run Creation**
   - Creates GitHub Check Run with:
     - Status: completed
     - Conclusion: success/failure/neutral based on findings
     - Annotations for critical/high findings (max 50)
   - Updates existing check run if PR is synchronized

6. **PR Comment**
   - Posts or updates comment with:
     - Summary table (severity breakdown)
     - Link to full guardrail report
     - Idempotency marker to prevent duplicates

### Installation Flow

1. **Installation Created**
   - Webhook stores installation in `github_app_installations`
   - Records account info, permissions, events

2. **Repositories Added**
   - Webhook stores repositories in `github_app_repositories`
   - Links to installation

3. **Installation Deleted**
   - Marks installation as inactive
   - Marks repositories as inactive

## Database Schema

### Tables

- `github_app_installations` - GitHub App installations
- `github_app_repositories` - Repositories in installations
- `github_webhook_events` - Webhook event tracking (idempotency)
- `github_check_runs` - Check runs created
- `scans` - Scan records
- `findings` - Security findings

## API Endpoints

### Webhook Endpoint

```
POST /api/webhooks/github
```

**Headers:**
- `X-Hub-Signature-256`: Webhook signature (verified)
- `X-GitHub-Event`: Event type (pull_request, installation, etc.)
- `X-GitHub-Delivery`: Unique delivery ID

**Response:**
```json
{
  "received": true,
  "event": "pull_request",
  "deliveryId": "..."
}
```

### Status Endpoint

```
GET /api/webhooks/status
```

Returns webhook configuration status.

### GitHub App Status

```
GET /api/v1/github/app/status
```

Returns all GitHub App installations with repositories and last webhook activity.

## Testing

### Local Testing

1. Use ngrok or similar to expose local server:
   ```bash
   ngrok http 3000
   ```

2. Update GitHub App webhook URL to ngrok URL

3. Create a test PR to trigger webhook

4. Check logs for webhook processing

### Manual Webhook Testing

You can test webhooks using GitHub's webhook delivery feature:
1. Go to GitHub App settings → Advanced → Webhook deliveries
2. Click "Redeliver" on a recent event
3. Check your logs

## Troubleshooting

### Webhook Signature Verification Fails

- Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App settings
- Check that webhook URL is correct
- Ensure signature header is `x-hub-signature-256`

### Check Runs Not Created

- Verify GitHub App has "Checks: Read & Write" permission
- Check installation is active in database
- Review logs for API errors

### PR Comments Not Posted

- Verify GitHub App has "Pull requests: Read & Write" permission
- Check for existing comments (may be updating instead of creating)
- Review logs for API errors

### Scans Not Running

- Verify repository is cloned successfully
- Check temp directory permissions
- Review scan logs for errors

## Security Considerations

1. **Webhook Signature Verification**: Always verify webhook signatures
2. **Installation Tokens**: Tokens are short-lived (1 hour) and scoped to installation
3. **Repository Access**: Only repositories in installation can be scanned
4. **Rate Limiting**: GitHub API rate limits apply (5000 requests/hour for installations)

## Monitoring

Monitor:
- Webhook delivery success rate
- Scan completion time
- Check run creation success
- PR comment posting success
- Installation token refresh failures

## Future Enhancements

- [ ] Async scan processing (queue-based)
- [ ] Full SecurityOrchestrator integration
- [ ] Custom scan configurations per repository
- [ ] Scan result caching
- [ ] Webhook retry mechanism
- [ ] Installation token caching
