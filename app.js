const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDb } = require('./lib/db');

const app = express();

const IS_PROD = process.env.NODE_ENV === 'production';
const AUTH_COOKIE_NAME = 'unievent_auth';
const AUTH_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.SESSION_SECRET || 'dev-only-auth-secret-change-me';

const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const REGISTRATIONS_FILE = path.join(__dirname, 'data', 'registrations.json');

let seedPromise = null;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', 1);
app.use('/data/posters', express.static(path.join(__dirname, 'data', 'posters')));

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function readJsonFile(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return safeJsonParse(raw || JSON.stringify(fallback), fallback);
  } catch (error) {
    return fallback;
  }
}

function sanitizeText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return sanitizeText(value, 160).toLowerCase();
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

function verifyPassword(password, storedPassword) {
  const rawStoredPassword = String(storedPassword || '');
  if (!rawStoredPassword.startsWith('scrypt:')) {
    return rawStoredPassword === String(password);
  }

  const [, salt, storedHash] = rawStoredPassword.split(':');
  if (!salt || !storedHash) return false;

  const derivedKey = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(derivedKey, 'hex'));
  } catch (error) {
    return false;
  }
}

function parseCookies(headerValue) {
  return String(headerValue || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex === -1) return cookies;
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function createSignedToken(payload) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

function verifySignedToken(token) {
  const [payloadBase64, signature] = String(token || '').split('.');
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadBase64).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
  } catch (error) {
    return null;
  }

  const payload = safeJsonParse(Buffer.from(payloadBase64, 'base64url').toString('utf8'), null);
  if (!payload || !payload.uid || !payload.exp || payload.exp <= Date.now()) return null;
  return payload;
}

function setAuthCookie(res, user) {
  const token = createSignedToken({
    uid: String(user._id),
    role: user.role,
    exp: Date.now() + AUTH_MAX_AGE_MS
  });

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: AUTH_MAX_AGE_MS,
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/'
  });
}

function wantsHtml(req) {
  return !req.path.startsWith('/api/');
}

function publicUserShape(user) {
  return {
    id: String(user._id),
    username: user.username || '',
    email: user.email || '',
    role: user.role || '',
    studentId: user.studentId || '',
    department: user.department || ''
  };
}

function normalizeEventList(payload) {
  if (!Array.isArray(payload)) return null;

  return payload.map((event) => ({
    name: sanitizeText(event?.name, 120),
    date: sanitizeText(event?.date, 20),
    time: sanitizeText(event?.time, 40),
    venue: sanitizeText(event?.venue, 120),
    status: event?.status === 'Confirmed' ? 'Confirmed' : 'Planning',
    description: sanitizeText(event?.description, 1200),
    posterImage: typeof event?.posterImage === 'string' ? event.posterImage.slice(0, 2_000_000) : ''
  }));
}

async function seedCollectionIfEmpty(collectionName, docsFactory) {
  const db = await getDb();
  const collection = db.collection(collectionName);
  const existingCount = await collection.estimatedDocumentCount();
  if (existingCount > 0) return;

  const docs = docsFactory();
  if (!docs.length) return;
  await collection.insertMany(docs);
}

async function ensureSeedData() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await seedCollectionIfEmpty('users', () =>
        readJsonFile(USERS_FILE, []).map((user) => ({
          email: normalizeEmail(user.email),
          password: String(user.password || '').startsWith('scrypt:')
            ? String(user.password)
            : createPasswordHash(user.password || ''),
          role: user.role === 'admin' ? 'admin' : 'student',
          username: sanitizeText(user.username, 120),
          studentId: sanitizeText(user.studentId, 40),
          department: sanitizeText(user.department, 120),
          createdAt: new Date()
        }))
      );

      await seedCollectionIfEmpty('events', () =>
        readJsonFile(EVENTS_FILE, []).map((event) => ({
          ...normalizeEventList([event])[0],
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      );

      await seedCollectionIfEmpty('registrations', () =>
        readJsonFile(REGISTRATIONS_FILE, []).map((registration) => ({
          eventId: sanitizeText(registration.eventId, 240),
          eventName: sanitizeText(registration.eventName, 120),
          date: sanitizeText(registration.date, 20),
          time: sanitizeText(registration.time, 40),
          venue: sanitizeText(registration.venue, 120),
          userName: sanitizeText(registration.userName, 120),
          userEmail: normalizeEmail(registration.userEmail),
          studentId: sanitizeText(registration.studentId, 40),
          department: sanitizeText(registration.department, 120),
          registeredAt: registration.registeredAt ? new Date(registration.registeredAt) : new Date()
        }))
      );
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  return seedPromise;
}

async function attachCurrentUser(req, res, next) {
  try {
    await ensureSeedData();

    const cookies = parseCookies(req.headers.cookie);
    const tokenPayload = verifySignedToken(cookies[AUTH_COOKIE_NAME]);

    if (!tokenPayload) {
      req.user = null;
      return next();
    }

    if (!ObjectId.isValid(tokenPayload.uid)) {
      clearAuthCookie(res);
      req.user = null;
      return next();
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(tokenPayload.uid) });

    if (!user) {
      clearAuthCookie(res);
      req.user = null;
      return next();
    }

    req.user = publicUserShape(user);
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (wantsHtml(req)) return res.redirect('/login.html');
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    if (wantsHtml(req)) return res.redirect('/login.html');
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    if (wantsHtml(req)) return res.redirect('/client.html');
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  return next();
}

app.use(attachCurrentUser);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/login.html'));
app.use('/admin', requireAdmin, express.static(path.join(__dirname, 'admin')));

app.post('/api/signup', async (req, res, next) => {
  try {
    const { username, email, password, studentId, department } = req.body || {};

    if (!username || !email || !password || !studentId || !department) {
      return res.status(400).json({ ok: false, error: 'All signup fields are required' });
    }

    const db = await getDb();
    const users = db.collection('users');
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await users.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' });
    }

    const newUser = {
      email: normalizedEmail,
      password: createPasswordHash(password),
      role: 'student',
      username: sanitizeText(username, 120),
      studentId: sanitizeText(studentId, 40),
      department: sanitizeText(department, 120),
      createdAt: new Date()
    };

    const result = await users.insertOne(newUser);
    const createdUser = { ...newUser, _id: result.insertedId };

    setAuthCookie(res, createdUser);
    return res.json({ ok: true, redirectUrl: '/client.html' });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};
    const db = await getDb();
    const normalizedEmail = normalizeEmail(email);
    const user = await db.collection('users').findOne({
      email: normalizedEmail,
      role: role === 'admin' ? 'admin' : 'student'
    });

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, error: 'Invalid email, password, or role!' });
    }

    if (!String(user.password || '').startsWith('scrypt:')) {
      const upgradedPassword = createPasswordHash(password);
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { password: upgradedPassword } }
      );
      user.password = upgradedPassword;
    }

    setAuthCookie(res, user);
    const redirectUrl = user.role === 'admin' ? '/admin/dashboard.html' : '/client.html';
    return res.json({ success: true, redirectUrl });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  return res.json(req.user);
});

