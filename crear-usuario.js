require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const inicializarBD = async () => {
    try {
        console.log('Reconfigurando la base de datos en Render...');

        // 1. Recrear tabla de actividades para limpiar incompatibilidades previas
        await pool.query(`
            DROP TABLE IF EXISTS actividades CASCADE;

            CREATE TABLE actividades (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                fecha DATE NOT NULL,
                fecha_fin DATE,
                hora_inicio TIME,
                hora_fin TIME,
                monto NUMERIC(10, 2) NOT NULL,
                descripcion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL PRIMARY KEY,
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
        `);

        // 2. Crear / Actualizar usuario admin
        const usuario = 'admin';
        const passwordPlana = '123456';
        const hash = await bcrypt.hash(passwordPlana, 12);

        await pool.query(`
            INSERT INTO usuarios (username, password_hash) 
            VALUES ($1, $2) 
            ON CONFLICT (username) 
            DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [usuario, hash]);

        console.log('✅ Base de datos reseteada con éxito y usuario admin listo.');

    } catch (err) {
        console.error('❌ Error al inicializar la base de datos:', err);
    } finally {
        await pool.end();
    }
};

inicializarBD();