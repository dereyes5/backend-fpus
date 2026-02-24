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

      // Construir el nombre de la clave de permiso
      // Ejemplo: 'social' + 'escritura' = 'social_escritura'
      const clavePermiso = tipoPermiso === 'acceso' 
        ? recurso 
        : `${recurso}_${tipoPermiso}`;

      if (!permisosRol || !permisosRol.permisos[clavePermiso]) {
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para ${tipoPermiso} en ${recurso}`,
        });
      }

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
