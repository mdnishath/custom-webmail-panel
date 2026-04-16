#!/bin/bash
#============================================================
# Mail Server Installation Script
# Postfix + Dovecot + Roundcube + MariaDB + Nginx + Certbot
# Ubuntu 22.04/24.04
#============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Must run as root
[[ $EUID -ne 0 ]] && error "This script must be run as root (use sudo)"

#------------------------------------------------------------
# Configuration - CHANGE THESE
#------------------------------------------------------------
HOSTNAME=""
MYSQL_ROOT_PASS=""
MAIL_DB_NAME="mailserver"
MAIL_DB_USER="mailuser"
MAIL_DB_PASS=""
ADMIN_PANEL_PORT=3000

echo -e "${CYAN}"
echo "============================================"
echo "  Mail Server Setup - Configuration"
echo "============================================"
echo -e "${NC}"

read -p "Enter server hostname (e.g., mail.yourdomain.com): " HOSTNAME
read -sp "Enter MySQL root password: " MYSQL_ROOT_PASS
echo
read -sp "Enter mail database password: " MAIL_DB_PASS
echo
read -p "Enter admin panel port [3000]: " input_port
ADMIN_PANEL_PORT=${input_port:-3000}

# Save config for later use
cat > /root/.mail-server-config <<EOF
HOSTNAME=$HOSTNAME
MAIL_DB_NAME=$MAIL_DB_NAME
MAIL_DB_USER=$MAIL_DB_USER
MAIL_DB_PASS=$MAIL_DB_PASS
ADMIN_PANEL_PORT=$ADMIN_PANEL_PORT
EOF
chmod 600 /root/.mail-server-config

#------------------------------------------------------------
# Step 1: System Update & Dependencies
#------------------------------------------------------------
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y

log "Installing dependencies..."
apt-get install -y \
    postfix postfix-mysql \
    dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-mysql \
    mariadb-server mariadb-client \
    nginx \
    certbot python3-certbot-nginx \
    php-fpm php-mysql php-xml php-mbstring php-intl php-zip php-curl php-gd php-imagick php-ldap \
    roundcube roundcube-mysql roundcube-plugins \
    opendkim opendkim-tools \
    spamassassin spamc \
    curl wget unzip git \
    nodejs npm

# Ensure Node.js >= 18
NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VER" -lt 18 ]]; then
    log "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

#------------------------------------------------------------
# Step 2: Set Hostname
#------------------------------------------------------------
log "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname "$HOSTNAME"
echo "127.0.0.1 $HOSTNAME" >> /etc/hosts

#------------------------------------------------------------
# Step 3: MariaDB Setup
#------------------------------------------------------------
log "Configuring MariaDB..."
systemctl start mariadb
systemctl enable mariadb

# Secure installation
mysql -u root <<MYSQL_SCRIPT
ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASS}';
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
MYSQL_SCRIPT

# Create mail database and user
mysql -u root -p"${MYSQL_ROOT_PASS}" <<MYSQL_SCRIPT
CREATE DATABASE IF NOT EXISTS ${MAIL_DB_NAME};
CREATE USER IF NOT EXISTS '${MAIL_DB_USER}'@'localhost' IDENTIFIED BY '${MAIL_DB_PASS}';
GRANT ALL PRIVILEGES ON ${MAIL_DB_NAME}.* TO '${MAIL_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_SCRIPT

# Import schema
log "Importing database schema..."
mysql -u root -p"${MYSQL_ROOT_PASS}" ${MAIL_DB_NAME} < /root/mail-server/database/schema.sql

#------------------------------------------------------------
# Step 4: Create vmail user
#------------------------------------------------------------
log "Creating vmail user..."
groupadd -g 5000 vmail 2>/dev/null || true
useradd -g vmail -u 5000 -d /var/mail/vhosts -s /usr/sbin/nologin -m vmail 2>/dev/null || true
mkdir -p /var/mail/vhosts
chown -R vmail:vmail /var/mail/vhosts
chmod 770 /var/mail/vhosts

#------------------------------------------------------------
# Step 5: Postfix Configuration
#------------------------------------------------------------
log "Configuring Postfix..."
cp /root/mail-server/configs/postfix/main.cf /etc/postfix/main.cf
cp /root/mail-server/configs/postfix/master.cf /etc/postfix/master.cf
cp /root/mail-server/configs/postfix/mysql-virtual-mailbox-domains.cf /etc/postfix/mysql-virtual-mailbox-domains.cf
cp /root/mail-server/configs/postfix/mysql-virtual-mailbox-maps.cf /etc/postfix/mysql-virtual-mailbox-maps.cf
cp /root/mail-server/configs/postfix/mysql-virtual-alias-maps.cf /etc/postfix/mysql-virtual-alias-maps.cf

