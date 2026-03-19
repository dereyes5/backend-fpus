const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificaciones.controller');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');
const permisosMiddleware = require('../middleware/permisos.middleware');

// Todas las rutas requieren autenticacion
router.use(authMiddleware.verificarToken);

// ==========================================
// VALIDACIONES
// ==========================================

const validarEnviarNotificacion = [
  body('id_usuario')
    .notEmpty().withMessage('El ID del usuario es requerido')
    .isInt().withMessage('El ID debe ser un numero entero'),
  body('titulo')
    .notEmpty().withMessage('El titulo es requerido')
    .isLength({ max: 255 }).withMessage('El titulo no puede exceder 255 caracteres'),
  body('mensaje')
    .notEmpty().withMessage('El mensaje es requerido'),
];

const validarBroadcast = [
  body('recurso')
    .notEmpty().withMessage('El recurso es requerido'),
  body('permiso')
    .notEmpty().withMessage('El permiso es requerido'),
  body('titulo')
    .notEmpty().withMessage('El titulo es requerido')
    .isLength({ max: 255 }).withMessage('El titulo no puede exceder 255 caracteres'),
  body('mensaje')
    .notEmpty().withMessage('El mensaje es requerido'),
];

// ==========================================
// RUTAS - NOTIFICACIONES DEL USUARIO
// ==========================================

router.get('/', notificacionesController.obtenerNotificaciones);
router.get('/no-leidas', notificacionesController.contarNoLeidas);
router.get('/estadisticas', notificacionesController.obtenerEstadisticas);
router.put('/:id/leer', notificacionesController.marcarComoLeida);
router.put('/leer-todas', notificacionesController.marcarTodasComoLeidas);
router.delete('/:id', notificacionesController.eliminarNotificacion);

// ==========================================
// RUTAS - ADMINISTRACION
// ==========================================

router.post(
  '/cumpleanos/generar',
  permisosMiddleware.verificarPermiso('configuraciones', 'acceso'),
  notificacionesController.generarCumpleanos
);

router.post(
  '/enviar',
  permisosMiddleware.verificarPermiso('configuraciones', 'acceso'),
  validarEnviarNotificacion,
  notificacionesController.enviarNotificacion
);

router.post(
  '/broadcast',
  permisosMiddleware.verificarPermiso('configuraciones', 'acceso'),
  validarBroadcast,
  notificacionesController.enviarBroadcast
);

module.exports = router;
