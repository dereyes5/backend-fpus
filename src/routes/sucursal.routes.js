const express = require('express');
const router = express.Router();
const sucursalController = require('../controllers/sucursal.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarErrores } = require('../middleware/validator.middleware');
const { 
  crearSucursalDTO, 
  actualizarSucursalDTO,
  asignarSucursalUsuarioDTO 
} = require('../dtos/sucursal.dto');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Asignar sucursal a usuario (DEBE IR ANTES de la ruta genérica POST /)
router.post('/asignar-usuario', ...asignarSucursalUsuarioDTO, validarErrores, sucursalController.asignarSucursalUsuario);

// Listar todas las sucursales
router.get('/', sucursalController.listarSucursales);

// Crear nueva sucursal
router.post('/', ...crearSucursalDTO, validarErrores, sucursalController.crearSucursal);

// Obtener sucursal por ID
router.get('/:id', sucursalController.obtenerSucursalPorId);

// Obtener usuarios de una sucursal
router.get('/:id/usuarios', sucursalController.obtenerUsuariosSucursal);

// Actualizar sucursal
router.put('/:id', ...actualizarSucursalDTO, validarErrores, sucursalController.actualizarSucursal);

// Eliminar sucursal (soft delete)
router.delete('/:id', sucursalController.eliminarSucursal);

module.exports = router;
