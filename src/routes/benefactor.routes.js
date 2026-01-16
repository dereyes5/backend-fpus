const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const benefactorController = require('../controllers/benefactor.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createBenefactorDto, updateBenefactorDto, asignarDependienteDto } = require('../dtos/benefactor.dto');

// Configuración de multer para almacenar PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/contratos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const benefactorId = req.params.id;
    const ext = path.extname(file.originalname);
    cb(null, `contrato-${benefactorId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Todas las rutas de benefactores requieren autenticación
router.use(verificarToken);

router.get('/', benefactorController.obtenerBenefactores);
router.get('/:id', benefactorController.obtenerBenefactorPorId);
router.post('/', createBenefactorDto, validarResultado, benefactorController.crearBenefactor);
router.put('/:id', updateBenefactorDto, validarResultado, benefactorController.actualizarBenefactor);
router.delete('/:id', benefactorController.eliminarBenefactor);

// Rutas de dependientes
router.post('/asignar-dependiente', asignarDependienteDto, validarResultado, benefactorController.asignarDependiente);
router.get('/:id/dependientes', benefactorController.obtenerDependientes);

// Rutas para contratos PDF
router.post('/:id/contrato', upload.single('contrato'), benefactorController.subirContrato);
router.get('/:id/contrato', benefactorController.obtenerContrato);
router.delete('/:id/contrato', benefactorController.eliminarContrato);

module.exports = router;
