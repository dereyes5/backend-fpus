const { body } = require('express-validator');

const createRolDto = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre del rol es requerido')
    .isLength({ min: 3, max: 50 })
    .withMessage('El nombre debe tener entre 3 y 50 caracteres'),
];

const updateRolDto = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre del rol es requerido')
    .isLength({ min: 3, max: 50 })
    .withMessage('El nombre debe tener entre 3 y 50 caracteres'),
];

module.exports = {
  createRolDto,
  updateRolDto,
};
