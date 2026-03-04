# Security Policy

## Supported Versions

The following versions of Axiom are currently receiving security updates:

| Version        | Supported          |
| -------------- | ------------------ |
| latest (main)  | ✅ Supported       |
| older releases | ❌ Not supported   |

## Reporting a Vulnerability

We take the security of Axiom seriously. If you believe you have found a security vulnerability,
please report it to us responsibly using one of the following methods.

### Private Vulnerability Reporting (Preferred)

Use GitHub's built-in private vulnerability reporting to submit a report confidentially:

1. Navigate to the [Security tab](https://github.com/techie2000/axiom/security) of this repository
2. Click **"Report a vulnerability"**
3. Fill in the details of the vulnerability and submit

This keeps the details private between you and the maintainers until a fix is available.

### What to Include in Your Report

To help us triage and fix the issue as quickly as possible, please include:

- A clear description of the vulnerability and its potential impact
- The component or area of the codebase affected (e.g., backend API, authentication, database)
- Step-by-step instructions to reproduce the issue
- Any proof-of-concept code or screenshots (where applicable)
- Your suggested severity (Critical, High, Medium, Low)
- Any suggested mitigations or fixes, if you have ideas

### What to Expect

- **Acknowledgement**: We will acknowledge receipt of your report within **5 business days**
- **Initial Assessment**: We will provide an initial assessment within **10 business days**
- **Updates**: We will keep you informed of our progress throughout the investigation
- **Resolution**: We aim to release a fix for validated vulnerabilities as quickly as possible,
  depending on severity and complexity

### Responsible Disclosure

We ask that you:

- **Do not** publicly disclose the vulnerability until we have had a reasonable opportunity to
  investigate and release a fix
- **Do not** access, modify, or delete data belonging to other users
- **Do not** disrupt the availability of the service
- Act in good faith to avoid privacy violations and damage to users

We commit to working with you in good faith and will not pursue legal action against researchers
who report vulnerabilities in accordance with this policy.

## Security Update Process

Axiom uses an automated security update system that runs weekly scans to detect and address
vulnerabilities in dependencies. See
[docs/security/AUTOMATED_UPDATES.md](docs/security/AUTOMATED_UPDATES.md) for details.

For a history of past security updates see the
[Security Documentation](docs/security/README.md).

## Scope

This security policy applies to the Axiom source code hosted in this repository, including:

- Backend Go API (`backend/`)
- Frontend Next.js application (`frontend/`)
- Docker configuration and infrastructure (`docker/`, `docker-compose*.yml`)
- CI/CD workflows (`.github/workflows/`)
- Database migration scripts (`backend/migrations/`)

Third-party dependencies are not in scope for this policy, but please report any known
vulnerabilities in our dependencies so we can update them promptly.

## Contact

For non-security issues, please open a
[GitHub Issue](https://github.com/techie2000/axiom/issues).

For security concerns that do not fit the vulnerability reporting model above, you may reach the
maintainers via the GitHub
[Security Advisories](https://github.com/techie2000/axiom/security/advisories) page.
