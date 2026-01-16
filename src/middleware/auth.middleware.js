const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
  try {
    // Intentar obtener token del header Authorization o de query params
    let token = req.headers.authorization?.split(' ')[1];
    
    // Si no está en el header, buscar en query params (para peticiones GET directas)
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al verificar el token',
      error: error.message,
    });
  }
};

module.exports = { verificarToken };
