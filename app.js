const path = require('path');

const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');

const { dbPromise, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false
  })
);

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  return next();
};

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

app.get('/register', (req, res) => {
  res.render('register', { error: null, form: {} });
});

app.post('/register', async (req, res) => {
  const { name, email, password, bio } = req.body;

  if (!name || !email || !password || !bio) {
    return res.status(400).render('register', {
      error: 'Please fill out all fields.',
      form: { name, email, bio }
    });
  }

  try {
    const db = await dbPromise;
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', email);

    if (existingUser) {
      return res.status(400).render('register', {
        error: 'That email is already registered.',
        form: { name, email, bio }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      'INSERT INTO users (name, email, password_hash, bio) VALUES (?, ?, ?, ?)',
      name,
      email,
      passwordHash,
      bio
    );

    req.session.userId = result.lastID;
    return res.redirect('/dashboard');
  } catch (error) {
    return res.status(500).render('register', {
      error: 'Unable to create account right now.',
      form: { name, email, bio }
    });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null, form: {} });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render('login', {
      error: 'Email and password are required.',
      form: { email }
    });
  }

  try {
    const db = await dbPromise;
    const user = await db.get('SELECT id, password_hash FROM users WHERE email = ?', email);

    if (!user) {
      return res.status(401).render('login', {
        error: 'Invalid email or password.',
        form: { email }
      });
    }

    const matches = await bcrypt.compare(password, user.password_hash);

    if (!matches) {
      return res.status(401).render('login', {
        error: 'Invalid email or password.',
        form: { email }
      });
    }

    req.session.userId = user.id;
    return res.redirect('/dashboard');
  } catch (error) {
    return res.status(500).render('login', {
      error: 'Unable to log in right now.',
      form: { email }
    });
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const db = await dbPromise;
  const currentUser = await db.get('SELECT id, name, email, bio FROM users WHERE id = ?', req.session.userId);
  const matches = await db.all(
    'SELECT name, bio FROM users WHERE id != ? ORDER BY created_at DESC LIMIT 12',
    req.session.userId
  );

  res.render('dashboard', { currentUser, matches });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/profile', requireAuth, async (req, res) => {
  const db = await dbPromise;
  const currentUser = await db.get('SELECT name, email, bio FROM users WHERE id = ?', req.session.userId);
  res.render('profile', { error: null, form: currentUser });
});

app.post('/profile', requireAuth, async (req, res) => {
  const { name, bio } = req.body;
  if (!name || !bio) {
    return res.status(400).render('profile', {
      error: 'Name and bio are required.',
      form: { name, bio }
    });
  }

  const db = await dbPromise;
  await db.run('UPDATE users SET name = ?, bio = ? WHERE id = ?', name, bio, req.session.userId);
  return res.redirect('/dashboard');
});

init()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Dating app running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error);
    process.exit(1);
  });
