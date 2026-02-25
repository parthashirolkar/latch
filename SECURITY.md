# Security Considerations

This document outlines known security considerations and best practices for using Latch Password Manager.

## OAuth Client Secret Exposure (Desktop Applications)

### Issue
The Google OAuth client secret is bundled into the desktop application JavaScript when using the `tauri-plugin-google-auth` plugin. This is a **known limitation** of desktop OAuth flows and affects all Tauri applications using this plugin.

### Impact
An attacker who extracts the client secret from the bundled application could:
- Make unauthorized OAuth requests to Google
- Potentially impersonate your application

### Mitigation Strategies

1. **Separate Development and Production Credentials**
   - Create one OAuth client for development (test credentials)
   - Create a separate OAuth client for production
   - Never share production credentials in code repositories or documentation

2. **Monitor Usage**
   - Regularly check Google Cloud Console for unusual OAuth activity
   - Set up alerts for unauthorized usage
   - Rotate credentials immediately if compromise is suspected

3. **Restrict OAuth Client**
   - Configure authorized redirect URIs in Google Cloud Console
   - Use application restrictions where possible
   - Consider using Google's OAuth client verification for production

4. **Alternative Authentication Methods**
   - Consider using **Biometric Authentication** (Windows Hello, Touch ID, etc.)
   - Biometric auth doesn't expose any secrets in the application bundle
   - The encryption key is stored in the OS keychain

5. **Secret Management**
   - Never commit `.env` files to version control
   - Use environment-specific configuration files
   - Rotate credentials periodically

## LATCH_OAUTH_SECRET Requirements

The `LATCH_OAUTH_SECRET` environment variable is used to derive encryption keys for OAuth-based vaults.

### Requirements
- **Minimum length: 32 bytes** (enforced at compile time)
- Should be cryptographically random
- Use different secrets for development, staging, and production

### Generation
```bash
# Generate a secure 32-byte secret (hex encoded)
openssl rand -hex 32

# Or generate a base64 encoded secret
openssl rand -base64 32
```

### Protection
- Never commit this secret to version control
- Store it securely in CI/CD secrets (e.g., GitHub Secrets)
- Rotate if accidentally exposed

## Password-Based Authentication

### Strength
- Uses PBKDF2-HMAC-SHA256 with 100,000 iterations
- 32-byte random salt per vault
- AES-256-GCM encryption for vault data

### Best Practices
- Use strong, unique passwords (12+ characters)
- Enable password strength checking
- Consider using a password manager for your master password

## Biometric Authentication

### Security
- Encryption key stored in OS keychain (Windows Credential Manager, macOS Keychain)
- Key never leaves the secure storage
- Biometric data is handled by the OS, not stored by Latch

### Requirements
- Biometric hardware (fingerprint reader, Face ID, Windows Hello)
- OS support for biometric authentication

## Vault Encryption

### Algorithm
- **Encryption:** AES-256-GCM (authenticated encryption)
- **Key Derivation:**
  - Password-based: PBKDF2-HMAC-SHA256 (100,000 iterations)
  - OAuth-based: Argon2id (memory-hard KDF)
  - Biometric: OS keychain storage

### Data Protection
- All vault entries encrypted at rest
- No plaintext storage of passwords
- Automatic session timeout after 30 minutes

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **Do not** open a public issue
2. Email security details to: [security contact email]
3. Include steps to reproduce and impact assessment
4. Allow time for the issue to be fixed before disclosure

## Security Audits

This project has not undergone a formal security audit. Users should:
- Review the code for security considerations
- Use it for low-risk scenarios initially
- Consider implementing additional security measures for sensitive data

## Best Practices for Users

1. **Backup Strategy**
   - Keep secure backups of your vault
   - Test restore procedures
   - No built-in recovery mechanism (by design)

2. **Password Hygiene**
   - Use unique, strong passwords for each service
   - Enable two-factor authentication where available
   - Regularly audit and update compromised passwords

3. **System Security**
   - Keep your operating system updated
   - Use antivirus/anti-malware software
   - Avoid running on untrusted systems

4. **Session Management**
   - Lock your vault when not in use
   - Auto-lock after 30 minutes of inactivity
   - Clear clipboard after copying passwords

## Version History

### v0.1.3
- Fixed: Missing `init_vault` and `unlock_vault` commands for password-based auth
- Fixed: Missing `migrate_to_oauth` command for vault migration
- Fixed: Weak CI test secret replaced with GitHub Secret
- Fixed: Added compile-time validation for LATCH_OAUTH_SECRET minimum length
- Documented: OAuth client secret exposure in desktop applications
