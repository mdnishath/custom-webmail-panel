#!/bin/bash
#============================================================
# Quick Domain Addition Script
# Usage: ./add-domain.sh example.com
#============================================================

set -euo pipefail

source /root/.mail-server-config 2>/dev/null || { echo "Run install.sh first"; exit 1; }

DOMAIN="$1"
[[ -z "$DOMAIN" ]] && { echo "Usage: $0 <domain.com>"; exit 1; }

echo "Adding domain: $DOMAIN"

# Add to database
mysql -u "$MAIL_DB_USER" -p"$MAIL_DB_PASS" "$MAIL_DB_NAME" <<SQL
INSERT INTO virtual_domains (name) VALUES ('$DOMAIN')
ON DUPLICATE KEY UPDATE name=name;
SQL

# Create mail directory
mkdir -p "/var/mail/vhosts/$DOMAIN"
chown -R vmail:vmail "/var/mail/vhosts/$DOMAIN"

# Generate DKIM
DKIM_DIR="/etc/opendkim/keys/$DOMAIN"
mkdir -p "$DKIM_DIR"
opendkim-genkey -b 2048 -d "$DOMAIN" -D "$DKIM_DIR" -s mail -v
chown opendkim:opendkim "$DKIM_DIR/mail.private"
chmod 600 "$DKIM_DIR/mail.private"

# Update OpenDKIM tables
echo "mail._domainkey.$DOMAIN $DOMAIN:mail:$DKIM_DIR/mail.private" >> /etc/opendkim/KeyTable
echo "*@$DOMAIN mail._domainkey.$DOMAIN" >> /etc/opendkim/SigningTable
grep -q "$DOMAIN" /etc/opendkim/TrustedHosts || echo "*.$DOMAIN" >> /etc/opendkim/TrustedHosts

# Restart services
systemctl restart opendkim
systemctl restart postfix

echo ""
echo "Domain $DOMAIN added!"
echo ""
echo "DNS Records to add:"
echo "  MX:    $DOMAIN -> 10 $HOSTNAME"
echo "  SPF:   $DOMAIN TXT \"v=spf1 mx a ip4:$(curl -s ifconfig.me) ~all\""
echo "  DMARC: _dmarc.$DOMAIN TXT \"v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN\""
echo "  DKIM:"
cat "$DKIM_DIR/mail.txt"
echo ""
