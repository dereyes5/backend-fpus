const express = require('express');
const router = express.Router();
const cobrosController = require('../controllers/cobros.controller');
const { verificarToken } = require('../middleware/auth.middleware');

// Todas las rutas de cobros requieren autenticación
router.use(verificarToken);

// Rutas de consulta de benefactores
router.get('/benefactores', cobrosController.obtenerListaBenefactores);
router.get('/benefactores/:id/saldo', cobrosController.obtenerSaldoBenefactor);
router.get('/benefactores/:id/historial', cobrosController.obtenerHistorialBenefactor);
router.get('/benefactores/:id/transacciones', cobrosController.obtenerTransaccionesSaldo);

// Rutas de estado de pagos
router.get('/estado/actual', cobrosController.obtenerEstadoPagosMesActual);
router.get('/estado/fecha/:fecha', cobrosController.obtenerEstadoPagosPorFecha);
router.get('/estado/mes/:mes/:anio', cobrosController.obtenerEstadoPagosPorMes);

// Rutas de filtrado por estado de pago
router.get('/morosos', cobrosController.obtenerMorosos);
router.get('/pagados', cobrosController.obtenerPagados);
router.get('/pagos-parciales', cobrosController.obtenerPagosParciales);

// Rutas de estadísticas y reportes
router.get('/estadisticas', cobrosController.obtenerEstadisticas);
router.get('/historial', cobrosController.obtenerHistorialCompleto);

// Rutas de gestión de cobros
router.get('/cobros', cobrosController.obtenerCobros);
router.post('/cobros', cobrosController.registrarCobros);

module.exports = router;
