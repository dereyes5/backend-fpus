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

// Listar todas las sucursales
router.get('/', sucursalController.listarSucursales);

// Obtener sucursal por ID
router.get('/:id', sucursalController.obtenerSucursalPorId);

// Obtener usuarios de una sucursal
router.get('/:id/usuarios', sucursalController.obtenerUsuariosSucursal);

// Crear nueva sucursal
router.post('/', crearSucursalDTO, validarErrores, sucursalController.crearSucursal);

// Actualizar sucursal
router.put('/:id', actualizarSucursalDTO, validarErrores, sucursalController.actualizarSucursal);

// Eliminar sucursal (soft delete)
router.delete('/:id', sucursalController.eliminarSucursal);

// Asignar sucursal a usuario
router.post('/asignar-usuario', asignarSucursalUsuarioDTO, validarErrores, sucursalController.asignarSucursalUsuario);

module.exports = router;