# Replace placeholders
sed -i "s/{{HOSTNAME}}/${HOSTNAME}/g" /etc/postfix/main.cf
sed -i "s/{{MAIL_DB_NAME}}/${MAIL_DB_NAME}/g" /etc/postfix/mysql-virtual-*.cf
sed -i "s/{{MAIL_DB_USER}}/${MAIL_DB_USER}/g" /etc/postfix/mysql-virtual-*.cf
sed -i "s/{{MAIL_DB_PASS}}/${MAIL_DB_PASS}/g" /etc/postfix/mysql-virtual-*.cf

chmod 640 /etc/postfix/mysql-virtual-*.cf
chown root:postfix /etc/postfix/mysql-virtual-*.cf

#------------------------------------------------------------
# Step 6: Dovecot Configuration
#------------------------------------------------------------
log "Configuring Dovecot..."
cp /root/mail-server/configs/dovecot/dovecot.conf /etc/dovecot/dovecot.conf
cp /root/mail-server/configs/dovecot/10-auth.conf /etc/dovecot/conf.d/10-auth.conf
cp /root/mail-server/configs/dovecot/10-mail.conf /etc/dovecot/conf.d/10-mail.conf
cp /root/mail-server/configs/dovecot/10-master.conf /etc/dovecot/conf.d/10-master.conf
cp /root/mail-server/configs/dovecot/10-ssl.conf /etc/dovecot/conf.d/10-ssl.conf
cp /root/mail-server/configs/dovecot/auth-sql.conf.ext /etc/dovecot/conf.d/auth-sql.conf.ext
cp /root/mail-server/configs/dovecot/dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext

sed -i "s/{{HOSTNAME}}/${HOSTNAME}/g" /etc/dovecot/conf.d/10-ssl.conf
sed -i "s/{{MAIL_DB_NAME}}/${MAIL_DB_NAME}/g" /etc/dovecot/dovecot-sql.conf.ext
sed -i "s/{{MAIL_DB_USER}}/${MAIL_DB_USER}/g" /etc/dovecot/dovecot-sql.conf.ext
sed -i "s/{{MAIL_DB_PASS}}/${MAIL_DB_PASS}/g" /etc/dovecot/dovecot-sql.conf.ext

chown -R vmail:dovecot /etc/dovecot
chmod -R o-rwx /etc/dovecot

#------------------------------------------------------------
# Step 7: OpenDKIM
#------------------------------------------------------------
log "Configuring OpenDKIM..."
mkdir -p /etc/opendkim/keys
cp /root/mail-server/configs/opendkim/opendkim.conf /etc/opendkim.conf

cat > /etc/opendkim/TrustedHosts <<EOF
127.0.0.1
localhost
EOF

cat > /etc/opendkim/SigningTable <<EOF
# Will be populated per domain
EOF

cat > /etc/opendkim/KeyTable <<EOF
# Will be populated per domain
EOF

chown -R opendkim:opendkim /etc/opendkim
mkdir -p /var/spool/postfix/opendkim
chown opendkim:postfix /var/spool/postfix/opendkim

# Add postfix to opendkim group
usermod -aG opendkim postfix

#------------------------------------------------------------
# Step 8: SpamAssassin
#------------------------------------------------------------
log "Configuring SpamAssassin..."
systemctl enable spamassassin
systemctl start spamassassin
sa-update || true

#------------------------------------------------------------
# Step 9: Nginx + Roundcube
#------------------------------------------------------------
log "Configuring Nginx for Roundcube..."
cp /root/mail-server/configs/nginx/roundcube.conf /etc/nginx/sites-available/roundcube
ln -sf /etc/nginx/sites-available/roundcube /etc/nginx/sites-enabled/roundcube
rm -f /etc/nginx/sites-enabled/default

