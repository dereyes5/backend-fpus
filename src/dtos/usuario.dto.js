const { body } = require('express-validator');

const createUsuarioDto = [
  body('nombre_usuario')
    .trim()
    .notEmpty()
    .withMessage('El nombre de usuario es requerido')
    .isLength({ min: 3, max: 20 })
    .withMessage('El nombre de usuario debe tener entre 3 y 20 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
];

const loginDto = [
  body('nombre_usuario')
    .trim()
    .notEmpty()
    .withMessage('El nombre de usuario es requerido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
];

const assignRoleDto = [
  body('id_usuario')
    .isInt({ min: 1 })
    .withMessage('ID de usuario es requerido'),
  body('id_rol')
    .isInt({ min: 1 })
    .withMessage('ID de rol es requerido'),
];

const cambiarPasswordDto = [
  body('password_actual')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('password_nueva')
    .isLength({ min: 6 })
    .withMessage('La contraseña nueva debe tener al menos 6 caracteres')
    .notEmpty()
    .withMessage('La contraseña nueva es requerida'),
];

module.exports = {
  createUsuarioDto,
  loginDto,
  assignRoleDto,
  cambiarPasswordDto,
};
