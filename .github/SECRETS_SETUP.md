# GitHub Secrets Setup

This document explains what secrets need to be configured for automated workflows.

## Required Secrets

### PAT_TOKEN (Required for Icon Updates)

A Personal Access Token (PAT) is required for the automated icon update workflow to create pull requests.

#### Why PAT instead of GITHUB_TOKEN?

The default `GITHUB_TOKEN` provided by GitHub Actions has limitations and cannot create pull requests by default. Using a PAT provides more control and consistent behavior.

#### Setup Instructions

1. **Create a Personal Access Token (Classic)**
   - Go to https://github.com/settings/tokens
   - Click **"Generate new token (classic)"**
   - Name: `Icon Update Workflow` (or similar)
   - Expiration: Set according to your preference (90 days recommended)
   - Select scopes:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows) - _optional_

2. **Copy the token**
   - Save it immediately - you won't see it again!

3. **Add to Repository Secrets**
   - Go to your repository on GitHub
   - Navigate to: **Settings → Secrets and variables → Actions**
   - Click **"New repository secret"**
   - Name: `PAT_TOKEN`
   - Value: Paste your token
   - Click **"Add secret"**

4. **Token Maintenance**
   - Remember to renew before expiration
   - You can rotate tokens at any time by generating a new one and updating the secret

---

## Optional Secrets

### Pushover Mobile Notifications

Get notified on your phone when icon updates are available or when they fail.

### 1. Create Pushover Account

1. Go to https://pushover.net/
2. Sign up for a free account (7-day trial, then $5 one-time)
3. Install the Pushover app on your phone (iOS/Android)

### 2. Get Your User Key

1. After logging in, you'll see your **User Key** on the homepage
2. It looks like: `uQiRzpo4DXghDmr9QzzfQu27cmVRsG`
3. Copy this - you'll need it for `PUSHOVER_USER`

### 3. Create an Application

1. Go to https://pushover.net/apps/build
2. Fill in:
   - **Name**: `Google Symbols Plugin` (or whatever you want)
   - **Type**: Application
   - **Description**: Icon update notifications
   - **URL**: `https://github.com/joshjhall/google-symbols-figma-plugin`
   - Upload an icon (optional)
3. Click **Create Application**
4. Copy the **API Token/Key** - you'll need it for `PUSHOVER_TOKEN`
5. It looks like: `azGDORePK8gMaC0QOYAMyEEuzJnyUi`

### 4. Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add both secrets:

   **Secret 1:**
   - Name: `PUSHOVER_TOKEN`
   - Value: `<your-api-token-from-step-3>`

   **Secret 2:**
   - Name: `PUSHOVER_USER`
   - Value: `<your-user-key-from-step-2>`

5. Click **Add secret** for each

### 5. Test It Works

Once configured, you'll receive notifications when:

- ✅ **Success**: Icon update PR created

  ```
  Title: Icon Update Available
  Message: ✅ New Material Icons update ready for review (commit abc1234)
  Link: Direct link to PR
  Priority: Normal
  ```

- ❌ **Failure**: Tests failed
  ```
  Title: Icon Update Failed
  Message: ❌ Icon update for commit abc1234 failed tests
  Link: Direct link to workflow logs
  Priority: High (will bypass quiet hours)
  ```

### 6. Without Pushover (Default)

If you don't add these secrets, the workflow will:

- ✅ Still run normally
- ✅ Still create PRs and Issues
- ℹ️ Print: "Pushover credentials not configured, skipping notification"

No errors, no problems!

---

## Notification Settings

### Free Tier Limits

- 10,000 messages per month
- Should be plenty for this use case (max ~30/month)

### Customization

Edit `.github/workflows/icon-update.yml` to customize:

- Message text (lines 253, 273)
- Priority levels (lines 254, 274)
- Sound alerts (add `--form-string "sound=<sound>"`)

Available sounds: https://pushover.net/api#sounds

### Disable Notifications Temporarily

To temporarily disable without removing secrets:

1. Comment out the notification steps in `.github/workflows/icon-update.yml`:

   ```yaml
   # - name: Notify success via Pushover
   #   if: ...
   ```

2. Or add this to the `if` condition:
   ```yaml
   if: steps.update.outputs.changed == 'true' && false # Disabled
   ```

---

## Other Secrets (Not Needed)

### GITHUB_TOKEN

- ✅ Automatically provided by GitHub Actions
- No setup required
- Used for creating PRs, Issues, and Releases

### GitHub Personal Access Token

- ❌ Not needed for public repositories
- Only needed if you wanted to trigger workflows from within workflows
- Not required for this project

---

## Security Notes

- Secrets are encrypted by GitHub
- Never printed in logs (shown as `***`)
- Only accessible to GitHub Actions workflows
- Can be deleted/rotated at any time
- Pushover tokens can be regenerated at https://pushover.net/

---

## Troubleshooting

### "Pushover credentials not configured"

- This is normal if you haven't set up Pushover
- Not an error - workflow continues normally

### Not receiving notifications

1. Check secrets are named exactly:
   - `PUSHOVER_TOKEN` (not `PUSHOVER_API_TOKEN`)
   - `PUSHOVER_USER` (not `PUSHOVER_USER_KEY`)
2. Verify secrets in: Settings → Secrets → Actions
3. Check Pushover app is installed on your phone
4. Check Pushover account is active
5. Test with: https://pushover.net/apps/client

### Want to test notifications manually?

```bash
curl -s \
  --form-string "token=YOUR_TOKEN" \
  --form-string "user=YOUR_USER" \
  --form-string "message=Test notification from Google Symbols Plugin" \
  https://api.pushover.net/1/messages.json
```

You should receive a notification immediately on your phone.
