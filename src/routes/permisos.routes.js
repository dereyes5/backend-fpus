const express = require('express');
const router = express.Router();
const permisosController = require('../controllers/permisos.controller');
const { verificarToken } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Obtener recursos disponibles
router.get('/recursos', permisosController.obtenerRecursos);

// Obtener permisos del usuario actual
router.get('/mis-permisos', permisosController.obtenerMisPermisos);

// Obtener todos los permisos (todos los roles)
router.get('/', permisosController.obtenerTodosPermisos);

// Obtener permisos de un rol específico
router.get('/roles/:id', permisosController.obtenerPermisosRol);

// Actualizar permisos de un rol
router.put('/roles/:id', permisosController.actualizarPermisosRol);

module.exports = router;
