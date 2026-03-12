#!/usr/bin/env node

const pool = require('../src/config/database');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? next : true;
    args[key] = value;
    if (value !== true) i += 1;
  }
  return args;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function normalizeConvenio(value) {
  return (value || '').toString().trim().toUpperCase();
}

async function listarDuplicados(client, convenio) {
  const result = await client.query(
    `SELECT id_benefactor, nombre_completo, cedula, n_convenio, tipo_benefactor, estado_registro
     FROM benefactores
     WHERE UPPER(n_convenio) = $1
     ORDER BY CASE WHEN tipo_benefactor = 'TITULAR' THEN 0 ELSE 1 END, id_benefactor`,
    [normalizeConvenio(convenio)]
  );

  console.log(`\nRegistros con convenio ${normalizeConvenio(convenio)}:`);
  console.table(result.rows);
}

async function main() {
  const args = parseArgs(process.argv);

  const actual = normalizeConvenio(args.actual);
  const nuevo = normalizeConvenio(args.nuevo);
  const byId = args.id ? Number(args.id) : null;
  const byCedula = args.cedula ? String(args.cedula).trim() : null;
  const apply = args.apply === true;

  if (!actual) fail('Falta --actual (convenio actual)');
  if (!nuevo) fail('Falta --nuevo (convenio nuevo)');
  if (actual === nuevo) fail('--nuevo debe ser diferente a --actual');
  if (!byId && !byCedula) fail('Debes indicar --id o --cedula para seleccionar un solo benefactor');
  if (byId && !Number.isInteger(byId)) fail('--id debe ser numerico');

  const client = await pool.connect();
  try {
    await listarDuplicados(client, actual);

    const whereSelector = byId ? 'id_benefactor = $1' : 'cedula = $1';
    const selectorValue = byId || byCedula;

    const objetivoResult = await client.query(
      `SELECT id_benefactor, nombre_completo, cedula, n_convenio, tipo_benefactor, estado_registro
       FROM benefactores
       WHERE ${whereSelector}
       LIMIT 1`,
      [selectorValue]
    );

    if (objetivoResult.rows.length === 0) {
      fail('No se encontro el benefactor objetivo con ese --id/--cedula');
    }

    const objetivo = objetivoResult.rows[0];

    if (normalizeConvenio(objetivo.n_convenio) !== actual) {
      fail(`El benefactor objetivo tiene convenio ${objetivo.n_convenio}, no ${actual}`);
    }

    const existeNuevoResult = await client.query(
      `SELECT id_benefactor, nombre_completo, cedula, n_convenio, tipo_benefactor, estado_registro
       FROM benefactores
       WHERE UPPER(n_convenio) = $1
       ORDER BY id_benefactor`,
      [nuevo]
    );

    if (existeNuevoResult.rows.length > 0) {
      console.log(`\nAtencion: ya existen ${existeNuevoResult.rows.length} registro(s) con el convenio nuevo ${nuevo}:`);
      console.table(existeNuevoResult.rows);
      fail('Aborta para evitar crear otra colision. Elige otro --nuevo');
    }

    console.log('\nBenefactor objetivo:');
    console.table([objetivo]);

    if (!apply) {
      console.log('\nModo simulacion (sin cambios).');
      console.log('Para aplicar, vuelve a correr con --apply');
      return;
    }

    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE benefactores
       SET n_convenio = $1
       WHERE id_benefactor = $2`,
      [nuevo, objetivo.id_benefactor]
    );

    if (updateResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      fail('No se pudo actualizar el convenio');
    }

    await client.query('COMMIT');

    console.log('\nActualizacion completada.');
    await listarDuplicados(client, actual);

    const verificacion = await client.query(
      `SELECT id_benefactor, nombre_completo, cedula, n_convenio, tipo_benefactor, estado_registro
       FROM benefactores
       WHERE id_benefactor = $1`,
      [objetivo.id_benefactor]
    );
    console.log('\nRegistro actualizado:');
    console.table(verificacion.rows);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // ignore rollback error
    }
    fail(error.message || 'Fallo inesperado');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  fail(error.message || 'Fallo inesperado');
});
