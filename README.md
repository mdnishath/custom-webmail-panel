<p align="center">

```
   ___              _                    _    _      _                 _ _
  / __\   _ ___ ___| |_ ___  _ __ ___  | |  | | ___| |__  _ __ ___  (_) |
 / / | | | / __/ __| __/ _ \| '_ ` _ \ | |  | |/ _ \ '_ \| '_ ` _ \ | | |
/ /__| |_| \__ \__ \ || (_) | | | | | || |/\| |  __/ |_) | | | | | || | |
\____/\__,_|___/___/\__\___/|_| |_| |_||__/\__/\___|_.__/|_| |_| |_|/ |_|
                                                                   |__/
                    ____                  _
                   |  _ \ __ _ _ __   ___| |
                   | |_) / _` | '_ \ / _ \ |
                   |  __/ (_| | | | |  __/ |
                   |_|   \__,_|_| |_|\___|_|
```

</p>

<p align="center">
  <strong>Self-hosted mail server with a modern admin panel and multi-session webmail</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> &bull;
  <a href="#-features">Features</a> &bull;
  <a href="#-architecture">Architecture</a> &bull;
  <a href="#-api-reference">API</a> &bull;
  <a href="#-dns-setup">DNS Setup</a> &bull;
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <!-- Replace with real badges once published -->
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Ubuntu%2022.04%20%7C%2024.04-orange.svg">
  <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
  <img alt="Mail Stack" src="https://img.shields.io/badge/stack-Postfix%20%2B%20Dovecot%20%2B%20Roundcube-informational.svg">
</p>

---

## Why Custom Webmail Panel?

Most mail hosting solutions give you one webmail session per browser. Switch between accounts? You log out, log back in, lose context. **Custom Webmail Panel solves this** with path-based cookie isolation -- a technique that lets you run multiple simultaneous Roundcube sessions in the same browser, each in its own tab, each fully independent.

Combined with one-click auto-login from the admin panel, managing dozens of email accounts across multiple domains becomes effortless.

---

## Key Features

### Multi-Session Webmail (The Star Feature)

> **Log into 10+ email accounts simultaneously in the same browser.** No incognito windows. No browser profiles. Each session lives at its own URL path with isolated cookies.

How it works:
- Each email gets a unique Roundcube instance path: `/m/<hash>/`
- Session cookies are scoped to that path -- no cross-contamination
- One-click auto-login from the admin panel generates a secure token, logs into Roundcube via server-side curl, and forwards the authenticated session cookies to your browser
- Token expires in 120 seconds and is single-use

### Complete Mail Server Stack

| Component | Purpose |
|-----------|---------|
| **Postfix** | SMTP server with virtual domain/user support via MySQL |
| **Dovecot** | IMAP/POP3 with LMTP delivery and SQL auth |
| **Roundcube** | Webmail with multi-session path isolation |
| **MariaDB** | Database for domains, users, aliases, DKIM keys |
| **Nginx** | Reverse proxy with SSL termination |
| **OpenDKIM** | DKIM signing for all outgoing mail |
| **SpamAssassin** | Inbound spam filtering |
| **Let's Encrypt** | Automatic SSL/TLS certificates |

### Admin Panel Features

- **Dashboard** -- Domain/account/alias stats at a glance
- **Domain Management** -- Add domains with auto-generated DKIM keys and DNS record templates
- **Email Accounts** -- Create, search, filter, toggle, reset passwords, set quotas
- **Group Management** -- Organize accounts into groups, bulk copy email lists
- **Email Aliases** -- Forwarding rules per domain
- **DKIM Management** -- View/regenerate DKIM keys, copy DNS records
- **REST API** -- JWT-authenticated API for automation
- **Click-to-Copy** -- Copy any email, DNS record, or credential with one click

---

## Screenshots

> Screenshots coming soon. The admin panel uses Bootstrap 5 with a clean, responsive layout.

| Dashboard | Domain DNS Records | Email Accounts | Multi-Session Webmail |
|:---------:|:-----------------:|:--------------:|:--------------------:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![DNS](docs/screenshots/dns.png) | ![Emails](docs/screenshots/emails.png) | ![Multi-Session](docs/screenshots/multi-session.png) |

---

## Quick Start

### One-Command Deploy

```bash
curl -fsSL https://raw.githubusercontent.com/mdnishath/custom-webmail-panel/main/scripts/install.sh | sudo bash
```

Or clone and run:

```bash
git clone https://github.com/mdnishath/custom-webmail-panel.git
cd custom-webmail-panel
sudo bash scripts/install.sh
```

### Requirements

| Requirement | Minimum |
|------------|---------|
| **OS** | Ubuntu 22.04 or 24.04 |
| **RAM** | 2 GB |
| **Disk** | 20 GB |
| **Access** | Root / sudo |
| **Network** | Port 25 open (check with VPS provider) |
| **Domain** | At least one domain with DNS access |

### What the Installer Does

1. Installs all dependencies (Postfix, Dovecot, MariaDB, Nginx, Roundcube, Node.js, etc.)
2. Prompts for hostname, database passwords, and admin port
3. Configures all services with secure defaults
4. Sets up the database schema
5. Deploys the admin panel as a systemd service
6. Configures firewall rules
7. Obtains SSL certificates via Let's Encrypt
8. Starts everything up

After install, you get:
- **Admin Panel**: `https://admin.yourdomain.com`
- **Webmail**: `https://webmail.yourdomain.com`
- **SMTP**: `mail.yourdomain.com:587`
- **IMAP**: `mail.yourdomain.com:993`

---

## Architecture

```
                                  Internet
                                     |
                              +------+------+
                              |    Nginx    |
                              |  (SSL/TLS)  |
                              +------+------+
                                     |
                 +-------------------+-------------------+
                 |                   |                   |
          +------+------+    +------+------+    +-------+-------+
          | Admin Panel |    |  Roundcube  |    |    Postfix    |
          |  (Node.js)  |    |  (Webmail)  |    |    (SMTP)     |
          |  Port 3000  |    |   (PHP)     |    | Port 25/587   |
          +------+------+    +------+------+    +-------+-------+
                 |                   |                   |
                 |           +-------+-------+    +------+------+
                 |           | Multi-Session |    |   Dovecot   |
                 |           | Cookie Isolat.|    | (IMAP/LMTP) |
                 |           +---------------+    |  Port 993   |
                 |                                +------+------+
                 |                                       |
          +------+------+                        +-------+-------+
          |   MariaDB   |<-----------------------|  Mail Store   |
          |  (Database) |                        | /var/mail/    |
          +------+------+                        +---------------+
                 |
       +---------+---------+
       |         |         |
   Domains    Users    Aliases
```

### Multi-Session Cookie Isolation

```
Browser Tab 1:  /m/a1b2c3d4/  ->  Roundcube session for alice@domain1.com
Browser Tab 2:  /m/e5f6g7h8/  ->  Roundcube session for bob@domain2.com
Browser Tab 3:  /m/i9j0k1l2/  ->  Roundcube session for carol@domain3.com

Each tab has its own:
  - Session cookie (scoped to its path)
  - CSRF token
  - Roundcube state
  - No cross-contamination
```

---

## DNS Setup

For **each domain** you want to use for email, add these DNS records:

### Required Records

```
TYPE    NAME                     VALUE                              TTL
----    ----                     -----                              ---
A       mail.yourdomain.com      YOUR_SERVER_IP                    3600
A       webmail.yourdomain.com   YOUR_SERVER_IP                    3600
A       admin.yourdomain.com     YOUR_SERVER_IP                    3600
MX      yourdomain.com           10 mail.yourdomain.com            3600
TXT     yourdomain.com           "v=spf1 mx a ip4:YOUR_SERVER_IP ~all"   3600
TXT     _dmarc.yourdomain.com    "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"  3600
```

### DKIM Record

Generated automatically when you add a domain. View it in:
- **Admin Panel** > Domains > DNS Records
- **Command line**: `cat /etc/opendkim/keys/yourdomain.com/mail.txt`

```
TYPE    NAME                           VALUE
----    ----                           -----
TXT     mail._domainkey.yourdomain.com  "v=DKIM1; h=sha256; k=rsa; p=MIIBIjAN..."
```

### Reverse DNS (PTR)

Set at your VPS provider's control panel:
```
YOUR_SERVER_IP  ->  mail.yourdomain.com
```

> **Tip**: The admin panel auto-generates all DNS records for each domain with correct values. Just copy and paste into your registrar.

---

## API Reference

All API endpoints require JWT authentication. Get a token first:

### Authentication

```bash
# Get JWT token
curl -X POST https://admin.yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Response: {"token": "eyJhbGci..."}
```

Use the token in subsequent requests:
```
Authorization: Bearer <token>
```

### Domains

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/domains` | List all domains |
| `POST` | `/api/domains` | Add a domain |
| `DELETE` | `/api/domains/:id` | Delete a domain |

**Add Domain:**
```bash
curl -X POST https://admin.yourdomain.com/api/domains \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "newdomain.com", "max_accounts": 50, "max_quota_mb": 5120}'
```

### Email Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/emails` | List all email accounts |
| `POST` | `/api/emails` | Create an email account |
| `DELETE` | `/api/emails/:id` | Delete an email account |

**Create Email:**
```bash
curl -X POST https://admin.yourdomain.com/api/emails \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "domain_id": 1, "password": "SecurePass123!", "full_name": "John Doe"}'
```

### Aliases

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/aliases` | List all aliases |
| `POST` | `/api/aliases` | Create an alias |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Get domain/email/alias counts |

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Admin panel port | `3001` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_NAME` | Database name | `mailserver` |
| `DB_USER` | Database user | `mailuser` |
| `DB_PASS` | Database password | (required) |
| `SESSION_SECRET` | Express session secret | (required, generate with `openssl rand -hex 32`) |
| `JWT_SECRET` | JWT signing secret | (required, generate with `openssl rand -hex 32`) |
| `HOSTNAME` | Mail server hostname | `mail.yourdomain.com` |
| `NODE_ENV` | Environment | `production` |
| `DEFAULT_MAIL_PASS` | Default password for auto-login | (required) |

---

## Project Structure

```
custom-webmail-panel/
|-- configs/
|   |-- dovecot/           # Dovecot IMAP/LMTP configuration
|   |-- opendkim/          # OpenDKIM signing configuration
|   |-- postfix/           # Postfix SMTP + MySQL virtual maps
|   +-- roundcube/         # Roundcube autologin PHP script
|-- database/
|   +-- schema.sql         # Full database schema (domains, users, aliases, DKIM, logs)
|-- scripts/
|   |-- install.sh         # One-command full server installer
|   |-- add-domain.sh      # CLI: add domain with DKIM
|   +-- add-email.sh       # CLI: create email account
|-- src/
|   |-- server.js          # Express app entry point
|   |-- db.js              # MySQL connection pool
|   +-- routes/
|       |-- api.js         # REST API (JWT auth)
|       |-- auth.js        # Admin panel login/logout
|       |-- autologin.js   # One-click webmail auto-login
|       |-- dashboard.js   # Dashboard stats
|       |-- dkim.js        # DKIM key management
|       |-- domains.js     # Domain CRUD + DKIM generation
|       |-- domains-dns.js # DNS record helper
|       |-- emails.js      # Email account management
|       |-- groups.js      # Group management
|       +-- aliases.js     # Email alias/forwarding
|-- views/                 # EJS templates (Bootstrap 5)
|-- .env.example           # Environment variable template
|-- package.json
+-- README.md
```

---

## Email Client Configuration

### For Thunderbird, Outlook, Apple Mail, or any IMAP client:

| Setting | Value |
|---------|-------|
| **Incoming (IMAP)** | `mail.yourdomain.com`, Port `993`, SSL/TLS |
| **Outgoing (SMTP)** | `mail.yourdomain.com`, Port `587`, STARTTLS |
| **Username** | Full email address (e.g., `user@yourdomain.com`) |
| **Password** | Account password |

---

## Troubleshooting

### Service Status

```bash
systemctl status postfix dovecot nginx opendkim mail-admin-panel
```

### Logs

```bash
# Mail delivery
tail -f /var/log/mail.log

# Admin panel
journalctl -u mail-admin-panel -f

# Nginx
tail -f /var/log/nginx/error.log
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port 25 blocked | Contact VPS provider to unblock SMTP |
| Emails go to spam | Verify SPF, DKIM, DMARC, and rDNS are configured |
| Cannot log into webmail | Check Dovecot: `journalctl -u dovecot` |
| SSL certificate errors | Re-run: `certbot --nginx -d mail.yourdomain.com` |
| Admin panel not loading | Check: `systemctl status mail-admin-panel` |

---

## Security

- All passwords hashed with bcrypt (cost factor 12)
- JWT tokens for API authentication (24h expiry)
- Express sessions with secure cookies
- Helmet.js for HTTP security headers
- Rate limiting on API endpoints
- Auto-login tokens expire in 120 seconds and are single-use
- Postfix configured with strict TLS and SASL
- Dovecot SQL auth with BLF-CRYPT password scheme

---

## Backup & Maintenance

### Database Backup

```bash
mysqldump -u root -p mailserver > backup_$(date +%Y%m%d).sql
```

### Mail Backup

```bash
tar -czf mail_backup_$(date +%Y%m%d).tar.gz /var/mail/vhosts/
```

### SSL Renewal

Automatic via certbot cron. Manual: `certbot renew`

### Update Admin Panel

```bash
cd /opt/mail-admin-panel
git pull origin main
npm install --production
systemctl restart mail-admin-panel
```

---

## Comparison with Alternatives

| Feature | Custom Webmail Panel | Mail-in-a-Box | Mailcow | iRedMail |
|---------|:-------------------:|:-------------:|:-------:|:--------:|
| Multi-session webmail | Yes | No | No | No |
| One-click auto-login | Yes | No | No | No |
| Custom admin panel | Yes | Yes | Yes | Yes |
| REST API | Yes | Yes | Yes | Partial |
| DKIM auto-generation | Yes | Yes | Yes | Yes |
| DNS record templates | Yes | Yes | No | No |
| Group management | Yes | No | No | No |
| Resource requirements | Low (2GB RAM) | Medium | High (6GB+) | Medium |
| Docker required | No | No | Yes | No |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Quick version:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes
4. Push to your fork
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with:
- [Postfix](http://www.postfix.org/) -- The battle-tested MTA
- [Dovecot](https://dovecot.org/) -- Secure IMAP/POP3 server
- [Roundcube](https://roundcube.net/) -- Modern webmail client
- [Express.js](https://expressjs.com/) -- Fast Node.js web framework
- [Bootstrap 5](https://getbootstrap.com/) -- Responsive UI framework

---

<p align="center">
  <sub>If this project helped you, consider giving it a star.</sub>
</p>
