const express = require('express');
const router = express.Router();
const bancoController = require('../controllers/banco.controller');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

/**
 * @route   GET /api/bancos
 * @desc    Obtener todos los bancos
 * @access  Privado (cualquier usuario autenticado)
 */
router.get('/', bancoController.getAll);

/**
 * @route   GET /api/bancos/:id
 * @desc    Obtener un banco por ID
 * @access  Privado (cualquier usuario autenticado)
 */
router.get('/:id', bancoController.getById);

/**
 * @route   POST /api/bancos
 * @desc    Crear un nuevo banco
 * @access  Privado (requiere permisos de configuración)
 */
router.post('/', verificarPermiso('configuraciones'), bancoController.create);

/**
 * @route   PUT /api/bancos/:id
 * @desc    Actualizar un banco
 * @access  Privado (requiere permisos de configuración)
 */
router.put('/:id', verificarPermiso('configuraciones'), bancoController.update);

/**
 * @route   DELETE /api/bancos/:id
 * @desc    Eliminar un banco
 * @access  Privado (requiere permisos de configuración)
 */
router.delete('/:id', verificarPermiso('configuraciones'), bancoController.deleteBanco);

module.exports = router;
