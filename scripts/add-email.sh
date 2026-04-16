#!/bin/bash
#============================================================
# Quick Email Account Creation Script
# Usage: ./add-email.sh user@domain.com "Full Name" password
#============================================================

set -euo pipefail

source /root/.mail-server-config 2>/dev/null || { echo "Run install.sh first"; exit 1; }

EMAIL="$1"
FULLNAME="${2:-}"
PASSWORD="$3"

[[ -z "$EMAIL" || -z "$PASSWORD" ]] && { echo "Usage: $0 <user@domain.com> \"Full Name\" <password>"; exit 1; }

DOMAIN=$(echo "$EMAIL" | cut -d@ -f2)
USER=$(echo "$EMAIL" | cut -d@ -f1)

# Hash password (bcrypt)
HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'$PASSWORD', bcrypt.gensalt(12)).decode())" 2>/dev/null || \
       htpasswd -bnBC 12 "" "$PASSWORD" | tr -d ':\n' | sed 's/$2y/$2b/')

# Get domain ID
DOMAIN_ID=$(mysql -u "$MAIL_DB_USER" -p"$MAIL_DB_PASS" "$MAIL_DB_NAME" -sN -e "SELECT id FROM virtual_domains WHERE name='$DOMAIN'")
[[ -z "$DOMAIN_ID" ]] && { echo "Domain $DOMAIN not found. Add it first."; exit 1; }

# Insert user
mysql -u "$MAIL_DB_USER" -p"$MAIL_DB_PASS" "$MAIL_DB_NAME" <<SQL
INSERT INTO virtual_users (domain_id, email, password, full_name)
VALUES ($DOMAIN_ID, '$EMAIL', '$HASH', '$FULLNAME');
SQL

# Create maildir
mkdir -p "/var/mail/vhosts/$DOMAIN/$USER"
chown -R vmail:vmail "/var/mail/vhosts/$DOMAIN/$USER"

echo "Email account created: $EMAIL"
echo "  IMAP: $HOSTNAME:993 (SSL)"
echo "  SMTP: $HOSTNAME:587 (STARTTLS)"
