const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./src/routes');
const logger = require('./src/config/logger');
const requestLogger = require('./src/middleware/logger.middleware');
const { inicializarTareasProgramadas } = require('./src/config/cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: '*',  // Permitir todos los orígenes
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);

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
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.logError(err, {
    method: req.method,
    url: req.originalUrl,
    userId: req.usuario?.id_usuario,
  });
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  logger.info(`API de Benefactores iniciada en puerto ${PORT}`);
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Nivel de log: ${process.env.LOG_LEVEL || 'info'}`);
  console.log(`
╔═══════════════════════════════════════════╗
║   API de Benefactores                     ║
║   Servidor corriendo en puerto ${PORT}      ║
║   http://localhost:${PORT}                  ║
╚═══════════════════════════════════════════╝
  `);
  
  // Inicializar tareas programadas
  inicializarTareasProgramadas();
});