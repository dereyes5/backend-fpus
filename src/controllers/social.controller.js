const socialService = require('../services/social.service');
const notificacionesService = require('../services/notificaciones.service');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// CONFIGURACION MULTER
// ==========================================

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const uploadSeguimientoDir = path.join(__dirname, '../../uploads/seguimiento');
ensureDir(uploadSeguimientoDir);

const uploadCasosDir = path.join(__dirname, '../../uploads/social/casos');
ensureDir(uploadCasosDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Organizar por año/mes
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const destPath = path.join(uploadSeguimientoDir, String(year), month);
    ensureDir(destPath);

    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'seguimiento-' + uniqueSuffix + ext);
  }
});

// Filtro de archivos (solo imagenes y PDF)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos JPG, PNG o PDF'));
  }
};

const uploadFotos = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
}).array('fotos', 10); // Máximo 10 fotos

const storageCaso = multer.diskStorage({
  destination: function (req, file, cb) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const destPath = path.join(uploadCasosDir, year, month);
    ensureDir(destPath);
    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'caso-' + uniqueSuffix + ext);
  }
});

const fileFilterCaso = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'ficha_pdf') {
    if (ext === '.pdf' && file.mimetype.toLowerCase().includes('pdf')) {
      return cb(null, true);
    }
    return cb(new Error('La ficha social debe subirse en PDF'));
  }

  if (file.fieldname === 'firma') {
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('La firma debe ser una imagen JPG o PNG'));
  }

  return cb(new Error('Campo de archivo no permitido'));
};

const uploadCaso = multer({
  storage: storageCaso,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilterCaso
}).fields([
  { name: 'ficha_pdf', maxCount: 1 },
  { name: 'firma', maxCount: 1 }
]);

const normalizeUpperAsciiText = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s.,;:/()#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return normalized || null;
};

const parseMaybeJson = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const puedeIngresarSocial = (req) =>
  req.usuario?.permisos?.social_ingresar === true ||
  req.usuario?.permisos?.social_administrar === true;

const puedeAdministrarSocial = (req) =>
  req.usuario?.permisos?.social_administrar === true;

const alcanceSoloPropiosSocial = (req) =>
  puedeIngresarSocial(req) && !puedeAdministrarSocial(req);

// ==========================================
// 1. BENEFICIARIOS SOCIALES
// ==========================================

/**
 * Crear nuevo caso social
 * POST /api/social/beneficiarios
 */
