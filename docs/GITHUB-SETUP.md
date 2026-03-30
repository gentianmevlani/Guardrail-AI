# GitHub OAuth Setup Guide

This guide helps you configure GitHub OAuth integration for guardrail.

## Prerequisites

- A GitHub account
- Admin access to your guardrail installation
- Access to your GitHub organization settings (if using organization OAuth)

## Step 1: Create a GitHub OAuth App

1. **Log in to GitHub** and navigate to Settings
2. Go to **Developer settings** → **OAuth Apps** → **New OAuth App**
3. Fill in the application details:
   - **Application name**: guardrail
   - **Homepage URL**: `https://your-guardrail-domain.com`
   - **Authorization callback URL**: `https://your-guardrail-domain.com/api/auth/github/callback`
4. Click **Register application**

## Step 2: Configure the OAuth App

1. After registration, you'll see your **Client ID** - copy this value
2. Generate a **Client Secret**:
   - Click "Generate a new client secret"
   - Copy the secret immediately (you won't see it again)
3. Configure additional settings if needed:
   - **Application settings**: Enable "Device flow" if needed
   - **Webhook**: Optional, for real-time GitHub events

## Step 3: Update Environment Variables

Add the following to your `.env` file:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_REDIRECT_URI=https://your-domain.com/api/auth/github/callback
FRONTEND_URL=https://your-domain.com
```

## Step 4: Database Migration

Run the database migration to add GitHub integration tables:

```bash
npm run db:generate
npm run db:push
```

## Step 5: Restart the Application

```bash
npm run dev
```

## Testing the Integration

1. **Connect a GitHub Account**:
   - Log in to guardrail
   - Navigate to Integrations → GitHub
   - Click "Connect GitHub"
   - Authorize the application on GitHub

2. **Verify Connection**:
   - Check that your GitHub username appears
   - Verify your repositories are listed
   - Test scanning a repository

## Security Considerations

1. **Store Secrets Securely**:
   - Never commit `.env` files to version control
   - Use environment variables in production
   - Consider using a secret management service

2. **OAuth App Permissions**:
   - Request only necessary scopes (`repo`, `user:email`)
   - Review permissions regularly
   - Use organization OAuth for enterprise deployments

3. **Network Security**:
   - Use HTTPS for all URLs
   - Validate redirect URIs
   - Monitor for suspicious activity

## Troubleshooting

### Common Issues

1. **"Redirect URI mismatch"**
   - Ensure the callback URL in GitHub matches exactly
   - Check for trailing slashes or protocol differences

2. **"Invalid client_id or client_secret"**
   - Verify environment variables are loaded correctly
   - Check for extra spaces or special characters

3. **"Repository not found"**
   - Ensure the OAuth app has the correct permissions
   - Check if the repository is private and accessible

4. **"Rate limit exceeded"**
   - Implement proper rate limiting
   - Use GitHub API tokens efficiently
   - Consider upgrading API limits if needed

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
DEBUG=github:* npm run dev
```

## Organization OAuth (Optional)

For enterprise deployments, use organization OAuth:

1. Go to GitHub Organization Settings → Developer settings → OAuth Apps
2. Create an organization-owned OAuth app
3. Configure organization policies and restrictions
4. Update environment variables with organization app credentials

## Webhook Configuration (Optional)

For real-time GitHub events:

1. In your GitHub OAuth app settings, add a webhook URL
2. Configure webhook secret in your environment:
   ```bash
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```
3. Implement webhook handlers in your application

## Next Steps

- ✅ GitHub OAuth configured
- ✅ Users can connect their accounts
- ✅ Repositories are synchronized
- 📚 [Scan your first repository](./SCANNING.md)
- 🔧 [Set up CI/CD integration](./CI-CD-INTEGRATION.md)

## Support

- GitHub OAuth Documentation: https://docs.github.com/en/developers/apps/building-oauth-apps
- guardrail Documentation: https://docs.guardrail.dev
- Issues: https://github.com/guardrail/issues
