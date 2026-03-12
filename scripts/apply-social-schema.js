const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function aplicarEsquemaSocial() {
  const client = await pool.connect();

  try {
    console.log('📋 Conectado a la base de datos');
    console.log('📂 Leyendo archivo social.sql...');

    const sqlPath = path.join(__dirname, '../base/social.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚙️  Ejecutando script SQL...');
    await client.query(sql);

    console.log('\n✅ Script ejecutado exitosamente!\n');
    console.log('📋 Componentes creados/actualizados:');
    console.log('   ✓ beneficiarios_sociales (ficha social ampliada)');
    console.log('   ✓ social_relaciones_familiares (maximo 3 filas por caso)');
    console.log('   ✓ seguimiento_social');
    console.log('   ✓ fotos_seguimiento');
    console.log('   ✓ aprobaciones_beneficiarios_sociales');
    console.log('   ✓ actualizar_fecha_actualizacion()');
    console.log('   ✓ actualizar_tiene_fotos()');
    console.log('   ✓ vista_casos_sociales_completa');
    console.log('\n🎉 Esquema del modulo social aplicado correctamente.\n');
  } catch (error) {
    console.error('❌ Error al ejecutar el script:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

aplicarEsquemaSocial()
  .then(() => {
    console.log('🔚 Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error.message);
    process.exit(1);
  });