async function crearCaso(req, res) {
  uploadCaso(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Error al subir archivos: ' + err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const idUsuarioCarga = req.usuario.id_usuario;
      const files = req.files || {};
      const fichaPdf = Array.isArray(files.ficha_pdf) ? files.ficha_pdf[0] : null;
      const firma = Array.isArray(files.firma) ? files.firma[0] : null;

      if (!fichaPdf) {
        return res.status(400).json({ error: 'Debe adjuntar el PDF de la ficha social' });
      }

      const nombres = normalizeUpperAsciiText(req.body.nombres);
      const apellidos = normalizeUpperAsciiText(req.body.apellidos);
      const sexo = (req.body.sexo || '').toString().trim().toUpperCase();

      if (!nombres || !apellidos || !sexo) {
        return res.status(400).json({ error: 'Campos requeridos: nombres, apellidos, sexo' });
      }

      const payload = {
        ...req.body,
        nombres,
        apellidos,
        nombre_completo: `${nombres} ${apellidos}`.trim(),
        sexo,
        nacionalidad: normalizeUpperAsciiText(req.body.nacionalidad),
        estado_civil: normalizeUpperAsciiText(req.body.estado_civil),
        tipo_sangre: normalizeUpperAsciiText(req.body.tipo_sangre),
        direccion: normalizeUpperAsciiText(req.body.direccion),
        ciudad: normalizeUpperAsciiText(req.body.ciudad),
        provincia: normalizeUpperAsciiText(req.body.provincia),
        pais: normalizeUpperAsciiText(req.body.pais),
        telefono: normalizeUpperAsciiText(req.body.telefono),
        referencia: normalizeUpperAsciiText(req.body.referencia),
        discapacidad_detalle: normalizeUpperAsciiText(req.body.discapacidad_detalle),
        con_quien_vive: normalizeUpperAsciiText(req.body.con_quien_vive),
        con_quien_vive_detalle: normalizeUpperAsciiText(req.body.con_quien_vive_detalle),
        salud_estado_general: normalizeUpperAsciiText(req.body.salud_estado_general),
        alergia_medicamentos_detalle: normalizeUpperAsciiText(req.body.alergia_medicamentos_detalle),
        perdida_familiar_detalle: normalizeUpperAsciiText(req.body.perdida_familiar_detalle),
        observaciones_conclusiones: normalizeUpperAsciiText(req.body.observaciones_conclusiones),
        relaciones_familiares: parseMaybeJson(req.body.relaciones_familiares, []),
        situacion_vivienda: parseMaybeJson(req.body.situacion_vivienda, {}),
        recursos_economicos: parseMaybeJson(req.body.recursos_economicos, {}),
        red_social_apoyo: parseMaybeJson(req.body.red_social_apoyo, {}),
        discapacidad: String(req.body.discapacidad).toLowerCase() === 'true',
        enfermedad_catastrofica: String(req.body.enfermedad_catastrofica).toLowerCase() === 'true',
        toma_medicacion_constante: String(req.body.toma_medicacion_constante).toLowerCase() === 'true',
        alergia_medicamentos: String(req.body.alergia_medicamentos).toLowerCase() === 'true',
        nutricion_desayuno: String(req.body.nutricion_desayuno).toLowerCase() === 'true',
        nutricion_almuerzo: String(req.body.nutricion_almuerzo).toLowerCase() === 'true',
        nutricion_merienda: String(req.body.nutricion_merienda).toLowerCase() === 'true',
        nutricion_consume_frutas: String(req.body.nutricion_consume_frutas).toLowerCase() === 'true',
        se_siente_acompanado: req.body.se_siente_acompanado === undefined ? null : String(req.body.se_siente_acompanado).toLowerCase() === 'true',
        perdida_familiar_reciente: req.body.perdida_familiar_reciente === undefined ? null : String(req.body.perdida_familiar_reciente).toLowerCase() === 'true',
      };

      const archivos = {
        ficha_pdf_nombre: fichaPdf.originalname,
        ficha_pdf_ruta: fichaPdf.path.split('uploads/social/casos/')[1]?.replace(/\\/g, '/') || null,
        firma_nombre: firma ? firma.originalname : null,
        firma_ruta: firma ? (firma.path.split('uploads/social/casos/')[1]?.replace(/\\/g, '/') || null) : null,
      };

      const beneficiario = await socialService.crearBeneficiarioSocial(payload, idUsuarioCarga, archivos);

      console.log('[Social] Caso social creado:', beneficiario.id_beneficiario_social);

      try {
        await notificacionesService.notificarCasosPendientes('social');
      } catch (notifError) {
        console.error('[Social] Error al enviar notificaciones:', notifError);
      }

      res.status(201).json({
        mensaje: 'Caso social creado exitosamente',
        beneficiario
      });
    } catch (error) {
      console.error('[Social] Error al crear caso social:', error);
      res.status(500).json({
        error: 'Error al crear caso social',
        detalle: error.message
      });
    }
  });
}

/**
 * Obtener casos sociales (con filtros)
 * GET /api/social/beneficiarios
 */
