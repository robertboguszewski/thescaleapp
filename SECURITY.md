# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in TheScale App, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly with details of the vulnerability
3. Include steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

## Security Considerations

### Data Storage

- **Local storage only**: All user data (profiles, measurements) is stored locally on your device
- **No cloud sync**: Data is not transmitted to external servers
- **BLE keys**: Encryption keys for your scale are stored locally in the application's secure storage

### Xiaomi Cloud Authentication

When using the automatic BLE key extraction feature:

- Your Xiaomi credentials are used only for authentication with Xiaomi servers
- Credentials are **not** stored by this application
- The authentication flow uses QR code login which doesn't expose your password to this application
- Only the BLE encryption key for your scale is retrieved and stored locally

### BLE Communication

- Communication with your scale uses encrypted BLE protocol
- The encryption key is required to decode measurement data
- No measurement data is transmitted to external servers

### Electron Security

This application follows Electron security best practices:

- Context isolation is enabled
- Node integration is disabled in renderer
- Web security is enabled
- Content Security Policy is enforced

## Third-Party Dependencies

We regularly update dependencies to address known vulnerabilities. Run `npm audit` to check for known issues in dependencies.

## Disclaimer

This is an open-source project maintained by the community. While we strive to maintain security, use this software at your own risk. Always keep your operating system and this application up to date.
