const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware to handle data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'replace-with-strong-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

// Paths to your JSON "databases"
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// --- 1. SERVE FILES ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// --- 2. API ROUTES ---
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  console.log('--- Login Attempt ---');
  console.log('Email provided:', email);
  console.log('Role selected:', role);

  fs.readFile(USERS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Could not read user database' });
    }

    const users = JSON.parse(data || '[]');
    const user = users.find((u) => u.email === email && u.password === password && u.role === role);

    if (!user) {
      console.log('Result: FAILED - No match found in users.json');
      return res.status(401).json({ success: false, error: 'Invalid email, password, or role!' });
    }

    req.session.user = {
      username: user.username,
      email: user.email,
      role: user.role
    };

    const redirectUrl = user.role === 'admin' ? '/admin/dashboard.html' : '/client.html';
    console.log('Result: SUCCESS - User found:', user.username);
    return res.json({ success: true, redirectUrl });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  return res.json(req.session.user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ ok: false, error: 'Logout failed' });
    return res.json({ ok: true });
  });
});

app.get('/api/events', (req, res) => {
  fs.readFile(EVENTS_FILE, 'utf8', (err, data) => {
    if (err) return res.json([]);
    return res.json(JSON.parse(data || '[]'));
  });
});

app.post('/api/events', (req, res) => {
  const newEvents = req.body;
  fs.writeFile(EVENTS_FILE, JSON.stringify(newEvents, null, 2), (err) => {
    if (err) return res.status(500).send('Error saving data');
    return res.send('Data saved successfully');
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Login Page: http://localhost:${PORT}/login.html`);
});