async function obtenerCasos(req, res) {
  try {
    const filtros = {
      estado: req.query.estado,
      estado_registro: req.query.estado_registro,
      prioridad: req.query.prioridad,
      ciudad: req.query.ciudad,
      tipo_caso: req.query.tipo_caso,
      id_usuario_carga: req.query.id_usuario_carga,
      busqueda: req.query.busqueda
    };

    // Filtrar valores undefined
    Object.keys(filtros).forEach(key => {
      if (filtros[key] === undefined) {
        delete filtros[key];
      }
    });

    if (alcanceSoloPropiosSocial(req)) {
      filtros.id_usuario_carga = req.usuario.id_usuario;
    }

    console.log('[Social] obtenerCasos', {
      userId: req.usuario?.id_usuario,
      username: req.usuario?.nombre_usuario,
      tokenPermisos: req.usuario?.permisos ? Object.keys(req.usuario.permisos).filter(k => req.usuario.permisos[k]) : null,
      scopeSoloPropios: alcanceSoloPropiosSocial(req),
      filtros,
    });

    const beneficiarios = await socialService.obtenerBeneficiariosSociales(filtros);

    res.json({
      total: beneficiarios.length,
      beneficiarios
    });
  } catch (error) {
    console.error('Error al obtener casos sociales:', error);
    res.status(500).json({
      error: 'Error al obtener casos sociales',
      detalle: error.message
    });
  }
}

/**
 * Obtener caso social por ID
 * GET /api/social/beneficiarios/:id
 */
async function obtenerCasoPorId(req, res) {
  try {
    const { id } = req.params;
    if (alcanceSoloPropiosSocial(req)) {
      await socialService.verificarPropietarioCasoSocial(id, req.usuario.id_usuario);
    }
    const beneficiario = await socialService.obtenerBeneficiarioSocialPorId(id);

    res.json(beneficiario);
  } catch (error) {
    console.error('Error al obtener caso social:', error);

    if (error.message === 'Beneficiario social no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'No autorizado para acceder a este caso social') {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al obtener caso social',
      detalle: error.message
    });
  }
}

/**
 * Actualizar caso social
 * PUT /api/social/beneficiarios/:id
 */
async function actualizarCaso(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errores: errors.array() });
    }

    const { id } = req.params;
    if (alcanceSoloPropiosSocial(req)) {
      await socialService.verificarPropietarioCasoSocial(id, req.usuario.id_usuario);
    }
    const beneficiario = await socialService.actualizarBeneficiarioSocial(id, req.body);

    res.json({
      mensaje: 'Caso social actualizado exitosamente',
      beneficiario
    });
  } catch (error) {
    console.error('Error al actualizar caso social:', error);

    if (error.message === 'Beneficiario social no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'No autorizado para acceder a este caso social') {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al actualizar caso social',
      detalle: error.message
    });
  }
}

/**
 * Cambiar estado del caso
 * PUT /api/social/beneficiarios/:id/estado
 */
async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;

    if (!estado) {
      return res.status(400).json({ error: 'El estado es requerido' });
    }

    if (alcanceSoloPropiosSocial(req)) {
      await socialService.verificarPropietarioCasoSocial(id, req.usuario.id_usuario);
    }
    const beneficiario = await socialService.cambiarEstadoCaso(id, estado, observaciones);

    res.json({
      mensaje: 'Estado del caso actualizado exitosamente',
      beneficiario
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error);

    if (error.message === 'Beneficiario social no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'No autorizado para acceder a este caso social') {
      return res.status(403).json({ error: error.message });
    }

    if (error.message === 'Estado no válido') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al cambiar estado',
      detalle: error.message
    });
  }
}

// ==========================================
// 2. SEGUIMIENTO
// ==========================================

/**
 * Agregar seguimiento con fotos
 * POST /api/social/seguimiento
 */
