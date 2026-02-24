const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth.routes');
const rolRoutes = require('./rol.routes');
const benefactorRoutes = require('./benefactor.routes');
const aprobacionRoutes = require('./aprobacion.routes');
const cobrosRoutes = require('./cobros.routes');
const permisosRoutes = require('./permisos.routes');
const sucursalRoutes = require('./sucursal.routes');
const bancoRoutes = require('./banco.routes');
const socialRoutes = require('./social.routes');
const notificacionesRoutes = require('./notificaciones.routes');

// Usar rutas
router.use('/auth', authRoutes);
router.use('/roles', rolRoutes);
router.use('/benefactores', benefactorRoutes);
router.use('/aprobaciones', aprobacionRoutes);
router.use('/cobros', cobrosRoutes);
router.use('/permisos', permisosRoutes);
router.use('/sucursales', sucursalRoutes);
router.use('/bancos', bancoRoutes);
router.use('/social', socialRoutes);
router.use('/notificaciones', notificacionesRoutes);

module.exports = router;
