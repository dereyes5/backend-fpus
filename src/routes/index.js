const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth.routes');
const rolRoutes = require('./rol.routes');
const benefactorRoutes = require('./benefactor.routes');
const aprobacionRoutes = require('./aprobacion.routes');
const cobrosRoutes = require('./cobros.routes');
const permisosRoutes = require('./permisos.routes');

// Usar rutas
router.use('/auth', authRoutes);
router.use('/roles', rolRoutes);
router.use('/benefactores', benefactorRoutes);
router.use('/aprobaciones', aprobacionRoutes);
router.use('/cobros', cobrosRoutes);
router.use('/permisos', permisosRoutes);

module.exports = router;
