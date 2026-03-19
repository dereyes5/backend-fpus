const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const benefactorController = require('../controllers/benefactor.controller');
const { verificarToken, verificarCualquierPermiso } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createBenefactorDto, updateBenefactorDto, asignarDependienteDto } = require('../dtos/benefactor.dto');

const createPdfUpload = (subdir, prefix) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, `../../uploads/${subdir}`);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const benefactorId = req.params.id;
      const ext = path.extname(file.originalname);
      cb(null, `${prefix}-${benefactorId}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PDF'));
      }
    }
  });
};

const uploadContrato = createPdfUpload('contratos', 'contrato');
const uploadCancelacion = createPdfUpload('cancelaciones', 'cancelacion');

router.use(verificarToken);

const verificarAccesoBenefactores = verificarCualquierPermiso([
  'benefactores_ingresar',
  'benefactores_administrar',
]);

router.get('/titulares', verificarAccesoBenefactores, benefactorController.obtenerTodosTitulares);
router.get('/corporaciones/sugerencias', verificarAccesoBenefactores, benefactorController.obtenerSugerenciasCorporacion);
router.get('/convenio/siguiente', verificarAccesoBenefactores, benefactorController.obtenerSiguienteConvenio);

router.get('/', verificarAccesoBenefactores, benefactorController.obtenerBenefactores);
router.get('/:id', verificarAccesoBenefactores, benefactorController.obtenerBenefactorPorId);
router.post('/', verificarAccesoBenefactores, createBenefactorDto, validarResultado, benefactorController.crearBenefactor);
router.put('/:id', verificarAccesoBenefactores, updateBenefactorDto, validarResultado, benefactorController.actualizarBenefactor);
router.delete('/:id', verificarAccesoBenefactores, benefactorController.eliminarBenefactor);

router.post('/asignar-dependiente', verificarAccesoBenefactores, asignarDependienteDto, validarResultado, benefactorController.asignarDependiente);
router.get('/:id/dependientes', verificarAccesoBenefactores, benefactorController.obtenerDependientes);

router.post('/:id/contrato', verificarAccesoBenefactores, uploadContrato.single('contrato'), benefactorController.subirContrato);
router.get('/:id/contrato', verificarAccesoBenefactores, benefactorController.obtenerContrato);
router.delete('/:id/contrato', verificarAccesoBenefactores, benefactorController.eliminarContrato);

router.post('/:id/cancelacion', verificarAccesoBenefactores, uploadCancelacion.single('cancelacion'), benefactorController.subirCancelacion);
router.get('/:id/cancelacion', verificarAccesoBenefactores, benefactorController.obtenerCancelacion);

module.exports = router;
