# Contributing to Custom Webmail Panel

Thank you for your interest in contributing! This guide will help you get started.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/mdnishath/custom-webmail-panel/issues) to avoid duplicates
2. Open a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Server environment details (OS version, Node version)
   - Relevant log output

### Suggesting Features

Open an issue with the `enhancement` label. Include:
- What problem the feature solves
- Proposed implementation approach (if you have one)
- Any alternatives you considered

### Submitting Code

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/custom-webmail-panel.git
   cd custom-webmail-panel
   ```
3. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** following the code style below
5. **Test** your changes on a test server
6. **Commit** with a clear message:
   ```bash
   git commit -m "Add: brief description of what you added"
   ```
7. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request** against `main`

## Code Style

- **JavaScript**: Use `const`/`let` (no `var`), async/await for database queries
- **SQL**: Use parameterized queries (`?` placeholders) -- never string concatenation
- **Shell scripts**: Use `set -euo pipefail`, quote variables, use `{{PLACEHOLDER}}` for config templates
- **EJS templates**: Follow existing Bootstrap 5 patterns
- **Naming**: camelCase for JS variables/functions, kebab-case for files, UPPER_CASE for env vars

## Project Structure

```
src/
  server.js         - Express app setup and middleware
  db.js             - Database connection pool
  routes/           - Route handlers (one file per feature)
views/              - EJS templates
configs/            - Mail server config templates (Postfix, Dovecot, etc.)
scripts/            - Shell scripts for installation and management
database/           - SQL schema
```

## Development Setup

Since this project manages a full mail server, local development requires:

1. A test VPS (Ubuntu 22.04/24.04) or VM
2. Run the installer on the test environment
3. Make changes to the admin panel code in `/opt/mail-admin-panel/`
4. Restart: `systemctl restart mail-admin-panel`

For frontend-only changes (views/EJS), you can use `npm run dev` with `--watch` for auto-reload.

## Commit Message Convention

Use clear, imperative commit messages:

```
Add: domain bulk import feature
Fix: DKIM key parsing for multi-line records
Update: email list pagination to 50 per page
Remove: deprecated SQLite support
Docs: add API rate limiting documentation
```

## Pull Request Guidelines

- Keep PRs focused -- one feature or fix per PR
- Update documentation if you change behavior
- Add comments for non-obvious logic
- Test on a clean Ubuntu install if your changes affect the installer
- Do not commit `.env` files, credentials, or server-specific data

## Security

If you discover a security vulnerability, please **do not** open a public issue. Instead, email the maintainer directly. Security issues will be addressed promptly.

## Areas Where Help is Needed

- Quota enforcement and usage display
- Mail queue management UI
- Multi-language support for the admin panel
- Docker containerization
- Automated testing
- Improved error handling and validation
- Accessibility improvements

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
