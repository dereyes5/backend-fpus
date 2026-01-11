const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API de Benefactores - Sistema de Gestión',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      roles: '/api/roles',
      benefactores: '/api/benefactores',
      aprobaciones: '/api/aprobaciones',
    },
  });
});

app.use('/api', routes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   API de Benefactores                     ║
║   Servidor corriendo en puerto ${PORT}      ║
║   http://localhost:${PORT}                  ║
╚═══════════════════════════════════════════╝
  `);
});