app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get('/api/events', async (req, res, next) => {
  try {
    const db = await getDb();
    const events = await db.collection('events').find({}, { sort: { date: 1, name: 1 } }).toArray();
    const safeEvents = events.map(({ _id, ...event }) => ({ ...event }));
    return res.json(safeEvents);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/events', requireAdmin, async (req, res, next) => {
  try {
    const newEvents = normalizeEventList(req.body);
    if (!newEvents) {
      return res.status(400).json({ ok: false, error: 'Events payload must be an array' });
    }

    const db = await getDb();
    const eventsCollection = db.collection('events');
    await eventsCollection.deleteMany({});

    if (newEvents.length) {
      await eventsCollection.insertMany(newEvents.map((event) => ({
        ...event,
        createdAt: new Date(),
        updatedAt: new Date()
      })));
    }

    return res.json({ ok: true, message: 'Data saved successfully' });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/registrations', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const query = req.user.role === 'admin' ? {} : { userEmail: normalizeEmail(req.user.email) };
    const registrations = await db.collection('registrations').find(query, { sort: { registeredAt: -1 } }).toArray();
    const safeRegistrations = registrations.map(({ _id, ...registration }) => ({
      ...registration,
      registeredAt: registration.registeredAt instanceof Date
        ? registration.registeredAt.toISOString()
        : registration.registeredAt
    }));
    return res.json(safeRegistrations);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/registrations', requireAuth, async (req, res, next) => {
  try {
    const {
      eventId,
      eventName,
      date,
      time,
      venue,
      userName,
      userEmail,
      studentId,
      department
    } = req.body || {};

    if (!eventId || !eventName || !date || !time || !venue || !userEmail) {
      return res.status(400).json({ ok: false, error: 'Missing registration fields' });
    }

    const normalizedEmail = normalizeEmail(userEmail);
    if (normalizedEmail !== normalizeEmail(req.user.email)) {
      return res.status(403).json({ ok: false, error: 'You can only register using your own account email' });
    }

    const db = await getDb();
    const registrations = db.collection('registrations');

    const duplicate = await registrations.findOne({ eventId: sanitizeText(eventId, 240), userEmail: normalizedEmail });
    if (duplicate) {
      return res.status(409).json({ ok: false, type: 'duplicate', error: 'Already registered for this event' });
    }

    const clash = await registrations.findOne({
      userEmail: normalizedEmail,
      date: sanitizeText(date, 20),
      time: sanitizeText(time, 40)
    });
    if (clash) {
      return res.status(409).json({
        ok: false,
        type: 'clash',
        error: `Clash detected with ${clash.eventName}`
      });
    }

    const newRegistration = {
      eventId: sanitizeText(eventId, 240),
      eventName: sanitizeText(eventName, 120),
      date: sanitizeText(date, 20),
      time: sanitizeText(time, 40),
      venue: sanitizeText(venue, 120),
      userName: sanitizeText(userName || req.user.username, 120),
      userEmail: normalizedEmail,
      studentId: sanitizeText(studentId || req.user.studentId, 40),
      department: sanitizeText(department || req.user.department, 120),
      registeredAt: new Date()
    };

    await registrations.insertOne(newRegistration);
    return res.json({
      ok: true,
      registration: {
        ...newRegistration,
        registeredAt: newRegistration.registeredAt.toISOString()
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({
    ok: false,
    error: error.message || 'Internal server error'
  });
});

module.exports = app;
