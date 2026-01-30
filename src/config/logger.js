const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Definir niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Agregar metadata si existe
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Agregar stack trace si es un error
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Formato para consola con colores
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      const metaStr = JSON.stringify(meta, null, 2);
      if (metaStr !== '{}') {
        log += `\n${metaStr}`;
      }
    }
    
    return log;
  })
);

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../../logs');

// Transport para errores (archivo rotativo diario)
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
});

// Transport para todos los logs (archivo rotativo diario)
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
});

// Transport para consola
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
});

// Crear el logger
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    errorFileTransport,
    combinedFileTransport,
    consoleTransport,
  ],
  exitOnError: false,
});

// Wrapper para logs de peticiones HTTP
logger.logRequest = (req, message = 'Incoming request') => {
  logger.http(message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.usuario?.id_usuario,
    username: req.usuario?.nombre_usuario,
  });
};

// Wrapper para logs de respuestas HTTP
logger.logResponse = (req, res, message = 'Response sent') => {
  logger.http(message, {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    userId: req.usuario?.id_usuario,
  });
};

// Wrapper para logs de errores con contexto
logger.logError = (error, context = {}) => {
  logger.error(error.message || 'Error occurred', {
    error: error.name || 'Error',
    stack: error.stack,
    ...context,
  });
};

// Wrapper para logs de base de datos
logger.logDB = (operation, details = {}) => {
  logger.debug(`DB: ${operation}`, details);
};

// Wrapper para logs de autenticación
logger.logAuth = (action, userId, username, success = true) => {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Auth: ${action}`, {
    userId,
    username,
    success,
  });
};

module.exports = logger;
