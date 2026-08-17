require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();

// 1. Confianza en proxys (Requerido para HTTPS en Render/Heroku)
app.set('trust proxy', 1);

// 2. Middlewares para procesar JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Conexión a la base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Permite conexiones SSL sin requerir certificado CA local
    }
});

// 4. Configuración de Sesiones en PostgreSQL
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'secretodefault',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Middleware para verificar autenticación en la API
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
    }
    next();
};

// 5. Ruta Raíz Protegida
app.get('/', (req, res) => {
    if (!req.session?.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 6. Archivos Estáticos
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// --- RUTAS DE AUTENTICACIÓN ---

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        req.session.userId = user.id;
        return res.json({ success: true, message: 'Inicio de sesión exitoso' });

    } catch (err) {
        console.error('Error en /api/login:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.clearCookie('connect.sid');
        return res.json({ success: true });
    });
});

// --- RUTAS DE ACTIVIDADES (API) ---

// GET /api/actividades (Obtener actividades del usuario autenticado)
app.get('/api/actividades', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const result = await pool.query(
            `SELECT 
                id, 
                TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, 
                TO_CHAR(fecha_fin, 'YYYY-MM-DD') AS "fechaFin", 
                hora_inicio AS "horaInicio", 
                hora_fin AS "horaFin", 
                monto, 
                descripcion 
             FROM actividades 
             WHERE user_id = $1 
             ORDER BY fecha ASC`,
            [userId]
        );

        // Convertir monto a número flotante
        const actividades = result.rows.map(row => ({
            ...row,
            monto: parseFloat(row.monto)
        }));

        res.json(actividades);
    } catch (err) {
        console.error('Error al obtener actividades:', err);
        res.status(500).json({ error: 'Error al obtener actividades' });
    }
});

// POST /api/actividades (Registrar nueva actividad)
app.post('/api/actividades', requireAuth, async (req, res) => {
    const { fecha, fechaFin, horaInicio, horaFin, monto, descripcion } = req.body;
    const userId = req.session.userId;

    // Convertir cadenas vacías "" a null
    const fFin = fechaFin && fechaFin.trim() !== '' ? fechaFin : fecha;
    const hInicio = horaInicio && horaInicio.trim() !== '' ? horaInicio : null;
    const hFin = horaFin && horaFin.trim() !== '' ? horaFin : null;
    const desc = descripcion && descripcion.trim() !== '' ? descripcion : null;

    try {
        const result = await pool.query(
            `INSERT INTO actividades (user_id, fecha, fecha_fin, hora_inicio, hora_fin, monto, descripcion)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [userId, fecha, fFin, hInicio, hFin, monto, desc]
        );

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error('Error al guardar actividad:', err);
        res.status(500).json({ error: 'Error al guardar la actividad' });
    }
});

// DELETE /api/actividades/:id (Eliminar actividad)
app.delete('/api/actividades/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
        const result = await pool.query(
            'DELETE FROM actividades WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar actividad:', err);
        res.status(500).json({ error: 'Error al eliminar actividad' });
    }
});

// 9. Arrancar el Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});