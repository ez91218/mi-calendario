require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const app = express();
const PORT = process.env.PORT || 3000;

// Conexión a PostgreSQL en Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());

// Servir la raíz del sitio
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración de Sesiones en PostgreSQL
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'secreto_super_seguro_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
        secure: false // En desarrollo local debe ser false
    }
}));

// Servir la vista de login
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ruta de Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE LOWER(username) = LOWER($1)', [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const usuario = result.rows[0];
        const esValida = await bcrypt.compare(password, usuario.password_hash);

        if (!esValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        req.session.userId = usuario.id;
        req.session.username = usuario.username;

        // Guardar la sesión explícitamente en PostgreSQL antes de responder
        req.session.save((err) => {
            if (err) {
                console.error('Error al guardar la sesión en BD:', err);
                return res.status(500).json({ error: 'Error al guardar la sesión' });
            }
            res.json({ success: true });
        });

    } catch (err) {
        console.error('Error en el proceso de login:', err);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Ruta de Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// Middleware de protección para la aplicación principal
app.use((req, res, next) => {
    if (!req.session.userId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        return res.redirect('/login.html');
    }
    next();
});

// Archivos estáticos protegidos (index.html, app.js, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// RUTAS DE ACTIVIDADES
app.get('/api/actividades', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM actividades ORDER BY fecha ASC');
        const actividades = result.rows.map(row => ({
            id: row.id,
            fecha: row.fecha ? new Date(row.fecha).toISOString().split('T')[0] : '',
            fechaFin: row.fecha_fin ? new Date(row.fecha_fin).toISOString().split('T')[0] : (row.fecha ? new Date(row.fecha).toISOString().split('T')[0] : ''),
            horaInicio: row.hora_inicio || '',
            horaFin: row.hora_fin || '',
            monto: parseFloat(row.monto) || 0,
            descripcion: row.descripcion || ''
        }));
        res.json(actividades);
    } catch (error) {
        console.error('Error al leer actividades:', error);
        res.status(500).json({ error: 'Error al leer datos' });
    }
});

app.post('/api/actividades', async (req, res) => {
    try {
        const id = Date.now().toString();
        const { fecha, fechaFin, horaInicio, horaFin, monto, descripcion } = req.body;

        await pool.query(
            `INSERT INTO actividades (id, fecha, fecha_fin, hora_inicio, hora_fin, monto, descripcion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, fecha, fechaFin || fecha, horaInicio || '', horaFin || '', parseFloat(monto) || 0, descripcion || '']
        );

        res.status(201).json({ id, fecha, fechaFin, horaInicio, horaFin, monto, descripcion });
    } catch (error) {
        console.error('Error al guardar actividad:', error);
        res.status(500).json({ error: 'Error al guardar actividad' });
    }
});

app.delete('/api/actividades/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM actividades WHERE id = $1', [req.params.id]);
        res.json({ mensaje: 'Actividad eliminada' });
    } catch (error) {
        console.error('Error al eliminar actividad:', error);
        res.status(500).json({ error: 'Error al eliminar actividad' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});