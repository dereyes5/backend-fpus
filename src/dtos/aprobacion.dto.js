const { body } = require('express-validator');

const createAprobacionDto = [
  body('id_benefactor')
    .isInt({ min: 1 })
    .withMessage('ID del benefactor es requerido'),
  body('estado_aprobacion')
    .isIn(['APROBADO', 'RECHAZADO'])
    .withMessage('El estado debe ser APROBADO o RECHAZADO'),
  body('comentario')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('El comentario no puede exceder 500 caracteres'),
];

module.exports = {
  createAprobacionDto,
};
