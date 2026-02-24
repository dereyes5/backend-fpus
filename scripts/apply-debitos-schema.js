const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

/**
 * Script para ejecutar el esquema de débitos mensuales
 * Ejecutar con: node scripts/apply-debitos-schema.js
 */

async function aplicarEsquema() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando aplicación del esquema de débitos mensuales...\n');
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../base/debitos_mensuales.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Ejecutar el script
    await client.query(sql);
    
    console.log('\n✅ Esquema de débitos mensuales aplicado exitosamente');
    console.log('\n📋 Componentes creados:');
    console.log('   • Tabla: lotes_importacion');
    console.log('   • Tabla: estado_aportes_mensuales');
    console.log('   • Extensión tabla cobros (id_lote_importacion, estado_banco_raw, fila_excel)');
    console.log('   • Función: normalizar_estado_banco()');
    console.log('   • Función: calcular_share_inscripcion()');
    console.log('   • Función: propagar_estado_a_dependientes()');
    console.log('   • Función: procesar_lote_debitos()');
    console.log('   • Función: recalcular_shares_titular()');
    console.log('   • Vista: vista_estado_aportes_actual');
    console.log('   • Vista: vista_historial_aportes_completo');
    console.log('   • Trigger: trigger_recalcular_shares_dependientes');
    console.log('\n🎉 Sistema de débitos mensuales listo para usar!');
    
  } catch (error) {
    console.error('\n❌ Error al aplicar el esquema:', error.message);
    console.error('\nDetalles del error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

aplicarEsquema();
