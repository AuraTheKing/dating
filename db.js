const fs = require('fs');
const path = require('path');

const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'dating.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database
});

const init = async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

module.exports = {
  dbPromise,
  init
};
