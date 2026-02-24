const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificaciones.controller');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');
const permisosMiddleware = require('../middleware/permisos.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware.verificarToken);

// ==========================================
// VALIDACIONES
// ==========================================

const validarEnviarNotificacion = [
  body('id_usuario')
    .notEmpty().withMessage('El ID del usuario es requerido')
    .isInt().withMessage('El ID debe ser un número entero'),
  body('titulo')
    .notEmpty().withMessage('El título es requerido')
    .isLength({ max: 255 }).withMessage('El título no puede exceder 255 caracteres'),
  body('mensaje')
    .notEmpty().withMessage('El mensaje es requerido')
];

const validarBroadcast = [
  body('recurso')
    .notEmpty().withMessage('El recurso es requerido'),
  body('permiso')
    .notEmpty().withMessage('El permiso es requerido'),
  body('titulo')
    .notEmpty().withMessage('El título es requerido')
    .isLength({ max: 255 }).withMessage('El título no puede exceder 255 caracteres'),
  body('mensaje')
    .notEmpty().withMessage('El mensaje es requerido')
];

// ==========================================
// RUTAS - NOTIFICACIONES DEL USUARIO
// ==========================================

// Obtener notificaciones del usuario autenticado
// GET /api/notificaciones?no_leidas=true (opcional)
router.get(
  '/',
  notificacionesController.obtenerNotificaciones
);

// Contar notificaciones no leídas
router.get(
  '/no-leidas',
  notificacionesController.contarNoLeidas
);

// Obtener estadísticas de notificaciones
router.get(
  '/estadisticas',
  notificacionesController.obtenerEstadisticas
);

// Marcar notificación como leída
router.put(
  '/:id/leer',
  notificacionesController.marcarComoLeida
);

// Marcar todas las notificaciones como leídas
router.put(
  '/leer-todas',
  notificacionesController.marcarTodasComoLeidas
);

// Eliminar notificación
router.delete(
  '/:id',
  notificacionesController.eliminarNotificacion
);

// ==========================================
// RUTAS - ADMINISTRACIÓN (SOLO ADMINS)
// ==========================================

// Generar notificaciones de cumpleaños manualmente
// Normalmente se ejecuta vía CRON
router.post(
  '/cumpleanos/generar',
  permisosMiddleware.verificarPermiso('configuraciones', 'acceso'),
  notificacionesController.generarCumpleanos
);

// Enviar notificación personalizada a un usuario
router.post(
  '/enviar',
  permisosMiddleware.verificarPermiso('configuraciones', 'acceso'),
  validarEnviarNotificacion,
  notificacionesController.enviarNotificacion
);

// Enviar notificación broadcast por permiso
router.post(
  '/broadcast',
  permisosMiddleware.verificarPermiso('configuraciones', 'acceso'),
  validarBroadcast,
  notificacionesController.enviarBroadcast
);

module.exports = router;
