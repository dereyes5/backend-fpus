const express = require('express');
const router = express.Router();
const socialController = require('../controllers/social.controller');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');
const permisosMiddleware = require('../middleware/permisos.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware.verificarToken);

// ==========================================
// VALIDACIONES
// ==========================================

const validarCasoSocial = [
  body('nombre_completo')
    .notEmpty().withMessage('El nombre completo es requerido')
    .isLength({ max: 150 }).withMessage('El nombre no puede exceder 150 caracteres'),
  body('tipo_caso')
    .notEmpty().withMessage('El tipo de caso es requerido')
    .isIn(['Apoyo alimentario', 'Apoyo médico', 'Vivienda', 'Educación', 'Apoyo psicológico', 'Otro'])
    .withMessage('Tipo de caso no válido'),
  body('prioridad')
    .notEmpty().withMessage('La prioridad es requerida')
    .isIn(['Alta', 'Media', 'Baja']).withMessage('Prioridad no válida'),
  body('descripcion_caso')
    .notEmpty().withMessage('La descripción del caso es requerida')
];

const validarSeguimiento = [
  body('id_beneficiario_social')
    .notEmpty().withMessage('El ID del beneficiario social es requerido')
    .isInt().withMessage('El ID debe ser un número entero'),
  body('tipo_evento')
    .notEmpty().withMessage('El tipo de evento es requerido')
    .isIn([
      'Visita domiciliaria',
      'Entrega de apoyo',
      'Llamada telefónica',
      'Coordinación externa',
      'Actualización de caso',
      'Cierre de caso',
      'Otro'
    ]).withMessage('Tipo de evento no válido'),
  body('descripcion')
    .notEmpty().withMessage('La descripción es requerida')
];

// ==========================================
// RUTAS - BENEFICIARIOS SOCIALES
// ==========================================

// Crear caso social
// Requiere permiso de escritura en social
router.post(
  '/beneficiarios',
  permisosMiddleware.verificarPermiso('social', 'escritura'),
  validarCasoSocial,
  socialController.crearCaso
);

// Obtener casos sociales (con filtros)
// Requiere permiso de lectura en social
router.get(
  '/beneficiarios',
  permisosMiddleware.verificarPermiso('social', 'lectura'),
  socialController.obtenerCasos
);

// Obtener caso por ID
router.get(
  '/beneficiarios/:id',
  permisosMiddleware.verificarPermiso('social', 'lectura'),
  socialController.obtenerCasoPorId
);

// Actualizar caso
router.put(
  '/beneficiarios/:id',
  permisosMiddleware.verificarPermiso('social', 'escritura'),
  socialController.actualizarCaso
);

// Cambiar estado del caso
router.put(
  '/beneficiarios/:id/estado',
  permisosMiddleware.verificarPermiso('social', 'escritura'),
  socialController.cambiarEstado
);

// ==========================================
// RUTAS - SEGUIMIENTO
// ==========================================

// Agregar seguimiento (con fotos)
router.post(
  '/seguimiento',
  permisosMiddleware.verificarPermiso('social', 'escritura'),
  // La validación se hace dentro del controller por multer
  socialController.agregarSeguimiento
);

// Obtener seguimiento de un caso
router.get(
  '/seguimiento/:idBeneficiario',
  permisosMiddleware.verificarPermiso('social', 'lectura'),
  socialController.obtenerSeguimiento
);

// Eliminar seguimiento
router.delete(
  '/seguimiento/:id',
  permisosMiddleware.verificarPermiso('social', 'escritura'),
  socialController.eliminarSeguimiento
);

// ==========================================
// RUTAS - ESTADÍSTICAS
// ==========================================

// Obtener estadísticas
router.get(
  '/estadisticas',
  permisosMiddleware.verificarPermiso('social', 'lectura'),
  socialController.obtenerEstadisticas
);

// ==========================================
// RUTAS - APROBACIONES
// ==========================================

// Obtener casos pendientes de aprobación
router.get(
  '/aprobaciones/pendientes',
  permisosMiddleware.verificarPermiso('aprobaciones_social', 'acceso'),
  socialController.obtenerPendientes
);

// Aprobar caso
router.post(
  '/aprobaciones/:id/aprobar',
  permisosMiddleware.verificarPermiso('aprobaciones_social', 'acceso'),
  socialController.aprobarCaso
);

// Rechazar caso
router.post(
  '/aprobaciones/:id/rechazar',
  permisosMiddleware.verificarPermiso('aprobaciones_social', 'acceso'),
  socialController.rechazarCaso
);

module.exports = router;