async function agregarSeguimiento(req, res) {
  uploadFotos(req, res, async function (err) {
    console.log('[Social][Seguimiento] POST /seguimiento - inicio', {
      userId: req.usuario?.id_usuario,
      username: req.usuario?.nombre_usuario,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      filesCount: Array.isArray(req.files) ? req.files.length : 0,
    });

    if (err instanceof multer.MulterError) {
      console.warn('[Social][Seguimiento] Error Multer', {
        userId: req.usuario?.id_usuario,
        error: err.message,
      });
      return res.status(400).json({ error: 'Error al subir archivos: ' + err.message });
    } else if (err) {
      console.warn('[Social][Seguimiento] Error upload', {
        userId: req.usuario?.id_usuario,
        error: err.message,
      });
      return res.status(400).json({ error: err.message });
    }

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Eliminar archivos subidos si hay error de validación
        if (req.files) {
          req.files.forEach(file => fs.unlinkSync(file.path));
        }
        return res.status(400).json({ errores: errors.array() });
      }

      const { id_beneficiario_social, tipo_evento, descripcion, fecha_evento } = req.body;
      const idUsuario = req.usuario.id_usuario;

      console.log('[Social][Seguimiento] Payload validado', {
        userId: idUsuario,
        id_beneficiario_social,
        tipo_evento,
        fecha_evento: fecha_evento || null,
        descripcionLength: typeof descripcion === 'string' ? descripcion.length : 0,
      });

      if (alcanceSoloPropiosSocial(req)) {
        await socialService.verificarPropietarioCasoSocial(id_beneficiario_social, idUsuario);
      }

      // Procesar fotos
      const fotos = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          // Ruta relativa desde uploads/seguimiento/
          const relativePath = file.path.split('uploads/seguimiento/')[1];

          fotos.push({
            nombre_archivo: file.originalname,
            ruta_archivo: relativePath,
            descripcion: null
          });
        }
      }

      const data = {
        tipo_evento,
        descripcion,
        fecha_evento
      };

      const seguimiento = await socialService.agregarSeguimiento(
        id_beneficiario_social,
        data,
        fotos,
        idUsuario
      );

      console.log('[Social][Seguimiento] Seguimiento creado', {
        userId: idUsuario,
        id_beneficiario_social,
        id_seguimiento: seguimiento?.id_seguimiento,
        fotosCount: Array.isArray(seguimiento?.fotos) ? seguimiento.fotos.length : 0,
      });

      res.status(201).json({
        mensaje: 'Seguimiento agregado exitosamente',
        seguimiento
      });
    } catch (error) {
      // Eliminar archivos subidos si hay error
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      console.error('[Social][Seguimiento] Error al agregar seguimiento:', {
        userId: req.usuario?.id_usuario,
        body: req.body,
        filesCount: Array.isArray(req.files) ? req.files.length : 0,
        message: error.message,
        stack: error.stack
      });
      if (error.message === 'Beneficiario social no encontrado') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'No autorizado para acceder a este caso social') {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({
        error: 'Error al agregar seguimiento',
        detalle: error.message
      });
    }
  });
}

/**
 * Obtener seguimiento de un caso
 * GET /api/social/seguimiento/:idBeneficiario
 */
async function obtenerSeguimiento(req, res) {
  try {
    const { idBeneficiario } = req.params;
    console.log('[Social][Seguimiento] GET /seguimiento/:idBeneficiario - inicio', {
      userId: req.usuario?.id_usuario,
      username: req.usuario?.nombre_usuario,
      idBeneficiario,
      scopeSoloPropios: alcanceSoloPropiosSocial(req),
      query: req.query || {},
    });

    if (alcanceSoloPropiosSocial(req)) {
      await socialService.verificarPropietarioCasoSocial(idBeneficiario, req.usuario.id_usuario);
    }
    const seguimientos = await socialService.obtenerSeguimiento(idBeneficiario);

    console.log('[Social][Seguimiento] GET resultado', {
      userId: req.usuario?.id_usuario,
      idBeneficiario,
      total: Array.isArray(seguimientos) ? seguimientos.length : null,
      firstId: Array.isArray(seguimientos) && seguimientos[0] ? seguimientos[0].id_seguimiento : null,
    });

    res.json({
      total: seguimientos.length,
      seguimientos
    });
  } catch (error) {
    console.error('[Social][Seguimiento] Error al obtener seguimiento:', {
      userId: req.usuario?.id_usuario,
      idBeneficiario: req.params?.idBeneficiario,
      message: error.message,
      stack: error.stack
    });
    if (error.message === 'Beneficiario social no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'No autorizado para acceder a este caso social') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Error al obtener seguimiento',
      detalle: error.message
    });
  }
}

/**
 * Eliminar seguimiento
 * DELETE /api/social/seguimiento/:id
 */
