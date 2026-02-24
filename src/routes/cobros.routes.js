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

// Rutas de estado de aportes
router.get('/estado/actual', cobrosController.obtenerEstadoAportesMesActual);
router.get('/estado/fecha/:fecha', cobrosController.obtenerEstadoAportesPorFecha);
router.get('/estado/mes/:mes/:anio', cobrosController.obtenerEstadoAportesPorMes);

// Rutas de filtrado por estado de aporte
router.get('/no-aportados', cobrosController.obtenerNoAportados);
router.get('/aportados', cobrosController.obtenerAportados);

// Rutas de estadísticas y reportes
router.get('/estadisticas', cobrosController.obtenerEstadisticas);
router.get('/historial', cobrosController.obtenerHistorialCompleto);

// Rutas de gestión de cobros
router.get('/cobros', cobrosController.obtenerCobros);
router.post('/cobros', cobrosController.registrarCobros);

// ========================================
// RUTAS DE DÉBITOS MENSUALES
// ========================================

// Importar archivo Excel de débitos
router.post(
  '/debitos/importar',
  cobrosController.uploadExcel,
  cobrosController.importarExcelDebitos
);

// Gestión de lotes
router.get('/debitos/lotes', cobrosController.obtenerLotesImportados);
router.get('/debitos/lotes/:idLote', cobrosController.obtenerDetalleLote);

// Estado de aportes mensuales (nuevo módulo)
router.get('/debitos/estado-actual', cobrosController.obtenerEstadoAportesMensualesActual);
router.get('/debitos/historial', cobrosController.obtenerHistorialAportesMensuales);

module.exports = router;
