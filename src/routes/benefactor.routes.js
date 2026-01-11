const express = require('express');
const router = express.Router();
const benefactorController = require('../controllers/benefactor.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { validarResultado } = require('../middleware/validator.middleware');
const { createBenefactorDto, updateBenefactorDto, asignarDependienteDto } = require('../dtos/benefactor.dto');

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

module.exports = router;
