import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite database locally
const dbPath = path.join(__dirname, 'eyeflow.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    water_config TEXT,
    screen_config TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Authentication Endpoint
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const id = `usr_${Date.now()}`;
    const stmt = db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)');
    stmt.run(id, name || email.split('@')[0], email, password); // Simplified hash for demonstration

    res.json({
      user: { id, name: name || email.split('@')[0], email },
      token: `eyeflow_jwt_${Date.now()}`,
    });
  } catch (err) {
    res.status(400).json({ error: 'User already exists or database error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash = ?').get(email, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token: `eyeflow_jwt_${Date.now()}`,
  });
});

// Settings Sync Endpoints
app.post('/api/sync/settings', (req, res) => {
  const { userId, waterConfig, screenConfig } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  const stmt = db.prepare(`
    INSERT INTO user_settings (user_id, water_config, screen_config, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      water_config=excluded.water_config,
      screen_config=excluded.screen_config,
      updated_at=CURRENT_TIMESTAMP
  `);

  stmt.run(userId, JSON.stringify(waterConfig), JSON.stringify(screenConfig));
  res.json({ success: true, syncedAt: new Date().toISOString() });
});

app.get('/api/sync/settings/:userId', (req, res) => {
  const row: any = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.params.userId);
  if (!row) return res.status(404).json({ error: 'Settings not found' });

  res.json({
    waterConfig: JSON.parse(row.water_config),
    screenConfig: JSON.parse(row.screen_config),
    updatedAt: row.updated_at,
  });
});

app.listen(PORT, () => {
  console.log(`[EyeFlow Sync Server] Running on http://localhost:${PORT}`);
});
