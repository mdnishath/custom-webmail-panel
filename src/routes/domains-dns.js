// DNS info route - replaces the old one in domains.js
const fs = require('fs');

function getDkimValue(domainName) {
  try {
    const keyFile = '/etc/opendkim/keys/' + domainName + '/mail.txt';
    const raw = fs.readFileSync(keyFile, 'utf8');
    return raw
      .replace(/mail\._domainkey\s+IN\s+TXT\s+\(\s+/,'')
      .replace(/\s*\)\s*;.*$/s,'')
      .replace(/"/g,'')
      .replace(/\s+/g,'')
      .replace(/\t/g,'');
  } catch(e) {
    return null;
  }
}

module.exports = { getDkimValue };
