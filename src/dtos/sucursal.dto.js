const { body, param } = require('express-validator');

const crearSucursalDTO = [
  body('iniciales')
    .notEmpty().withMessage('Las iniciales son requeridas')
    .isLength({ min: 2, max: 10 }).withMessage('Las iniciales deben tener entre 2 y 10 caracteres')
    .trim()
    .toUpperCase(),
  body('nombre')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .trim(),
  body('activo')
    .optional()
    .isBoolean().withMessage('Activo debe ser un valor booleano')
];

const actualizarSucursalDTO = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de sucursal inválido'),
  body('iniciales')
    .optional()
    .isLength({ min: 2, max: 10 }).withMessage('Las iniciales deben tener entre 2 y 10 caracteres')
    .trim()
    .toUpperCase(),
  body('nombre')
    .optional()
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .trim(),
  body('activo')
    .optional()
    .isBoolean().withMessage('Activo debe ser un valor booleano')
];

const asignarSucursalUsuarioDTO = [
  body('id_usuario')
    .notEmpty().withMessage('El ID de usuario es requerido')
    .isInt({ min: 1 }).withMessage('ID de usuario inválido'),
  body('id_sucursal')
    .notEmpty().withMessage('El ID de sucursal es requerido')
    .isInt({ min: 1 }).withMessage('ID de sucursal inválido')
];

module.exports = {
  crearSucursalDTO,
  actualizarSucursalDTO,
  asignarSucursalUsuarioDTO
};
