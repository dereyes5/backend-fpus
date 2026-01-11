const express = require('express');
const router = express.Router();
const aprobacionController = require('../controllers/aprobacion.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createAprobacionDto } = require('../dtos/aprobacion.dto');

// Todas las rutas de aprobaciones requieren autenticación
router.use(verificarToken);

router.get('/', aprobacionController.obtenerAprobaciones);
router.get('/pendientes', aprobacionController.obtenerRegistrosPendientes);
router.post('/', createAprobacionDto, validarResultado, aprobacionController.aprobarRechazarRegistro);
router.get('/benefactor/:id', aprobacionController.obtenerHistorialAprobaciones);

module.exports = router;
