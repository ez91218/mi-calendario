const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');

const app = express();

// 1. Middlewares para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configurar la conexión a PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. Middlewares de Sesión (DEBE IR ANTES DE CUALQUIER RUTA O SUBIDA DE ARCHIVOS)
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'secretodefault',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 días
}));

// 4. Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// 5. Rutas (AQUÍ ES DONDE USAS req.session)
app.get('/', (req, res) => {
    // Se añade optinal chaining (?.) para evitar que rompa si no existe la sesión
    if (!req.session?.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Resto de tus rutas API (/login, /eventos, etc.)