# GitHub Actions Workflows

This repository uses GitHub Actions for continuous integration, automated icon updates, and releases.

## Workflows

### 1. CI (`ci.yml`)

**Trigger:** Push to `main` or `develop`, Pull Requests

**Purpose:** Validate code quality and ensure plugin builds correctly

**Jobs:**

- **Lint & Format Check**: Runs ESLint and Prettier
- **Type Check**: Validates TypeScript types
- **Test**: Runs unit tests and generates coverage reports
- **Build**: Builds the plugin and uploads artifacts

**Configuration:** No secrets required

---

### 2. Icon Update (`icon-update.yml`)

**Trigger:**

- Daily at 2 AM UTC (scheduled)
- Manual via workflow_dispatch

**Purpose:** Automatically detect and create PRs for Material Icons updates from Google

**Process:**

1. Fetches latest icon list from Google's material-design-icons repository
2. Compares with current version to detect changes
3. Generates delta files (added/removed/modified icons)
4. Runs tests to ensure compatibility
5. Creates a Pull Request if changes detected and tests pass
6. Creates an Issue if tests fail
7. Sends Pushover notifications (if configured)

**Required Secrets:**

- None (uses default `GITHUB_TOKEN`)

**Optional Secrets:**

- `PUSHOVER_TOKEN` - Your Pushover application token
- `PUSHOVER_USER` - Your Pushover user key

**Manual Trigger:**

```bash
# Via GitHub CLI
gh workflow run icon-update.yml

# Or via web UI
# Actions → Icon Update → Run workflow
```

---

### 3. Release (`release.yml`)

**Trigger:** Push to `main` branch

**Purpose:** Automated semantic versioning and releases

**Process:**

1. Runs tests and builds plugin
2. Analyzes commits to determine version bump
3. Creates release notes
4. Publishes GitHub Release (if semantic-release is configured)

**Note:** This workflow uses semantic-release. For manual releases with .fig files, use `./scripts/release.sh` instead.

**Required Secrets:**

- Uses default `GITHUB_TOKEN` (already available)

---

## Setup Instructions

### 1. Repository Settings

No additional configuration needed for basic workflows. All workflows use the default `GITHUB_TOKEN` which is automatically provided by GitHub Actions.

### 2. Optional: Pushover Notifications

To receive mobile notifications when icon updates are available:

1. **Create a Pushover account**: https://pushover.net/
2. **Create an application**: https://pushover.net/apps/build
3. **Add secrets to GitHub**:

   ```
   Repository → Settings → Secrets and variables → Actions → New repository secret

   Name: PUSHOVER_TOKEN
   Value: <your-application-token>

   Name: PUSHOVER_USER
   Value: <your-user-key>
   ```

Notifications will include:

- ✅ Success: PR created with icon update
- ❌ Failure: Tests failed, manual intervention needed

### 3. Testing Workflows

Before the first automated run, test the workflows manually:

```bash
# Test icon update workflow
gh workflow run icon-update.yml

# Check workflow status
gh run list --workflow=icon-update.yml

# View logs
gh run view <run-id>
```

---

## Workflow Outputs

### Icon Update Workflow

**On Success (PR created):**

- Creates PR with title: `🎨 Update Material Icons to <commit>`
- Labels: `icon-update`, `automated`
- Assigns to repository owner
- Sends Pushover notification (if configured)

**On Failure (tests failed):**

- Creates Issue with failure details
- Labels: `bug`, `icon-update`, `automated`
- Sends Pushover notification (if configured)

**On No Changes:**

- Logs "No changes detected" in workflow summary
- No PR or issue created

### CI Workflow

**On Success:**

- All checks pass
- Build artifacts uploaded (retained for 7 days)
- Coverage report uploaded to Codecov (if configured)

**On Failure:**

- Workflow fails
- PR checks marked as failed
- Details available in workflow logs

---

## Troubleshooting

### Icon Update Workflow Fails

1. **Check workflow logs:**

   ```bash
   gh run view --log
   ```

2. **Common issues:**
   - Network timeout connecting to Google's repo
   - API rate limit exceeded
   - Test failures due to icon format changes

3. **Manual recovery:**

   ```bash
   # Pull the branch
   gh pr checkout <pr-number>

   # Run tests locally
   pnpm test

   # Fix issues and push
   git push
   ```

### Rate Limiting

GitHub Actions has rate limits for API calls. If you hit limits:

- **Scheduled workflows**: Limited to 1000 API requests per hour per repository
- **Manual workflows**: Shares same limit

If rate limited:

- Wait for the limit to reset (usually 1 hour)
- Or reduce workflow frequency in `icon-update.yml`

### Notification Issues

If Pushover notifications aren't working:

1. Verify secrets are set correctly:

   ```bash
   gh secret list
   ```

2. Check notification limits:
   - Free tier: 10,000 messages per month
   - Check your usage at https://pushover.net/

3. Test notification manually:
   ```bash
   curl -s \
     --form-string "token=YOUR_TOKEN" \
     --form-string "user=YOUR_USER" \
     --form-string "message=Test notification" \
     https://api.pushover.net/1/messages.json
   ```

---

## Monitoring

### Workflow Status

Check workflow health regularly:

```bash
# List recent runs
gh run list --limit 10

# View specific workflow
gh run list --workflow=icon-update.yml

# Watch workflow in progress
gh run watch <run-id>
```

### Email Notifications

GitHub sends email notifications for workflow failures by default. Configure at:

- Settings → Notifications → GitHub Actions

---

## Customization

### Change Schedule

To change when icon updates are checked, edit `.github/workflows/icon-update.yml`:

```yaml
on:
  schedule:
    # Current: Daily at 2 AM UTC
    - cron: '0 2 * * *'

    # Weekly on Mondays at 2 AM UTC
    # - cron: '0 2 * * 1'

    # Every 6 hours
    # - cron: '0 */6 * * *'
```

### Add More Checks

To add custom validation in icon-update workflow:

```yaml
- name: Custom validation
  if: steps.update.outputs.changed == 'true'
  run: |
    # Your custom checks here
    pnpm run custom-validation
```

---

## Cost Considerations

GitHub Actions minutes:

- **Free tier**: 2,000 minutes/month for private repos
- **Public repos**: Unlimited (this repo)

Current workflows usage estimate:

- CI workflow: ~5 minutes per run
- Icon update workflow: ~10 minutes per run
- Daily icon checks: ~300 minutes per month

**This repo is public, so all workflows are free! ✅**

---

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Pushover API Documentation](https://pushover.net/api)
