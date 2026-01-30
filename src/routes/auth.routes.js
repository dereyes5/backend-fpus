const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createUsuarioDto, loginDto, assignRoleDto, cambiarPasswordDto } = require('../dtos/usuario.dto');

// Rutas públicas
router.post('/login', loginDto, validarResultado, authController.login);
router.post('/usuarios', createUsuarioDto, validarResultado, authController.crearUsuario);

// Rutas protegidas
router.get('/usuarios', verificarToken, authController.listarUsuarios);
router.put('/usuarios/:id_usuario/permisos', verificarToken, authController.asignarPermisos);
router.get('/perfil', verificarToken, authController.obtenerPerfil);
router.put('/cambiar-password', verificarToken, cambiarPasswordDto, validarResultado, authController.cambiarPassword);

module.exports = router;
