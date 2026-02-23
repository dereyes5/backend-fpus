/**
 * DTO para validación de datos de bancos
 */

const validarBancoCreacion = (data) => {
  const errores = [];

  // Validar nombre
  if (!data.nombre || typeof data.nombre !== 'string') {
    errores.push('El nombre del banco es requerido');
  } else if (data.nombre.trim().length < 3) {
    errores.push('El nombre del banco debe tener al menos 3 caracteres');
  } else if (data.nombre.length > 100) {
    errores.push('El nombre del banco no puede exceder 100 caracteres');
  }

  return {
    valido: errores.length === 0,
    errores,
    datos: {
      nombre: data.nombre?.trim().toUpperCase()
    }
  };
};

const validarBancoActualizacion = (data) => {
  const errores = [];

  // Validar nombre (opcional en actualización parcial)
  if (data.nombre !== undefined) {
    if (typeof data.nombre !== 'string') {
      errores.push('El nombre del banco debe ser texto');
    } else if (data.nombre.trim().length < 3) {
      errores.push('El nombre del banco debe tener al menos 3 caracteres');
    } else if (data.nombre.length > 100) {
      errores.push('El nombre del banco no puede exceder 100 caracteres');
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    datos: data.nombre ? {
      nombre: data.nombre.trim().toUpperCase()
    } : {}
  };
};

module.exports = {
  validarBancoCreacion,
  validarBancoActualizacion
};
