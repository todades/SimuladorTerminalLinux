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
      approval_status VARCHAR(30) DEFAULT 'approved',
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

  const defaultSections = [
    { name: "Sección 1", trayecto: "Trayecto I" },
    { name: "Sección 2", trayecto: "Trayecto I" },
    { name: "Sección 3", trayecto: "Trayecto I" },
    { name: "Sección 4", trayecto: "Trayecto I" },
    { name: "Sección 1", trayecto: "Trayecto II" },
    { name: "Sección 2", trayecto: "Trayecto II" },
    { name: "Sección 3", trayecto: "Trayecto II" },
    { name: "Sección 4", trayecto: "Trayecto II" },
    { name: "Sección 1", trayecto: "Trayecto III" },
    { name: "Sección 2", trayecto: "Trayecto III" },
    { name: "Sección 3", trayecto: "Trayecto III" },
    { name: "Sección 4", trayecto: "Trayecto III" },
    { name: "Sección 1", trayecto: "Trayecto IV" },
    { name: "Sección 2", trayecto: "Trayecto IV" },
    { name: "Sección 3", trayecto: "Trayecto IV" },
    { name: "Sección 4", trayecto: "Trayecto IV" },
  ];

  for (const sec of defaultSections) {
    const exists = await pool.query(
      "SELECT 1 FROM sections WHERE name = $1 AND trayecto = $2 LIMIT 1",
      [sec.name, sec.trayecto]
    );
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO sections (name, trayecto, period, is_active)
         VALUES ($1, $2, '2026-II', TRUE)`,
        [sec.name, sec.trayecto]
      );
    }
  }

  console.log("Tablas y secciones verificadas en Neon PostgreSQL.");
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/sections", async (req, res) => {
  try {
    const trayecto =
      typeof req.query.trayecto === "string" ? req.query.trayecto.trim() : "";
    const freeOnly = req.query.freeOnly === "true";

    const conditions = ["is_active = TRUE"];
    const params = [];

    if (trayecto) {
      params.push(trayecto);
      conditions.push(`trayecto = $${params.length}`);
    }

    if (freeOnly) {
      conditions.push("teacher_id IS NULL");
    }

    const result = await pool.query(
      `SELECT * FROM sections WHERE ${conditions.join(" AND ")} ORDER BY trayecto ASC, name ASC, id ASC`,
      params
    );

    res.json({ sections: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sections", async (req, res) => {
  try {
    const { name, trayecto, period = "2026-II", teacher_id = null } = req.body;
    if (!name || !trayecto) {
      return res
        .status(400)
        .json({ error: "Los campos name y trayecto son obligatorios" });
    }
    const result = await pool.query(
      `INSERT INTO sections (name, trayecto, period, teacher_id, is_active)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [name.trim(), trayecto.trim(), period, teacher_id]
    );
    res.status(201).json({ section: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const emailNormalized = String(email || "").trim().toLowerCase();
    const cedulaNormalized = String(cedula || "").trim();

    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [emailNormalized]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "El correo ya está registrado" });
    }

    if (cedulaNormalized) {
      const existingCedula = await pool.query(
        "SELECT id FROM users WHERE cedula = $1 LIMIT 1",
        [cedulaNormalized]
      );
      if (existingCedula.rows.length > 0) {
        return res.status(409).json({ error: "La cédula ya está registrada" });
      }
    }

    const approvalStatus = role === "profesor" ? "pending" : "approved";

    const result = await pool.query(
      `INSERT INTO users (full_name, email, cedula, role, trayecto, section_id, approval_status, mascot_name, mascot_gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        full_name,
        emailNormalized,
        cedulaNormalized,
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
    const emailNormalized = String(req.body.email || "").trim().toLowerCase();
    const result = await pool.query(
      `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE LOWER(email) = $1 RETURNING *`,
      [emailNormalized]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/users/:email/approval", async (req, res) => {
  try {
    const email = req.params.email.trim().toLowerCase();
    const { approval_status, trayecto, section_id } = req.body;
    if (!["approved", "rejected", "pending"].includes(approval_status)) {
      return res.status(400).json({ error: "Estado de aprobación inválido" });
    }

    const currentRes = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = $1`,
      [email]
    );
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const currentUser = currentRes.rows[0];
    const nextTrayecto = trayecto ?? currentUser.trayecto;
    const nextSectionId = section_id !== undefined ? section_id : currentUser.section_id;

    const result = await pool.query(
      `UPDATE users
       SET approval_status = $1, trayecto = $2, section_id = $3
       WHERE LOWER(email) = $4
       RETURNING *`,
      [approval_status, nextTrayecto, nextSectionId, email]
    );
    const updatedUser = result.rows[0];

    if (updatedUser.role === "profesor") {
      if (approval_status === "approved" && updatedUser.section_id) {
        await pool.query(
          `UPDATE sections SET teacher_id = $1 WHERE id = $2`,
          [updatedUser.id, updatedUser.section_id]
        );
      } else if (approval_status === "rejected") {
        await pool.query(
          `UPDATE sections SET teacher_id = NULL WHERE teacher_id = $1`,
          [updatedUser.id]
        );
      }
    }

    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:email", async (req, res) => {
  try {
    const email = req.params.email.trim().toLowerCase();
    const existingRes = await pool.query(
      `SELECT id, email FROM users WHERE LOWER(email) = $1`,
      [email]
    );
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const targetUser = existingRes.rows[0];
    await pool.query(
      `UPDATE sections SET teacher_id = NULL WHERE teacher_id = $1`,
      [targetUser.id]
    );

    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, email`,
      [targetUser.id]
    );
    res.json({ deleted: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/progress", async (req, res) => {
  try {
    const {
      user_id,
      completed_steps = [],
      progress_percent = 0,
      current_level = 1,
    } = req.body;

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
      SELECT u.*, s.name AS section_name, p.progress_percent, p.current_level, p.completed_steps, p.updated_at
      FROM users u
      LEFT JOIN sections s ON s.id = u.section_id
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
