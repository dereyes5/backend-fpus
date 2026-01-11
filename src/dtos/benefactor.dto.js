const { body } = require('express-validator');

const createBenefactorDto = [
  body('tipo_benefactor')
    .isIn(['TITULAR', 'DEPENDIENTE'])
    .withMessage('El tipo debe ser TITULAR o DEPENDIENTE'),
  body('nombre_completo')
    .trim()
    .notEmpty()
    .withMessage('El nombre completo es requerido')
    .isLength({ max: 150 })
    .withMessage('El nombre no puede exceder 150 caracteres'),
  body('cedula')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('La cédula no puede exceder 20 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .isLength({ max: 120 })
    .withMessage('El email no puede exceder 120 caracteres'),
  body('telefono')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('El teléfono no puede exceder 20 caracteres'),
  body('direccion')
    .optional()
    .trim(),
  body('ciudad')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La ciudad no puede exceder 50 caracteres'),
  body('provincia')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La provincia no puede exceder 50 caracteres'),
  body('fecha_nacimiento')
    .optional()
    .isISO8601()
    .withMessage('Debe ser una fecha válida'),
  body('fecha_suscripcion')
    .optional()
    .isISO8601()
    .withMessage('Debe ser una fecha válida'),
  body('tipo_afiliacion')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('El tipo de afiliación no puede exceder 50 caracteres'),
  body('cuenta')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La cuenta no puede exceder 50 caracteres'),
  body('inscripcion')
    .optional()
    .isDecimal()
    .withMessage('La inscripción debe ser un valor numérico'),
  body('aporte')
    .optional()
    .isDecimal()
    .withMessage('El aporte debe ser un valor numérico'),
  body('estado')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('El estado no puede exceder 20 caracteres'),
];

const updateBenefactorDto = [
  body('tipo_benefactor')
    .optional()
    .isIn(['TITULAR', 'DEPENDIENTE'])
    .withMessage('El tipo debe ser TITULAR o DEPENDIENTE'),
  body('nombre_completo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El nombre completo no puede estar vacío')
    .isLength({ max: 150 })
    .withMessage('El nombre no puede exceder 150 caracteres'),
  body('cedula')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('La cédula no puede exceder 20 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .isLength({ max: 120 })
    .withMessage('El email no puede exceder 120 caracteres'),
  body('telefono')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('El teléfono no puede exceder 20 caracteres'),
  body('direccion')
    .optional()
    .trim(),
  body('ciudad')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La ciudad no puede exceder 50 caracteres'),
  body('provincia')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La provincia no puede exceder 50 caracteres'),
  body('fecha_nacimiento')
    .optional()
    .isISO8601()
    .withMessage('Debe ser una fecha válida'),
  body('inscripcion')
    .optional()
    .isDecimal()
    .withMessage('La inscripción debe ser un valor numérico'),
  body('aporte')
    .optional()
    .isDecimal()
    .withMessage('El aporte debe ser un valor numérico'),
  body('estado')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('El estado no puede exceder 20 caracteres'),
];

const asignarDependienteDto = [
  body('id_titular')
    .isInt({ min: 1 })
    .withMessage('ID del titular es requerido'),
  body('id_dependiente')
    .isInt({ min: 1 })
    .withMessage('ID del dependiente es requerido'),
];

module.exports = {
  createBenefactorDto,
  updateBenefactorDto,
  asignarDependienteDto,
};
