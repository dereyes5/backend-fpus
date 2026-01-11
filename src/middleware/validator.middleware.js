const { validationResult } = require('express-validator');

const validarResultado = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errors.array(),
    });
  }
  next();
};

module.exports = { validarResultado };
