const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const aparienciaController = require('../controllers/apariencia.controller');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = express.Router();

const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const ensureUploadDir = () => {
  if (!fs.existsSync(aparienciaController.APARIENCIA_DIR)) {
    fs.mkdirSync(aparienciaController.APARIENCIA_DIR, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, aparienciaController.APARIENCIA_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const type = req.path.includes('/logo') ? 'logo' : `carousel_${req.params.index}`;
    cb(null, `${type}_${Date.now()}${ext}`);
  },
});

const uploadImagen = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP'));
  },
});

router.get('/publico', aparienciaController.getConfiguracionPublica);
router.get('/archivo/:filename', aparienciaController.obtenerArchivo);

router.post(
  '/logo',
  verificarToken,
  verificarPermiso('configuraciones'),
  uploadImagen.single('imagen'),
  aparienciaController.subirLogo
);

router.delete(
  '/logo',
  verificarToken,
  verificarPermiso('configuraciones'),
  aparienciaController.eliminarLogo
);

router.post(
  '/carrusel',
  verificarToken,
  verificarPermiso('configuraciones'),
  uploadImagen.single('imagen'),
  aparienciaController.agregarImagenCarrusel
);

router.post(
  '/carrusel/:index',
  verificarToken,
  verificarPermiso('configuraciones'),
  uploadImagen.single('imagen'),
  aparienciaController.subirImagenCarrusel
);

router.delete(
  '/carrusel/:index',
  verificarToken,
  verificarPermiso('configuraciones'),
  aparienciaController.eliminarImagenCarrusel
);

module.exports = router;
