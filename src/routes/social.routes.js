const express = require('express');
const router = express.Router();
const socialController = require('../controllers/social.controller');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware.verificarToken);

const verificarAccesoSocial = authMiddleware.verificarCualquierPermiso([
  'social_ingresar',
  'social_administrar',
]);

// ==========================================
// VALIDACIONES
// ==========================================

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
  verificarAccesoSocial,
  socialController.crearCaso
);

// Obtener casos sociales (con filtros)
// Requiere permiso de lectura en social
router.get(
  '/beneficiarios',
  verificarAccesoSocial,
  socialController.obtenerCasos
);

// Obtener caso por ID
router.get(
  '/beneficiarios/:id',
  verificarAccesoSocial,
  socialController.obtenerCasoPorId
);

// Actualizar caso
router.put(
  '/beneficiarios/:id',
  verificarAccesoSocial,
  socialController.actualizarCaso
);

// Cambiar estado del caso
router.put(
  '/beneficiarios/:id/estado',
  verificarAccesoSocial,
  socialController.cambiarEstado
);

// ==========================================
// RUTAS - SEGUIMIENTO
// ==========================================

// Agregar seguimiento (con fotos)
router.post(
  '/seguimiento',
  verificarAccesoSocial,
  // La validación se hace dentro del controller por multer
  socialController.agregarSeguimiento
);

// Obtener seguimiento de un caso
router.get(
  '/seguimiento/:idBeneficiario',
  verificarAccesoSocial,
  socialController.obtenerSeguimiento
);

// Eliminar seguimiento
router.delete(
  '/seguimiento/:id',
  verificarAccesoSocial,
  socialController.eliminarSeguimiento
);

// ==========================================
// RUTAS - ESTADÍSTICAS
// ==========================================

// Obtener estadísticas
router.get(
  '/estadisticas',
  verificarAccesoSocial,
  socialController.obtenerEstadisticas
);

// ==========================================
// RUTAS - APROBACIONES
// ==========================================

// Obtener casos pendientes de aprobación
router.get(
  '/aprobaciones/pendientes',
  authMiddleware.verificarPermiso('aprobaciones_social'),
  socialController.obtenerPendientes
);

// Aprobar caso
router.post(
  '/aprobaciones/:id/aprobar',
  authMiddleware.verificarPermiso('aprobaciones_social'),
  socialController.aprobarCaso
);

// Rechazar caso
router.post(
  '/aprobaciones/:id/rechazar',
  authMiddleware.verificarPermiso('aprobaciones_social'),
  socialController.rechazarCaso
);

module.exports = router;
