const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth.routes');
const rolRoutes = require('./rol.routes');
const benefactorRoutes = require('./benefactor.routes');
const aprobacionRoutes = require('./aprobacion.routes');

// Usar rutas
router.use('/auth', authRoutes);
router.use('/roles', rolRoutes);
router.use('/benefactores', benefactorRoutes);
router.use('/aprobaciones', aprobacionRoutes);

module.exports = router;
