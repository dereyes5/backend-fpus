const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const benefactorController = require('../controllers/benefactor.controller');
const { verificarToken, verificarCualquierPermiso } = require('../middleware/auth.middleware');
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

const verificarAccesoBenefactores = verificarCualquierPermiso([
  'benefactores_ingresar',
  'benefactores_administrar',
]);

// Ruta para obtener todos los titulares (debe ir antes de /:id)
router.get('/titulares', verificarAccesoBenefactores, benefactorController.obtenerTodosTitulares);
router.get('/corporaciones/sugerencias', verificarAccesoBenefactores, benefactorController.obtenerSugerenciasCorporacion);

router.get('/', verificarAccesoBenefactores, benefactorController.obtenerBenefactores);
router.get('/:id', verificarAccesoBenefactores, benefactorController.obtenerBenefactorPorId);
router.post('/', verificarAccesoBenefactores, createBenefactorDto, validarResultado, benefactorController.crearBenefactor);
router.put('/:id', verificarAccesoBenefactores, updateBenefactorDto, validarResultado, benefactorController.actualizarBenefactor);
router.delete('/:id', verificarAccesoBenefactores, benefactorController.eliminarBenefactor);

// Rutas de dependientes
router.post('/asignar-dependiente', verificarAccesoBenefactores, asignarDependienteDto, validarResultado, benefactorController.asignarDependiente);
router.get('/:id/dependientes', verificarAccesoBenefactores, benefactorController.obtenerDependientes);

// Rutas para contratos PDF
router.post('/:id/contrato', verificarAccesoBenefactores, upload.single('contrato'), benefactorController.subirContrato);
router.get('/:id/contrato', verificarAccesoBenefactores, benefactorController.obtenerContrato);
router.delete('/:id/contrato', verificarAccesoBenefactores, benefactorController.eliminarContrato);

module.exports = router;
