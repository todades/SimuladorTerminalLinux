import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(
  cors({
    origin: [
      "https://simuladorterminallinux.onrender.com",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      trayecto VARCHAR(50),
      period VARCHAR(50),
      teacher_id INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      cedula VARCHAR(40),
      role VARCHAR(30) DEFAULT 'estudiante',
      trayecto VARCHAR(50),
      section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
      approval_status VARCHAR(30) DEFAULT 'pendiente',
      mascot_name VARCHAR(40) DEFAULT 'Tux',
      mascot_gender VARCHAR(20) DEFAULT 'neutro',
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      completed_steps JSONB DEFAULT '[]'::jsonb,
      progress_percent INTEGER DEFAULT 0,
      current_level INTEGER DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Tablas verificadas en Neon PostgreSQL.");
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      full_name,
      email,
      cedula,
      role = "estudiante",
      trayecto,
      section_id = null,
      mascot_name = "Tux",
      mascot_gender = "neutro",
    } = req.body;

    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "El correo ya está registrado" });
    }

    const approvalStatus = role === "estudiante" ? "aprobado" : "pendiente";

    const result = await pool.query(
      `INSERT INTO users (full_name, email, cedula, role, trayecto, section_id, approval_status, mascot_name, mascot_gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        full_name,
        email,
        cedula,
        role,
        trayecto,
        section_id,
        approvalStatus,
        mascot_name,
        mascot_gender,
      ]
    );

    const user = result.rows[0];
    await pool.query(
      `INSERT INTO user_progress (user_id, completed_steps, progress_percent, current_level)
       VALUES ($1, '[]'::jsonb, 0, 1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE email = $1 RETURNING *`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/progress", async (req, res) => {
  try {
    const { user_id, completed_steps = [], progress_percent = 0, current_level = 1 } =
      req.body;

    const result = await pool.query(
      `INSERT INTO user_progress (user_id, completed_steps, progress_percent, current_level, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         completed_steps = EXCLUDED.completed_steps,
         progress_percent = EXCLUDED.progress_percent,
         current_level = EXCLUDED.current_level,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [user_id, JSON.stringify(completed_steps), progress_percent, current_level]
    );

    res.json({ progress: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, p.progress_percent, p.current_level, p.completed_steps, p.updated_at
      FROM users u
      LEFT JOIN user_progress p ON p.user_id = u.id
      ORDER BY u.id DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error iniciando base de datos:", err);
    process.exit(1);
  });