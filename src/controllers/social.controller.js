const socialService = require('../services/social.service');
const notificacionesService = require('../services/notificaciones.service');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// CONFIGURACIÓN MULTER PARA FOTOS
// ==========================================

// Crear carpeta si no existe
const uploadDir = path.join(__dirname, '../../uploads/seguimiento');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Organizar por año/mes
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const destPath = path.join(uploadDir, String(year), month);
    
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'seguimiento-' + uniqueSuffix + ext);
  }
});

// Filtro de archivos (solo imágenes y PDF)
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

const usuarioSocialEscritura = (req) => !!req.usuario?.permisos?.social_escritura;

// ==========================================
// 1. BENEFICIARIOS SOCIALES
// ==========================================

/**
 * Crear nuevo caso social
 * POST /api/social/beneficiarios
 */
async function crearCaso(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errores: errors.array() });
    }
    
    const idUsuarioCarga = req.usuario.id_usuario;
    const beneficiario = await socialService.crearBeneficiarioSocial(req.body, idUsuarioCarga);
    
    console.log('[Social] Caso social creado:', beneficiario.id_beneficiario_social);
    
    // Notificar a usuarios con permisos de aprobación
    try {
      await notificacionesService.notificarCasosPendientes('social');
      console.log('[Social] Notificaciones enviadas a aprobadores');
    } catch (notifError) {
      console.error('[Social] Error al enviar notificaciones:', notifError);
      // No fallar la creación si falla la notificación
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

    if (usuarioSocialEscritura(req)) {
      filtros.id_usuario_carga = req.usuario.id_usuario;
    }

    console.log('[Social] obtenerCasos', {
      userId: req.usuario?.id_usuario,
      username: req.usuario?.nombre_usuario,
      tokenPermisos: req.usuario?.permisos ? Object.keys(req.usuario.permisos).filter(k => req.usuario.permisos[k]) : null,
      scopeSoloPropios: usuarioSocialEscritura(req),
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
    if (usuarioSocialEscritura(req)) {
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
    await socialService.verificarPropietarioCasoSocial(id, req.usuario.id_usuario);
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
    
    await socialService.verificarPropietarioCasoSocial(id, req.usuario.id_usuario);
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
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Error al subir archivos: ' + err.message });
    } else if (err) {
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

      await socialService.verificarPropietarioCasoSocial(id_beneficiario_social, idUsuario);
      
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
      
      console.error('Error al agregar seguimiento:', error);
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
    if (usuarioSocialEscritura(req)) {
      await socialService.verificarPropietarioCasoSocial(idBeneficiario, req.usuario.id_usuario);
    }
    const seguimientos = await socialService.obtenerSeguimiento(idBeneficiario);
    
    res.json({
      total: seguimientos.length,
      seguimientos
    });
  } catch (error) {
    console.error('Error al obtener seguimiento:', error);
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
    await socialService.verificarPropietarioSeguimientoSocial(id, req.usuario.id_usuario);
    
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
      const filePath = path.join(uploadDir, row.ruta_archivo);
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
    if (usuarioSocialEscritura(req)) {
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
