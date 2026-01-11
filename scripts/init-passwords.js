const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

/**
 * Script de inicialización para convertir las contraseñas existentes a bcrypt
 * EJECUTAR UNA SOLA VEZ después de configurar la base de datos
 */

const passwordsToUpdate = [
  { nombre_usuario: 'PRODRIGUEZ', password: 'PRODRIGUEZ' },
  { nombre_usuario: 'MZAMBRANO', password: 'MZAMBRANO' },
  { nombre_usuario: 'GVERA', password: 'GVERA' },
  { nombre_usuario: 'DIRECTO', password: 'DIRECTO' },
];

async function updatePasswords() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Iniciando actualización de contraseñas...\n');

    for (const user of passwordsToUpdate) {
      // Generar hash
      const passwordHash = await bcrypt.hash(user.password, 10);
      
      // Actualizar en base de datos
      const result = await client.query(
        'UPDATE usuarios SET password_hash = $1 WHERE nombre_usuario = $2 RETURNING id_usuario, nombre_usuario',
        [passwordHash, user.nombre_usuario]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Usuario ${result.rows[0].nombre_usuario} (ID: ${result.rows[0].id_usuario}) actualizado correctamente`);
      } else {
        console.log(`⚠️  Usuario ${user.nombre_usuario} no encontrado`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Todas las contraseñas han sido actualizadas exitosamente');
    console.log('Ahora puedes usar el endpoint de login con las contraseñas configuradas\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al actualizar contraseñas:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Verificar que el archivo .env esté configurado
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error('❌ Error: Configura el archivo .env con las credenciales de la base de datos');
  process.exit(1);
}

console.log('🔧 Script de Inicialización de Contraseñas\n');
console.log('Configuración de base de datos:');
console.log(`- Host: ${process.env.DB_HOST}`);
console.log(`- Puerto: ${process.env.DB_PORT}`);
console.log(`- Usuario: ${process.env.DB_USER}`);
console.log(`- Base de datos: ${process.env.DB_NAME}\n`);

// Ejecutar
updatePasswords()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  });
