require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const emailRoutes = require('./routes/emails');
const aliasRoutes = require('./routes/aliases');
const dkimRoutes = require('./routes/dkim');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');
const autologinRoutes = require('./routes/autologin');
const groupRoutes = require("./routes/groups");

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Pass user to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/domains', requireAuth, domainRoutes);
app.use('/emails', requireAuth, emailRoutes);
app.use('/aliases', requireAuth, aliasRoutes);
app.use('/dkim', requireAuth, dkimRoutes);
app.use('/api', apiRoutes);
app.use('/autologin', autologinRoutes);
app.use("/groups", requireAuth, groupRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/dashboard' : '/auth/login');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Mail Admin Panel running on port ' + PORT);
});
