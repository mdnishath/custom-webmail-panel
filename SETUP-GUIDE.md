# Mail Server Complete Setup Guide
## Postfix + Dovecot + Roundcube + Custom Admin Panel

---

## Prerequisites

- Ubuntu 22.04/24.04 VPS with root access
- At least 2GB RAM, 20GB disk
- A domain name with DNS access
- Clean VPS (no existing mail server)

---

## Step 1: Upload Files to VPS

```bash
# From your local machine, upload the project to VPS
scp -r vps/* root@YOUR_VPS_IP:/root/mail-server/
```

Or clone/copy the files to `/root/mail-server/` on your VPS.

**Directory structure on VPS should be:**
```
/root/mail-server/
├── scripts/
│   ├── install.sh
│   ├── add-domain.sh
│   └── add-email.sh
├── configs/
│   ├── postfix/
│   ├── dovecot/
│   ├── nginx/
│   ├── roundcube/
│   └── opendkim/
├── database/
│   └── schema.sql
└── panel/
    ├── package.json
    ├── src/
    ├── views/
    └── public/
```

---

## Step 2: Run Installation Script

```bash
ssh root@YOUR_VPS_IP
cd /root/mail-server
chmod +x scripts/*.sh
./scripts/install.sh
```

The script will ask for:
- **Server hostname**: e.g., `mail.yourdomain.com`
- **MySQL root password**: Choose a strong password
- **Mail database password**: Choose a different strong password
- **Admin panel port**: Default 3000 (keep default)

---

## Step 3: DNS Configuration

### For EACH domain you want to use for email:

#### A Records
```
mail.yourdomain.com    A       YOUR_VPS_IP
webmail.yourdomain.com A       YOUR_VPS_IP
admin.yourdomain.com   A       YOUR_VPS_IP
```

#### MX Record
```
yourdomain.com         MX  10  mail.yourdomain.com
```

#### SPF Record (TXT)
```
yourdomain.com         TXT     "v=spf1 mx a ip4:YOUR_VPS_IP ~all"
```

#### DMARC Record (TXT)
```
_dmarc.yourdomain.com  TXT    "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

#### DKIM Record
Generate from Admin Panel (DKIM page) or:
```bash
./scripts/add-domain.sh yourdomain.com
# This will output the DKIM TXT record to add
```

#### Reverse DNS (PTR)
Set at your VPS provider's control panel:
```
YOUR_VPS_IP  ->  mail.yourdomain.com
```

---

## Step 4: SSL Certificates

If certbot didn't run during install:
```bash
certbot --nginx -d mail.yourdomain.com -d webmail.yourdomain.com -d admin.yourdomain.com
```

Auto-renewal is set up automatically.

---

## Step 5: Access Your Services

| Service | URL | Port |
|---------|-----|------|
| **Admin Panel** | https://admin.yourdomain.com | 443 |
| **Webmail** | https://webmail.yourdomain.com | 443 |
| **SMTP** | mail.yourdomain.com | 587 (STARTTLS) / 465 (SSL) |
| **IMAP** | mail.yourdomain.com | 993 (SSL) |
| **POP3** | mail.yourdomain.com | 995 (SSL) |

### First Login to Admin Panel
- Username: `admin`
- Password: Set your password on first login (any password you type becomes the admin password)

---

## Step 6: Add Domains (10 domains)

### Via Admin Panel (Recommended)
1. Go to https://admin.yourdomain.com
2. Click **Domains** > **Add Domain**
3. Enter domain name, set limits
4. View DNS records page for that domain
5. Add DNS records at your domain registrar

### Via Command Line
```bash
./scripts/add-domain.sh domain1.com
./scripts/add-domain.sh domain2.com
./scripts/add-domain.sh domain3.com
# ... repeat for all 10 domains
```

---

## Step 7: Create Email Accounts

### Via Admin Panel
1. Go to **Email Accounts** > **Create Account**
2. Select domain, enter username, password
3. Account is immediately active

### Via Command Line
```bash
./scripts/add-email.sh user@domain1.com "User Name" "StrongPassword123"
```

### Via API
```bash
# Get token
TOKEN=$(curl -s -X POST https://admin.yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-admin-password"}' | jq -r .token)

# Add domain
curl -X POST https://admin.yourdomain.com/api/domains \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"newdomain.com"}'

# Add email
curl -X POST https://admin.yourdomain.com/api/emails \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user","domain_id":1,"password":"pass123","full_name":"User Name"}'
```

---

## Step 8: Client Configuration

### Thunderbird / Outlook / Phone
```
Incoming Mail (IMAP):
  Server:   mail.yourdomain.com
  Port:     993
  Security: SSL/TLS
  Username: user@yourdomain.com

Outgoing Mail (SMTP):
  Server:   mail.yourdomain.com
  Port:     587
  Security: STARTTLS
  Username: user@yourdomain.com
```

---

## Admin Panel Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Overview of domains, accounts, stats |
| **Domain Management** | Add/remove/toggle domains, view DNS records |
| **Email Accounts** | Create/delete accounts, reset passwords, set quotas |
| **Aliases** | Email forwarding rules |
| **DKIM** | Generate/manage DKIM keys per domain |
| **REST API** | Full API for automation |

---

## Troubleshooting

### Check Service Status
```bash
systemctl status postfix
systemctl status dovecot
systemctl status nginx
systemctl status opendkim
systemctl status mail-admin-panel
```

### View Logs
```bash
# Mail logs
tail -f /var/log/mail.log

# Admin panel logs
journalctl -u mail-admin-panel -f

# Nginx logs
tail -f /var/log/nginx/error.log
```

### Test SMTP
```bash
telnet localhost 25
EHLO test
QUIT
```

### Test Email Delivery
```bash
echo "Test email" | mail -s "Test" user@yourdomain.com
```

### Common Issues

1. **Port 25 blocked**: Many VPS providers block port 25. Contact support to unblock it.
2. **Emails going to spam**: Ensure SPF, DKIM, DMARC, and rDNS are all configured.
3. **Cannot login to webmail**: Check Dovecot logs: `journalctl -u dovecot`
4. **SSL errors**: Re-run certbot: `certbot --nginx -d mail.yourdomain.com`

---

## Maintenance

### Backup
```bash
# Database backup
mysqldump -u root -p mailserver > /backup/mailserver_$(date +%Y%m%d).sql

# Mail backup
tar -czf /backup/mail_$(date +%Y%m%d).tar.gz /var/mail/vhosts/
```

### Update SSL
```bash
certbot renew  # Runs automatically via cron
```

### Update Admin Panel
```bash
cd /opt/mail-admin-panel
npm install
systemctl restart mail-admin-panel
```
