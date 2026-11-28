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
