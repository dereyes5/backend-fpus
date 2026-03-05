const { body } = require('express-validator');

const createUsuarioDto = [
  body('nombre_usuario')
    .trim()
    .notEmpty()
    .withMessage('El nombre de usuario es requerido')
    .isLength({ min: 3, max: 20 })
    .withMessage('El nombre de usuario debe tener entre 3 y 20 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El nombre de usuario solo puede contener letras, numeros y guiones bajos'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contrasena debe tener al menos 6 caracteres')
    .notEmpty()
    .withMessage('La contrasena es requerida'),
  body('cargo')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El cargo debe tener entre 2 y 100 caracteres'),
];

const loginDto = [
  body('nombre_usuario')
    .trim()
    .notEmpty()
    .withMessage('El nombre de usuario es requerido'),
  body('password')
    .notEmpty()
    .withMessage('La contrasena es requerida'),
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
    .withMessage('La contrasena actual es requerida'),
  body('password_nueva')
    .isLength({ min: 6 })
    .withMessage('La contrasena nueva debe tener al menos 6 caracteres')
    .notEmpty()
    .withMessage('La contrasena nueva es requerida'),
];

const actualizarUsuarioAdminDto = [
  body('nombre_usuario')
    .trim()
    .notEmpty()
    .withMessage('El nombre de usuario es requerido')
    .isLength({ min: 3, max: 20 })
    .withMessage('El nombre de usuario debe tener entre 3 y 20 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El nombre de usuario solo puede contener letras, numeros y guiones bajos'),
  body('cargo')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El cargo debe tener entre 2 y 100 caracteres'),
];

const cambiarPasswordAdminDto = [
  body('password_nueva')
    .isLength({ min: 6 })
    .withMessage('La contrasena nueva debe tener al menos 6 caracteres')
    .notEmpty()
    .withMessage('La contrasena nueva es requerida'),
];

const cambiarEstadoUsuarioDto = [
  body('activo')
    .isBoolean()
    .withMessage('El campo activo debe ser booleano'),
];

module.exports = {
  createUsuarioDto,
  loginDto,
  assignRoleDto,
  cambiarPasswordDto,
  actualizarUsuarioAdminDto,
  cambiarPasswordAdminDto,
  cambiarEstadoUsuarioDto,
};