# Roundcube config
cp /root/mail-server/configs/roundcube/config.inc.php /etc/roundcube/config.inc.php
sed -i "s/{{MAIL_DB_NAME}}/${MAIL_DB_NAME}/g" /etc/roundcube/config.inc.php
sed -i "s/{{MAIL_DB_USER}}/${MAIL_DB_USER}/g" /etc/roundcube/config.inc.php
sed -i "s/{{MAIL_DB_PASS}}/${MAIL_DB_PASS}/g" /etc/roundcube/config.inc.php
sed -i "s/{{HOSTNAME}}/${HOSTNAME}/g" /etc/roundcube/config.inc.php

# Admin panel nginx config
cp /root/mail-server/configs/nginx/admin-panel.conf /etc/nginx/sites-available/admin-panel
ln -sf /etc/nginx/sites-available/admin-panel /etc/nginx/sites-enabled/admin-panel
sed -i "s/{{HOSTNAME}}/${HOSTNAME}/g" /etc/nginx/sites-available/admin-panel
sed -i "s/{{ADMIN_PANEL_PORT}}/${ADMIN_PANEL_PORT}/g" /etc/nginx/sites-available/admin-panel

nginx -t && systemctl restart nginx

#------------------------------------------------------------
# Step 10: SSL Certificates
#------------------------------------------------------------
log "Obtaining SSL certificates..."
DOMAIN_BASE=$(echo "$HOSTNAME" | sed 's/^mail\.//')
certbot --nginx -d "$HOSTNAME" -d "webmail.$DOMAIN_BASE" -d "admin.$DOMAIN_BASE" --non-interactive --agree-tos --email "admin@$DOMAIN_BASE" || {
    warn "Certbot failed. You can run it manually later:"
    warn "certbot --nginx -d $HOSTNAME -d webmail.$DOMAIN_BASE -d admin.$DOMAIN_BASE"
}

#------------------------------------------------------------
# Step 11: Install Admin Panel
#------------------------------------------------------------
log "Installing Admin Panel..."
mkdir -p /opt/mail-admin-panel
cp -r /root/mail-server/panel/* /opt/mail-admin-panel/
cd /opt/mail-admin-panel

# Create .env file
cat > /opt/mail-admin-panel/.env <<EOF
PORT=${ADMIN_PANEL_PORT}
DB_HOST=localhost
DB_NAME=${MAIL_DB_NAME}
DB_USER=${MAIL_DB_USER}
DB_PASS=${MAIL_DB_PASS}
SESSION_SECRET=$(openssl rand -hex 32)
HOSTNAME=${HOSTNAME}
JWT_SECRET=$(openssl rand -hex 32)
EOF

npm install --production

# Create systemd service for admin panel
cat > /etc/systemd/system/mail-admin-panel.service <<EOF
[Unit]
Description=Mail Server Admin Panel
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mail-admin-panel
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mail-admin-panel
systemctl start mail-admin-panel

#------------------------------------------------------------
# Step 12: Firewall
#------------------------------------------------------------
log "Configuring firewall..."
ufw allow 25/tcp    # SMTP
ufw allow 465/tcp   # SMTPS
ufw allow 587/tcp   # Submission
ufw allow 143/tcp   # IMAP
ufw allow 993/tcp   # IMAPS
ufw allow 110/tcp   # POP3
ufw allow 995/tcp   # POP3S
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH
ufw --force enable

#------------------------------------------------------------
# Step 13: Start Services
#------------------------------------------------------------
log "Starting all services..."
systemctl restart postfix
systemctl restart dovecot
systemctl restart opendkim
systemctl restart nginx
systemctl enable postfix dovecot opendkim nginx

#------------------------------------------------------------
# Done!
#------------------------------------------------------------
echo -e "${CYAN}"
echo "============================================"
echo "  Mail Server Installation Complete!"
echo "============================================"
echo -e "${NC}"
echo ""
echo -e "  Webmail:      https://webmail.$(echo $HOSTNAME | sed 's/^mail\.//')"
echo -e "  Admin Panel:  https://admin.$(echo $HOSTNAME | sed 's/^mail\.//')"
echo -e "  SMTP Server:  $HOSTNAME:587"
echo -e "  IMAP Server:  $HOSTNAME:993"
echo -e ""
echo -e "  Default Admin Login:"
echo -e "    Username: admin"
echo -e "    Password: (set during first login)"
echo -e ""
echo -e "${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo -e "  1. Set DNS records (MX, SPF, DKIM, DMARC) - see guide"
echo -e "  2. Add domains via admin panel"
echo -e "  3. Create email accounts"
echo -e "  4. Test sending/receiving"
echo ""
