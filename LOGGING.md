# Sistema de Logging

Este backend utiliza **Winston** para logging estructurado y rotativo.

## Características

- ✅ **Logs rotativos diarios**: Archivos de log por día con retención configurable
- ✅ **Múltiples niveles**: error, warn, info, http, debug
- ✅ **Logs separados**: Errores en archivo dedicado
- ✅ **Formato estructurado**: JSON con timestamps y metadata
- ✅ **Logs de HTTP**: Todas las peticiones con duración y status code
- ✅ **Logs de autenticación**: Login exitoso/fallido, permisos
- ✅ **Logs de base de datos**: Queries y operaciones

## Archivos de Log

Los logs se guardan en `backend/logs/`:

- `error-YYYY-MM-DD.log` - Solo errores (retención: 30 días)
- `combined-YYYY-MM-DD.log` - Todos los logs (retención: 14 días)
- Máximo 20MB por archivo antes de rotar

## Niveles de Log

```javascript
error: 0   // Errores críticos
warn: 1    // Advertencias (login fallido, permisos denegados)
info: 2    // Información general (login exitoso, operaciones importantes)
http: 3    // Peticiones HTTP
debug: 4   // Información detallada de debugging
```

## Configuración

Variable de entorno `LOG_LEVEL` controla el nivel mínimo:

```bash
# .env
LOG_LEVEL=info  # production (default)
LOG_LEVEL=debug # development
LOG_LEVEL=error # solo errores críticos
```

## Uso en Código

```javascript
const logger = require('../config/logger');

// Logs básicos
logger.info('Operation completed successfully');
logger.warn('User attempted unauthorized action');
logger.error('Database connection failed');

// Logs con contexto
logger.info('User logged in', {
  userId: 123,
  username: 'admin',
  ip: '192.168.1.1'
});

// Logs especializados
logger.logAuth('login', userId, username, true);
logger.logDB('SELECT', { table: 'benefactores', rows: 100 });
logger.logError(error, { userId, action: 'createBenefactor' });

// Logs de peticiones HTTP (automático en middleware)
logger.logRequest(req);
logger.logResponse(req, res);
```

## Ejemplos de Logs

### Login exitoso
```
2026-01-30 14:23:45 [INFO]: Login attempt {"username":"admin","ip":"::1"}
2026-01-30 14:23:45 [DEBUG]: Fetching user permissions {"userId":1}
2026-01-30 14:23:45 [INFO]: Login successful {"userId":1,"username":"admin","ip":"::1","hasPermissions":true}
```

### Permiso denegado
```
2026-01-30 14:25:10 [WARN]: Permission denied {"userId":2,"username":"ejecutivo","requiredPermission":"configuraciones","userPermissions":["benefactores_lectura","benefactores_escritura"]}
```

### Petición HTTP
```
2026-01-30 14:26:30 [HTTP]: Incoming request {"method":"GET","url":"/api/benefactores","ip":"::1","userId":1}
2026-01-30 14:26:31 [HTTP]: Response sent {"method":"GET","url":"/api/benefactores","statusCode":200,"duration":"127ms","userId":1}
```

### Error
```
2026-01-30 14:27:15 [ERROR]: Database query failed {"error":"QueryError","userId":1,"action":"obtenerBenefactores"}
Error: relation "benefactores_old" does not exist
    at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:287:98)
    ...
```

## Monitoreo en Producción

### Ver logs en tiempo real
```bash
# Todos los logs
tail -f logs/combined-2026-01-30.log

# Solo errores
tail -f logs/error-2026-01-30.log

# Filtrar por nivel
tail -f logs/combined-2026-01-30.log | grep "ERROR"

# Filtrar por usuario
tail -f logs/combined-2026-01-30.log | grep "userId\":1"
```

### Buscar en logs históricos
```bash
# Buscar errores del día anterior
grep "ERROR" logs/error-2026-01-29.log

# Buscar logs de un usuario específico
grep "userId\":5" logs/combined-2026-01-30.log

# Buscar logins fallidos
grep "Login failed" logs/combined-*.log
```

## Rotación de Archivos

Los archivos rotan automáticamente:
- **Cada día**: Nuevo archivo con fecha
- **Por tamaño**: Si supera 20MB
- **Limpieza automática**: Elimina logs antiguos según retención

## Integración con PM2

PM2 captura los logs de consola automáticamente:

```bash
# Ver logs de PM2
pm2 logs

# Ver solo logs de producción (sin debug)
pm2 logs --lines 100

# Limpiar logs de PM2
pm2 flush
```

## Mejores Prácticas

1. **Usar niveles apropiados**:
   - `error`: Solo errores que requieren atención inmediata
   - `warn`: Situaciones anormales pero manejables
   - `info`: Eventos importantes del sistema
   - `debug`: Información detallada para debugging

2. **Incluir contexto relevante**:
   ```javascript
   logger.info('Benefactor created', {
     benefactorId: newBenefactor.id,
     userId: req.usuario.id_usuario,
     tipo: newBenefactor.tipo_benefactor
   });
   ```

3. **No loguear información sensible**:
   - ❌ Passwords
   - ❌ Tokens completos
   - ❌ Números de tarjeta
   - ✅ IDs de usuario
   - ✅ Nombres de usuario
   - ✅ IPs

4. **Estructurar logs para búsqueda**:
   ```javascript
   // Bueno - fácil de buscar
   logger.info('Payment processed', { 
     benefactorId: 123,
     amount: 50.00,
     status: 'success'
   });
   
   // Malo - difícil de buscar
   logger.info(`Payment of $50 for benefactor 123 was successful`);
   ```

## Troubleshooting

### Los logs no se están guardando
1. Verificar que exista el directorio `logs/`
2. Verificar permisos de escritura
3. Revisar `LOG_LEVEL` en `.env`

### Demasiados logs en producción
```bash
# Cambiar nivel a warn o error
LOG_LEVEL=warn
```

### Logs muy grandes
- Archivos rotan automáticamente
- Ajustar `maxFiles` en `logger.js` si es necesario
- Comprimir logs antiguos manualmente

## Variables de Configuración

En `src/config/logger.js`:

```javascript
maxSize: '20m'      // Tamaño máximo por archivo
maxFiles: '30d'     // Retención de errores (30 días)
maxFiles: '14d'     // Retención de combined (14 días)
datePattern: 'YYYY-MM-DD'  // Formato de fecha en nombre
```
