const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authController = require('../controllers/auth.controller');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const {
  createUsuarioDto,
  loginDto,
  assignRoleDto,
  cambiarPasswordDto,
  actualizarUsuarioAdminDto,
  cambiarPasswordAdminDto,
  cambiarEstadoUsuarioDto,
} = require('../dtos/usuario.dto');

// Configuracion de multer para fotos de perfil
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
    const archivoAnterior = archivos.find(
      (f) => f.startsWith(`usuario_${userId}.`) && /\.(jpg|jpeg|png|webp)$/i.test(f)
    );

    if (archivoAnterior) {
      fs.unlinkSync(path.join(uploadPath, archivoAnterior));
    }

    cb(null, `usuario_${userId}${ext}`);
  },
});

const uploadFoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP'));
    }
  },
});

// Rutas publicas
router.post('/login', loginDto, validarResultado, authController.login);

// Rutas protegidas (perfil propio)
router.get('/perfil', verificarToken, authController.obtenerPerfil);
router.put('/cambiar-password', verificarToken, cambiarPasswordDto, validarResultado, authController.cambiarPassword);
router.post('/foto-perfil', verificarToken, uploadFoto.single('foto'), authController.subirFotoPerfil);
router.get('/foto-perfil/:id', authController.obtenerFotoPerfil);
router.delete('/foto-perfil', verificarToken, authController.eliminarFotoPerfil);

// Rutas admin de usuarios
router.get('/usuarios', verificarToken, verificarPermiso('configuraciones'), authController.listarUsuarios);
router.post('/usuarios', verificarToken, verificarPermiso('configuraciones'), createUsuarioDto, validarResultado, authController.crearUsuario);
router.put('/usuarios/:id_usuario/permisos', verificarToken, verificarPermiso('configuraciones'), authController.asignarPermisos);
router.put('/usuarios/:id_usuario', verificarToken, verificarPermiso('configuraciones'), actualizarUsuarioAdminDto, validarResultado, authController.actualizarUsuarioAdmin);
router.put('/usuarios/:id_usuario/password', verificarToken, verificarPermiso('configuraciones'), cambiarPasswordAdminDto, validarResultado, authController.cambiarPasswordUsuarioAdmin);
router.patch('/usuarios/:id_usuario/estado', verificarToken, verificarPermiso('configuraciones'), cambiarEstadoUsuarioDto, validarResultado, authController.cambiarEstadoUsuario);
router.delete('/usuarios/:id_usuario', verificarToken, verificarPermiso('configuraciones'), authController.eliminarUsuarioSoft);

module.exports = router;
