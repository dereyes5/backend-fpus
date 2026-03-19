const express = require('express');
const router = express.Router();
const grupoCobroExternoController = require('../controllers/grupoCobroExterno.controller');
const { verificarToken, verificarCualquierPermiso } = require('../middleware/auth.middleware');

router.use(verificarToken);

const verificarAccesoBenefactores = verificarCualquierPermiso([
  'benefactores_ingresar',
  'benefactores_administrar',
]);

router.get('/', verificarAccesoBenefactores, grupoCobroExternoController.listarGruposCobroExterno);
router.get('/:id', verificarAccesoBenefactores, grupoCobroExternoController.obtenerGrupoCobroExternoPorId);
router.post('/', verificarAccesoBenefactores, grupoCobroExternoController.crearGrupoCobroExterno);
router.put('/:id', verificarAccesoBenefactores, grupoCobroExternoController.actualizarGrupoCobroExterno);

module.exports = router;
