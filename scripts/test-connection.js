const pool = require('../src/config/database');

/**
 * Script de prueba de conexión a la base de datos
 * Ejecutar con: node scripts/test-connection.js
 */

async function testConnection() {
  console.log('🔍 Probando conexión a la base de datos...\n');
  
  console.log('Configuración:');
  console.log(`- Host: ${process.env.DB_HOST}`);
  console.log(`- Puerto: ${process.env.DB_PORT}`);
  console.log(`- Usuario: ${process.env.DB_USER}`);
  console.log(`- Base de datos: ${process.env.DB_NAME}\n`);

  const client = await pool.connect();
  
  try {
    // Test 1: Conexión básica
    console.log('✅ Conexión establecida correctamente\n');

    // Test 2: Verificar versión de PostgreSQL
    const versionResult = await client.query('SELECT version()');
    console.log('📊 Versión de PostgreSQL:');
    console.log(versionResult.rows[0].version.split(',')[0] + '\n');

    // Test 3: Listar tablas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas encontradas:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log('');

    // Test 4: Contar registros en tablas principales
    console.log('📊 Registros en tablas:');
    
    const usuarios = await client.query('SELECT COUNT(*) as count FROM usuarios');
    console.log(`   - Usuarios: ${usuarios.rows[0].count}`);
    
    const roles = await client.query('SELECT COUNT(*) as count FROM roles');
    console.log(`   - Roles: ${roles.rows[0].count}`);
    
    const benefactores = await client.query('SELECT COUNT(*) as count FROM benefactores');
    console.log(`   - Benefactores: ${benefactores.rows[0].count}`);
    
    const pendientes = await client.query(
      "SELECT COUNT(*) as count FROM benefactores WHERE estado_registro = 'PENDIENTE'"
    );
    console.log(`   - Benefactores pendientes: ${pendientes.rows[0].count}`);
    
    const aprobaciones = await client.query('SELECT COUNT(*) as count FROM aprobaciones_benefactores');
    console.log(`   - Aprobaciones: ${aprobaciones.rows[0].count}\n`);

    // Test 5: Verificar estructura de usuarios
    console.log('🔐 Estructura de tabla usuarios:');
    const usuariosInfo = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);
    usuariosInfo.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`   - ${col.column_name}: ${col.data_type}${length}`);
    });
    console.log('');

    console.log('✅ Todas las pruebas completadas exitosamente');
    console.log('🚀 La base de datos está lista para usar\n');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
    console.error('\nDetalles del error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Verificar variables de entorno
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error('❌ Error: Configura el archivo .env con las credenciales de la base de datos');
  console.error('\nAsegúrate de configurar:');
  console.error('- DB_HOST');
  console.error('- DB_PORT');
  console.error('- DB_USER');
  console.error('- DB_PASSWORD');
  console.error('- DB_NAME\n');
  process.exit(1);
}

// Ejecutar pruebas
testConnection()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script finalizado con errores');
    process.exit(1);
  });
