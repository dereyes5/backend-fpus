const fs = require('fs').promises;
const path = require('path');

const PERMISOS_FILE = path.join(__dirname, '../config/permisos.json');

// Leer archivo de permisos
const leerPermisos = async () => {
  try {
    const data = await fs.readFile(PERMISOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al leer permisos:', error);
    return null;
  }
};

// Middleware para verificar permiso de ver un recurso
const verificarPermisoVer = (recurso) => {
  return async (req, res, next) => {
    try {
      const { roles } = req.usuario;
      
      if (!roles || roles.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a este recurso',
        });
      }

      const permisos = await leerPermisos();
      if (!permisos) {
        return res.status(500).json({
          success: false,
          message: 'Error al verificar permisos',
        });
      }

      // Verificar permisos del primer rol del usuario
      const idRol = roles[0].id_rol;
      const permisosRol = permisos.permisos_por_rol[idRol];

      if (!permisosRol || !permisosRol.permisos[recurso]?.ver) {
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para ver ${recurso}`,
        });
      }

      next();
    } catch (error) {
      console.error('Error al verificar permiso de ver:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message,
      });
    }
  };
};

// Middleware para verificar permiso de editar un recurso
const verificarPermisoEditar = (recurso) => {
  return async (req, res, next) => {
    try {
      const { roles } = req.usuario;
      
      if (!roles || roles.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para modificar este recurso',
        });
      }

      const permisos = await leerPermisos();
      if (!permisos) {
        return res.status(500).json({
          success: false,
          message: 'Error al verificar permisos',
        });
      }

      // Verificar permisos del primer rol del usuario
      const idRol = roles[0].id_rol;
      const permisosRol = permisos.permisos_por_rol[idRol];

      if (!permisosRol || !permisosRol.permisos[recurso]?.editar) {
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para editar ${recurso}`,
        });
      }

      next();
    } catch (error) {
      console.error('Error al verificar permiso de editar:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message,
      });
    }
  };
};

// Middleware genérico para verificar cualquier tipo de permiso
const verificarPermiso = (recurso, tipoPermiso = 'lectura') => {
  return async (req, res, next) => {
    try {
      const { roles, permisos: permisosToken } = req.usuario;
      const clavePermiso = tipoPermiso === 'acceso'
        ? recurso
        : `${recurso}_${tipoPermiso}`;

      console.log('[PermisosMiddleware] Verificando permiso', {
        userId: req.usuario?.id_usuario,
        username: req.usuario?.nombre_usuario,
        url: req.originalUrl,
        method: req.method,
        recurso,
        tipoPermiso,
        clavePermiso,
        rolesCount: Array.isArray(roles) ? roles.length : 0,
        roles: Array.isArray(roles) ? roles.map(r => ({ id_rol: r.id_rol, nombre_rol: r.nombre_rol || r.nombre })) : roles,
        tokenPermisos: req.usuario?.permisos ? Object.keys(req.usuario.permisos).filter(k => req.usuario.permisos[k]) : null,
      });
      
      // Prioridad 1: permisos granulares embebidos en token (sistema actual)
      if (permisosToken && typeof permisosToken === 'object') {
        const tienePermisoToken = permisosToken[clavePermiso] === true;

        console.log('[PermisosMiddleware] Validando con permisos del token', {
          userId: req.usuario?.id_usuario,
          clavePermiso,
          valorEnToken: permisosToken[clavePermiso],
        });

        if (!tienePermisoToken) {
          console.warn('[PermisosMiddleware] Acceso denegado: permiso faltante en token', {
            userId: req.usuario?.id_usuario,
            clavePermiso,
            url: req.originalUrl,
          });
          return res.status(403).json({
            success: false,
            message: `No tienes permiso para ${tipoPermiso} en ${recurso}`,
            debug: {
              source: 'token',
              missing_permission: clavePermiso,
            }
          });
        }

        console.log('[PermisosMiddleware] Acceso permitido por permisos del token', {
          userId: req.usuario?.id_usuario,
          clavePermiso,
          url: req.originalUrl,
        });
        return next();
      }

      // Prioridad 2 (fallback legacy): resolver por roles + permisos.json
      if (!roles || roles.length === 0) {
        console.warn('[PermisosMiddleware] Acceso denegado: usuario sin roles y sin permisos en token', {
          userId: req.usuario?.id_usuario,
          clavePermiso,
          url: req.originalUrl,
        });
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a este recurso',
          debug: {
            source: 'roles',
            reason: 'missing_roles_and_token_permissions',
            missing_permission: clavePermiso,
          }
        });
      }

      const permisos = await leerPermisos();
      if (!permisos) {
        return res.status(500).json({
          success: false,
          message: 'Error al verificar permisos',
        });
      }

      // Verificar permisos del primer rol del usuario
      const idRol = roles[0].id_rol;
      const permisosRol = permisos.permisos_por_rol[idRol];
      console.log('[PermisosMiddleware] Permisos cargados para rol', {
        userId: req.usuario?.id_usuario,
        idRol,
        rolEncontrado: !!permisosRol,
        clavesDisponibles: permisosRol?.permisos ? Object.keys(permisosRol.permisos).filter(k => permisosRol.permisos[k]) : [],
        claveRequerida: clavePermiso,
        valorClaveRequerida: permisosRol?.permisos?.[clavePermiso],
      });

      if (!permisosRol || !permisosRol.permisos[clavePermiso]) {
        console.warn('[PermisosMiddleware] Acceso denegado: permiso faltante', {
          userId: req.usuario?.id_usuario,
          idRol,
          clavePermiso,
          url: req.originalUrl,
        });
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para ${tipoPermiso} en ${recurso}`,
        });
      }

      console.log('[PermisosMiddleware] Acceso permitido', {
        userId: req.usuario?.id_usuario,
        idRol,
        clavePermiso,
        url: req.originalUrl,
      });
      next();
    } catch (error) {
      console.error('Error al verificar permiso:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message,
      });
    }
  };
};

module.exports = {
  verificarPermisoVer,
  verificarPermisoEditar,
  verificarPermiso,
};
