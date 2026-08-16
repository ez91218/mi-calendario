require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const inicializarBD = async () => {
    try {
        console.log('Conectando a la base de datos en Render...');

        // 1. Crear las tablas si no existen
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS actividades (
                id VARCHAR(50) PRIMARY KEY,
                fecha DATE NOT NULL,
                fecha_fin DATE,
                hora_inicio VARCHAR(10),
                hora_fin VARCHAR(10),
                monto NUMERIC(10, 2) NOT NULL,
                descripcion TEXT
            );

            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL PRIMARY KEY,
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
        `);
        console.log('✅ Tablas creadas/verificadas con éxito.');

        // 2. Definir usuario y la nueva contraseña de prueba
        const usuario = 'admin';
        const passwordPlana = '123456';

        const hash = await bcrypt.hash(passwordPlana, 12);

        // Inserta o actualiza la contraseña si el usuario ya existe
        await pool.query(`
            INSERT INTO usuarios (username, password_hash) 
            VALUES ($1, $2) 
            ON CONFLICT (username) 
            DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [usuario, hash]);

        console.log('✅ Contraseña actualizada a 123456 con éxito.');

    } catch (err) {
        console.error('❌ Error al inicializar la base de datos:', err);
    } finally {
        await pool.end();
    }
};

inicializarBD();