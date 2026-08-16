const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');

const app = express();

// 1. Middlewares para leer datos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Base de datos con SSL habilitado
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. CONFIGURACIÓN DE SESIONES (OBLIGATORIO QUE VAYA AQUÍ, ANTES DE LAS RUTAS)
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'secretodefault',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// 4. Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// 5. RUTAS (Usar el operador ?. para evitar fallos si req.session fuera undefined)
app.get('/', (req, res) => {
    if (!req.session?.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});