async function eliminarSeguimiento(req, res) {
  try {
    const { id } = req.params;
    if (alcanceSoloPropiosSocial(req)) {
      await socialService.verificarPropietarioSeguimientoSocial(id, req.usuario.id_usuario);
    }

    // Primero obtener las fotos para eliminarlas del disco
    const queryFotos = `
      SELECT ruta_archivo FROM fotos_seguimiento WHERE id_seguimiento = $1
    `;
    const pool = require('../config/database');
    const resultFotos = await pool.query(queryFotos, [id]);

    // Eliminar seguimiento (las fotos en BD se eliminan en cascada)
    await socialService.eliminarSeguimiento(id);

    // Eliminar archivos físicos
    resultFotos.rows.forEach(row => {
      const filePath = path.join(uploadSeguimientoDir, row.ruta_archivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    res.json({
      mensaje: 'Seguimiento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar seguimiento:', error);

    if (error.message === 'Seguimiento no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'No autorizado para acceder a este seguimiento') {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al eliminar seguimiento',
      detalle: error.message
    });
  }
}

// ==========================================
// 3. ESTADÍSTICAS
// ==========================================

/**
 * Obtener estadísticas del módulo social
 * GET /api/social/estadisticas
 */
async function obtenerEstadisticas(req, res) {
  try {
    const filtros = {};

    // Si el usuario no es admin, solo ver sus propias estadísticas
    if (alcanceSoloPropiosSocial(req)) {
      filtros.id_usuario_carga = req.usuario.id_usuario;
    } else if (req.query.id_usuario_carga) {
      filtros.id_usuario_carga = req.query.id_usuario_carga;
    }

    const estadisticas = await socialService.obtenerEstadisticas(filtros);

    res.json(estadisticas);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      detalle: error.message
    });
  }
}

// ==========================================
// 4. APROBACIONES
// ==========================================

/**
 * Obtener casos pendientes de aprobación
 * GET /api/social/aprobaciones/pendientes
 */
async function obtenerPendientes(req, res) {
  try {
    const pendientes = await socialService.obtenerCasosPendientes();

    res.json({
      total: pendientes.length,
      pendientes
    });
  } catch (error) {
    console.error('Error al obtener pendientes:', error);
    res.status(500).json({
      error: 'Error al obtener pendientes',
      detalle: error.message
    });
  }
}

/**
 * Aprobar caso social
 * POST /api/social/aprobaciones/:id/aprobar
 */
async function aprobarCaso(req, res) {
  try {
    const { id } = req.params;
    const { comentario } = req.body;
    const idAdmin = req.usuario.id_usuario;

    const beneficiario = await socialService.aprobarCasoSocial(id, idAdmin, comentario);

    res.json({
      mensaje: 'Caso social aprobado exitosamente',
      beneficiario
    });
  } catch (error) {
    console.error('Error al aprobar caso:', error);

    if (error.message === 'Beneficiario social no encontrado') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al aprobar caso',
      detalle: error.message
    });
  }
}

/**
 * Rechazar caso social
 * POST /api/social/aprobaciones/:id/rechazar
 */
async function rechazarCaso(req, res) {
  try {
    const { id } = req.params;
    const { comentario } = req.body;
    const idAdmin = req.usuario.id_usuario;

    if (!comentario) {
      return res.status(400).json({
        error: 'El comentario es obligatorio al rechazar un caso'
      });
    }

    const beneficiario = await socialService.rechazarCasoSocial(id, idAdmin, comentario);

    res.json({
      mensaje: 'Caso social rechazado',
      beneficiario
    });
  } catch (error) {
    console.error('Error al rechazar caso:', error);

    if (error.message === 'Beneficiario social no encontrado') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al rechazar caso',
      detalle: error.message
    });
  }
}

module.exports = {
  crearCaso,
  obtenerCasos,
  obtenerCasoPorId,
  actualizarCaso,
  cambiarEstado,
  agregarSeguimiento,
  obtenerSeguimiento,
  eliminarSeguimiento,
  obtenerEstadisticas,
  obtenerPendientes,
  aprobarCaso,
  rechazarCaso
};
