const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rol.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createRolDto, updateRolDto } = require('../dtos/rol.dto');

// Todas las rutas de roles requieren autenticación
router.use(verificarToken);

router.get('/', rolController.obtenerRoles);
router.get('/:id', rolController.obtenerRolPorId);
router.post('/', createRolDto, validarResultado, rolController.crearRol);
router.put('/:id', updateRolDto, validarResultado, rolController.actualizarRol);
router.delete('/:id', rolController.eliminarRol);

module.exports = router;
