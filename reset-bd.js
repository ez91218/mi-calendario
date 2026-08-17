require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetear() {
    try {
        console.log('Reiniciando tabla de usuarios...');

        // 1. Elimina la tabla usuarios por completo si existe
        await pool.query('DROP TABLE IF EXISTS usuarios CASCADE;');

        // 2. Crea la tabla con la estructura limpia
        await pool.query(`
            CREATE TABLE usuarios (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Genera la contraseña encriptada para '123456'
        const passwordPlana = '123456';
        const hash = await bcrypt.hash(passwordPlana, 10);

        // 4. Inserta el usuario admin
        await pool.query(
            'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)',
            ['admin', hash]
        );

        console.log('✅ ¡Éxito! Tabla limpia. Usuario: admin | Clave: 123456');

    } catch (err) {
        console.error('❌ Error al reiniciar:', err);
    } finally {
        await pool.end();
    }
}

resetear();