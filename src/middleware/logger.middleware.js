const logger = require('../config/logger');

/**
 * Middleware para logging de peticiones HTTP
 */
const requestLogger = (req, res, next) => {
  // Log de petición entrante
  logger.logRequest(req);

  // Capturar el tiempo de inicio
  const startTime = Date.now();

  // Hook al evento de finalización de respuesta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(level, 'Response sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.usuario?.id_usuario,
    });
  });

  next();
};

module.exports = requestLogger;
