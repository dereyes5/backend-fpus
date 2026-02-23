const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createUsuarioDto, loginDto, assignRoleDto, cambiarPasswordDto } = require('../dtos/usuario.dto');

// Configuración de multer para fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/fotos-perfil');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const userId = req.usuario.id_usuario;
    const ext = path.extname(file.originalname);
    
    // Eliminar foto anterior si existe
    const uploadPath = path.join(__dirname, '../../uploads/fotos-perfil');
    const archivos = fs.readdirSync(uploadPath);
    const archivoAnterior = archivos.find(f => 
      f.startsWith(`usuario_${userId}.`) && 
      /\.(jpg|jpeg|png|webp)$/i.test(f)
    );
    
    if (archivoAnterior) {
      fs.unlinkSync(path.join(uploadPath, archivoAnterior));
    }
    
    cb(null, `usuario_${userId}${ext}`);
  }
});

const uploadFoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
    }
  }
});

// Rutas públicas
router.post('/login', loginDto, validarResultado, authController.login);
router.post('/usuarios', createUsuarioDto, validarResultado, authController.crearUsuario);

// Rutas protegidas
router.get('/usuarios', verificarToken, authController.listarUsuarios);
router.put('/usuarios/:id_usuario/permisos', verificarToken, authController.asignarPermisos);
router.get('/perfil', verificarToken, authController.obtenerPerfil);
router.put('/cambiar-password', verificarToken, cambiarPasswordDto, validarResultado, authController.cambiarPassword);

// Rutas de foto de perfil
router.post('/foto-perfil', verificarToken, uploadFoto.single('foto'), authController.subirFotoPerfil);
router.get('/foto-perfil/:id', authController.obtenerFotoPerfil);
router.delete('/foto-perfil', verificarToken, authController.eliminarFotoPerfil);

module.exports = router;
