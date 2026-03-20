#!/usr/bin/env node

/**
 * Carga masiva robusta de benefactores usando el resultado del preview.
 *
 * Flujo:
 * 1. Lee el Excel para mapear filas -> ejecutivo/prefijo.
 * 2. Lee previewDir para reutilizar payloads ya revisados manualmente.
 * 3. Hace preflight y resume conflictos.
 * 4. En modo execute:
 *    - limpia benefactores y usuarios (preservando PRODRIGUEZ),
 *    - crea usuarios ejecutivos con sucursal y permisos propios,
 *    - inicia sesion como cada ejecutivo,
 *    - crea titulares, dependientes y asignaciones por API.
 *
 * Uso:
 * node scripts/carga-masiva-benefactores.js ^
 *   --baseUrl http://154.12.234.100:3000 ^
 *   --adminUser PRODRIGUEZ ^
 *   --adminPass PRODRIGUEZ ^
 *   --excel "C:\ruta\BASE PARA ESPE.xlsx" ^
 *   --previewDir "backend\scripts\output\preview-benefactores-YYYYMMDD-HHMMSS"
 *
 * Por defecto corre en dry-run. Para ejecutar de verdad:
 *   --execute true --confirm BORRAR_CARGAR_BENEFACTORES
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const pool = require('../src/config/database');

const DEFAULT_TIMEOUT_MS = 30000;
const CONFIRM_TEXT = 'BORRAR_CARGAR_BENEFACTORES';
const KEEPER_USER = 'PRODRIGUEZ';
const PREVIEW_REQUIRED_FILES = [
  'payloads_titulares.json',
  'payloads_dependientes.json',
  'payloads_asignaciones.json',
  'reporte_validacion.json',
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;
    if (value !== true) i += 1;
  }
  return args;
}

function required(name, value) {
  if (!value) {
    throw new Error(`Falta argumento requerido: --${name}`);
  }
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'si', 'yes', 'y'].includes(normalized);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForPath(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\//g, ' ')
    .replace(/-/g, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUpper(value) {
  const normalized = normalizeString(value);
  return normalized ? stripAccents(normalized).toUpperCase() : '';
}

function extractConvenioPrefix(value) {
  const normalized = normalizeUpper(value);
  const match = normalized.match(/^([A-Z]+)/);
  return match ? match[1] : null;
}

function sanitizeUsername(rawValue) {
  const original = normalizeUpper(rawValue);
  const username = original
    .replace(/[^A-Z0-9_ ]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return {
    original,
    username,
    isValid:
      username.length >= 3 &&
      username.length <= 20 &&
      /^[A-Z0-9_]+$/.test(username),
  };
}

function createLogger({ verbose = false, writeLine = null } = {}) {
  const emit = (level, message, data) => {
    const suffix = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    const line = `[load:${level}] ${message}${suffix}`;
    console.log(line);
    if (writeLine) writeLine(line);
  };

  return {
    info(message, data) {
      emit('info', message, data);
    },
    warn(message, data) {
      emit('warn', message, data);
    },
    error(message, data) {
      emit('error', message, data);
    },
    debug(message, data) {
      if (!verbose) return;
      emit('debug', message, data);
    },
  };
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_error) {
      body = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function login(baseUrl, nombreUsuario, password, logger) {
  const response = await requestJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      nombre_usuario: nombreUsuario,
      password,
    }),
  });

  if (!response.ok || !response.body?.success || !response.body?.data?.token) {
    throw new Error(
      `No se pudo iniciar sesion como ${nombreUsuario}: ${response.body?.message || response.status}`
    );
  }

  logger.debug('Login API exitoso', {
    nombre_usuario: nombreUsuario,
    id_usuario: response.body?.data?.usuario?.id_usuario || null,
  });

  return {
    token: response.body.data.token,
    usuario: response.body.data.usuario,
  };
}

function loadPreviewDir(previewDir) {
  const resolvedDir = path.resolve(previewDir);
  for (const file of PREVIEW_REQUIRED_FILES) {
    const fullPath = path.join(resolvedDir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`No existe el archivo requerido del preview: ${fullPath}`);
    }
  }

  return {
    dir: resolvedDir,
    titulares: JSON.parse(fs.readFileSync(path.join(resolvedDir, 'payloads_titulares.json'), 'utf8')),
    dependientes: JSON.parse(fs.readFileSync(path.join(resolvedDir, 'payloads_dependientes.json'), 'utf8')),
    asignaciones: JSON.parse(fs.readFileSync(path.join(resolvedDir, 'payloads_asignaciones.json'), 'utf8')),
    reporte: JSON.parse(fs.readFileSync(path.join(resolvedDir, 'reporte_validacion.json'), 'utf8')),
  };
}

const EXEC_HEADER_ALIASES = new Map([
  ['EJECUTIVO', 'ejecutivo'],
  ['N CONVENIO', 'n_convenio'],
  ['BENEFACTOR', 'nombre_completo'],
  ['TITULAR', 'titular'],
  ['CI TITULAR', 'ci_titular'],
]);

function detectBenefactoresSheet(workbook) {
  const preferida = workbook.SheetNames.find((name) => normalizeUpper(name).includes('BENEFACTOR'));
  return preferida || workbook.SheetNames[0];
}

function loadExcelRowMap(excelPath, logger) {
  const workbook = XLSX.readFile(excelPath, { cellDates: false });
  const sheetName = detectBenefactoresSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('No se pudo encontrar una hoja valida en el Excel');
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });

  if (!rows.length) {
    throw new Error('El Excel no contiene filas');
  }

  const headerRow = rows[0];
  const mappedHeaders = headerRow.map((header) => {
    const normalized = normalizeHeader(header);
    return EXEC_HEADER_ALIASES.get(normalized) || normalized.toLowerCase();
  });

  const rowMap = new Map();
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    const rowNumber = index + 1;
    const obj = { row_number: rowNumber };
    mappedHeaders.forEach((key, idx) => {
      obj[key] = values[idx];
    });
    rowMap.set(rowNumber, {
      row_number: rowNumber,
      ejecutivo: normalizeUpper(obj.ejecutivo),
      convenio_excel: normalizeUpper(obj.n_convenio),
      convenio_prefix: extractConvenioPrefix(obj.n_convenio),
      nombre_completo: normalizeUpper(obj.nombre_completo),
      titular_nombre: normalizeUpper(obj.titular),
      titular_cedula: normalizeUpper(obj.ci_titular),
    });
  }

  logger.info('Excel cargado para metadata de ejecucion', {
    hoja: sheetName,
    filas: rowMap.size,
  });

  return { sheetName, rowMap };
}

function buildExecutableRows(previewData, rowMap, key) {
  return (previewData?.data || []).map((item) => {
    const meta = rowMap.get(item.row_number) || {};
    return {
      ...item,
      ejecutivo: meta.ejecutivo || null,
      convenio_prefix: meta.convenio_prefix || extractConvenioPrefix(item.convenio_excel),
      username_info: sanitizeUsername(meta.ejecutivo || ''),
      phase_key: key,
    };
  });
}

function summarizeStatuses(rows) {
  return rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, { total: 0 });
}

function collectExecutives(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.ejecutivo) continue;
    const current = map.get(row.ejecutivo) || {
      ejecutivo_excel: row.ejecutivo,
      username_info: row.username_info,
      convenio_prefixes: new Set(),
      rows: [],
    };
    if (row.convenio_prefix) current.convenio_prefixes.add(row.convenio_prefix);
    current.rows.push(row.row_number);
    map.set(row.ejecutivo, current);
  }

  return Array.from(map.values()).map((entry) => ({
    ejecutivo_excel: entry.ejecutivo_excel,
    username_info: entry.username_info,
    convenio_prefixes: Array.from(entry.convenio_prefixes).sort(),
    rows: entry.rows.sort((a, b) => a - b),
  }));
}

function buildPreflight({ titulares, dependientes, asignaciones, ignoreBlocked = false }) {
  const allRows = [...titulares, ...dependientes];
  const blockedRows = allRows.filter((row) => row.status === 'bloqueada');
  const rowsWithoutExecutive = allRows.filter((row) => !row.ejecutivo);
  const invalidExecutives = allRows
    .filter((row) => row.ejecutivo && !row.username_info?.isValid)
    .map((row) => ({
      row_number: row.row_number,
      ejecutivo: row.ejecutivo,
      username_generado: row.username_info?.username || '',
    }));

  const executives = collectExecutives(allRows);
  const executivesWithMultiplePrefixes = executives
    .filter((item) => item.convenio_prefixes.length > 1)
    .map((item) => ({
      ejecutivo: item.ejecutivo_excel,
      convenio_prefixes: item.convenio_prefixes,
    }));
  const executivesWithoutPrefix = executives
    .filter((item) => item.convenio_prefixes.length === 0)
    .map((item) => ({
      ejecutivo: item.ejecutivo_excel,
    }));

  const rowByNumber = new Map(allRows.map((row) => [row.row_number, row]));
  const assignmentConflicts = [];
  for (const assignment of asignaciones?.data || []) {
    const titularRow = rowByNumber.get(assignment?.correlacion?.titular_row_number);
    const dependienteRow = rowByNumber.get(assignment?.correlacion?.dependiente_row_number);
    if (!titularRow || !dependienteRow) continue;
    if (titularRow.ejecutivo !== dependienteRow.ejecutivo) {
      assignmentConflicts.push({
        titular_row_number: titularRow.row_number,
        titular_ejecutivo: titularRow.ejecutivo,
        dependiente_row_number: dependienteRow.row_number,
        dependiente_ejecutivo: dependienteRow.ejecutivo,
      });
    }
  }

  const fatals = [];
  if (!ignoreBlocked && blockedRows.length > 0) {
    fatals.push(`Existen ${blockedRows.length} filas bloqueadas en el preview`);
  }
  if (rowsWithoutExecutive.length > 0) {
    fatals.push(`Existen ${rowsWithoutExecutive.length} filas sin ejecutivo resoluble`);
  }
  if (invalidExecutives.length > 0) {
    fatals.push(`Existen ${invalidExecutives.length} filas con ejecutivo no valido para usuario del sistema`);
  }
  if (executivesWithMultiplePrefixes.length > 0) {
    fatals.push(`Existen ${executivesWithMultiplePrefixes.length} ejecutivos con mas de un prefijo de sucursal`);
  }
  if (executivesWithoutPrefix.length > 0) {
    fatals.push(`Existen ${executivesWithoutPrefix.length} ejecutivos sin prefijo de convenio resoluble`);
  }
  if (assignmentConflicts.length > 0) {
    fatals.push(`Existen ${assignmentConflicts.length} asignaciones titular/dependiente con ejecutivos distintos`);
  }

  return {
    executives,
    blockedRows,
    rowsWithoutExecutive,
    invalidExecutives,
    executivesWithMultiplePrefixes,
    executivesWithoutPrefix,
    assignmentConflicts,
    fatals,
    resumen: {
      titulares: summarizeStatuses(titulares),
      dependientes: summarizeStatuses(dependientes),
      asignaciones: {
        total: (asignaciones?.data || []).length,
      },
    },
  };
}

async function ensureKeeperUser(client, keeperUsername) {
  const result = await client.query(
    `SELECT id_usuario, nombre_usuario, id_sucursal
     FROM usuarios
     WHERE UPPER(TRIM(nombre_usuario)) = $1
     LIMIT 1`,
    [normalizeUpper(keeperUsername)]
  );

  if (!result.rows.length) {
    throw new Error(`No existe el usuario a preservar: ${keeperUsername}`);
  }

  return result.rows[0];
}

async function ensureSucursal(client, prefix, logger) {
  const normalizedPrefix = normalizeUpper(prefix);
  const existing = await client.query(
    `SELECT id_sucursal, iniciales, nombre
     FROM sucursales
     WHERE UPPER(TRIM(iniciales)) = $1
     LIMIT 1`,
    [normalizedPrefix]
  );

  if (existing.rows.length) {
    return existing.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO sucursales (iniciales, nombre, activo)
     VALUES ($1, $2, TRUE)
     RETURNING id_sucursal, iniciales, nombre`,
    [normalizedPrefix, `Sucursal ${normalizedPrefix}`]
  );

  logger.info('Sucursal creada para la carga', inserted.rows[0]);
  return inserted.rows[0];
}

async function cleanupAndProvisionUsers(client, keeperUser, executives, logger) {
  const summary = {
    keeper_user: keeperUser.nombre_usuario,
    usuarios_previos: 0,
    usuarios_eliminados: 0,
    usuarios_creados: 0,
    sucursales_creadas: 0,
  };

  const usersCount = await client.query('SELECT COUNT(*)::int AS total FROM usuarios');
  summary.usuarios_previos = usersCount.rows[0]?.total || 0;

  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM notificaciones');
    await client.query('UPDATE documentos_beneficiario_social SET id_usuario = NULL WHERE id_usuario IS NOT NULL AND id_usuario <> $1', [keeperUser.id_usuario]);
    await client.query('UPDATE seguimiento_social SET id_usuario = $1 WHERE id_usuario <> $1', [keeperUser.id_usuario]);
    await client.query('UPDATE aprobaciones_beneficiarios_sociales SET id_admin = $1 WHERE id_admin <> $1', [keeperUser.id_usuario]);
    await client.query('UPDATE beneficiarios_sociales SET id_usuario_carga = $1 WHERE id_usuario_carga <> $1', [keeperUser.id_usuario]);

    await client.query('TRUNCATE TABLE lotes_importacion RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE grupos_cobro_externo RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE benefactores RESTART IDENTITY CASCADE');

    await client.query('DELETE FROM permisos_usuario WHERE id_usuario <> $1', [keeperUser.id_usuario]);
    const deletedUsers = await client.query('DELETE FROM usuarios WHERE id_usuario <> $1 RETURNING id_usuario', [keeperUser.id_usuario]);
    summary.usuarios_eliminados = deletedUsers.rowCount;

    const userMap = new Map();
    userMap.set(normalizeUpper(keeperUser.nombre_usuario), {
      id_usuario: keeperUser.id_usuario,
      nombre_usuario: keeperUser.nombre_usuario,
      preserved: true,
      id_sucursal: keeperUser.id_sucursal || null,
    });

    const createdSucursales = new Set();

    for (const executive of executives) {
      const username = executive.username_info.username;
      if (normalizeUpper(username) === normalizeUpper(keeperUser.nombre_usuario)) {
        continue;
      }

      const prefix = executive.convenio_prefixes[0];
      const sucursal = await ensureSucursal(client, prefix, logger);
      if (!createdSucursales.has(sucursal.id_sucursal)) {
        createdSucursales.add(sucursal.id_sucursal);
      }

      const passwordHash = await bcrypt.hash(username, 10);
      const created = await client.query(
        `INSERT INTO usuarios (nombre_usuario, password_hash, cargo, activo, id_sucursal)
         VALUES ($1, $2, 'EJECUTIVO', TRUE, $3)
         RETURNING id_usuario, nombre_usuario, id_sucursal`,
        [username, passwordHash, sucursal.id_sucursal]
      );

      await client.query(
        `INSERT INTO permisos_usuario (
          id_usuario,
          cartera_lectura,
          cartera_escritura,
          benefactores_ingresar,
          benefactores_administrar,
          social_ingresar,
          social_administrar,
          configuraciones,
          aprobaciones,
          aprobaciones_social
        ) VALUES ($1, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)`,
        [created.rows[0].id_usuario]
      );

      userMap.set(normalizeUpper(username), {
        ...created.rows[0],
        preserved: false,
      });
      summary.usuarios_creados += 1;
    }

    summary.sucursales_creadas = createdSucursales.size;

    await client.query('COMMIT');
    return { summary, userMap };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function createApiSessionMap(baseUrl, adminUser, adminPass, executives, logger) {
  const sessions = new Map();

  const adminSession = await login(baseUrl, adminUser, adminPass, logger);
  sessions.set(normalizeUpper(adminUser), adminSession);

  for (const executive of executives) {
    const username = executive.username_info.username;
    const normalized = normalizeUpper(username);
    if (sessions.has(normalized)) continue;
    const session = await login(baseUrl, username, username, logger);
    sessions.set(normalized, session);
  }

  return sessions;
}

async function apiCreateBenefactor(baseUrl, token, payload) {
  return requestJson(`${baseUrl}/api/benefactores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

async function apiAsignarDependiente(baseUrl, token, payload) {
  return requestJson(`${baseUrl}/api/benefactores/asignar-dependiente`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

async function executeCarga({
  baseUrl,
  adminUser,
  adminPass,
  titulares,
  dependientes,
  asignaciones,
  preflight,
  outputDir,
  logger,
}) {
  const execution = {
    started_at: new Date().toISOString(),
    created_titulares: [],
    created_dependientes: [],
    asignaciones_ok: [],
    errores: [],
  };

  const client = await pool.connect();
  try {
    const keeperUser = await ensureKeeperUser(client, KEEPER_USER);
    logger.info('Usuario preservado confirmado', keeperUser);

    const provision = await cleanupAndProvisionUsers(client, keeperUser, preflight.executives, logger);
    execution.user_cleanup = provision.summary;
    writeJson(
      path.join(outputDir, 'usuarios_provisionados.json'),
      Array.from(provision.userMap.values()).map((item) => ({
        id_usuario: item.id_usuario,
        nombre_usuario: item.nombre_usuario,
        id_sucursal: item.id_sucursal,
        preserved: item.preserved,
      }))
    );

    const sessions = await createApiSessionMap(baseUrl, adminUser, adminPass, preflight.executives, logger);
    const createdByRow = new Map();

    const rowsToCreateTitulares = titulares.filter((row) => row.status !== 'bloqueada');
    const rowsToCreateDependientes = dependientes.filter((row) => row.status !== 'bloqueada');

    logger.info('Creando titulares por API', { total: rowsToCreateTitulares.length });
    for (const row of rowsToCreateTitulares) {
      const username = row.username_info.username;
      const session = sessions.get(normalizeUpper(username));
      if (!session) {
        throw new Error(`No existe sesion API para el ejecutivo ${username} en fila ${row.row_number}`);
      }

      const response = await apiCreateBenefactor(baseUrl, session.token, row.payload);
      if (!response.ok || !response.body?.success || !response.body?.data?.id_benefactor) {
        const errorEntry = {
          phase: 'titulares',
          row_number: row.row_number,
          ejecutivo: row.ejecutivo,
          status: response.status,
          body: response.body,
        };
        execution.errores.push(errorEntry);
        throw new Error(`Fallo creando titular en fila ${row.row_number}: ${response.body?.message || response.status}`);
      }

      const created = response.body.data;
      createdByRow.set(row.row_number, created);
      execution.created_titulares.push({
        row_number: row.row_number,
        ejecutivo: row.ejecutivo,
        id_benefactor: created.id_benefactor,
        nombre_completo: created.nombre_completo,
        cedula: created.cedula,
        n_convenio: created.n_convenio,
      });
    }
    writeJson(path.join(outputDir, 'created_titulares.json'), execution.created_titulares);

    logger.info('Creando dependientes por API', { total: rowsToCreateDependientes.length });
    for (const row of rowsToCreateDependientes) {
      const username = row.username_info.username;
      const session = sessions.get(normalizeUpper(username));
      if (!session) {
        throw new Error(`No existe sesion API para el ejecutivo ${username} en fila ${row.row_number}`);
      }

      const response = await apiCreateBenefactor(baseUrl, session.token, row.payload);
      if (!response.ok || !response.body?.success || !response.body?.data?.id_benefactor) {
        const errorEntry = {
          phase: 'dependientes',
          row_number: row.row_number,
          ejecutivo: row.ejecutivo,
          status: response.status,
          body: response.body,
        };
        execution.errores.push(errorEntry);
        throw new Error(`Fallo creando dependiente en fila ${row.row_number}: ${response.body?.message || response.status}`);
      }

      const created = response.body.data;
      createdByRow.set(row.row_number, created);
      execution.created_dependientes.push({
        row_number: row.row_number,
        ejecutivo: row.ejecutivo,
        id_benefactor: created.id_benefactor,
        nombre_completo: created.nombre_completo,
        cedula: created.cedula,
        n_convenio: created.n_convenio,
      });
    }
    writeJson(path.join(outputDir, 'created_dependientes.json'), execution.created_dependientes);

    logger.info('Asignando dependientes a titulares', { total: (asignaciones?.data || []).length });
    for (const item of asignaciones?.data || []) {
      if (item.status === 'bloqueada') {
        continue;
      }

      const titularRowNumber = item?.correlacion?.titular_row_number;
      const dependienteRowNumber = item?.correlacion?.dependiente_row_number;
      const titularCreated = createdByRow.get(titularRowNumber);
      const dependienteCreated = createdByRow.get(dependienteRowNumber);

      if (!titularCreated || !dependienteCreated) {
        if (item.status === 'bloqueada') continue;
        const errorEntry = {
          phase: 'asignaciones',
          row_number: item.row_number,
          titular_row_number: titularRowNumber,
          dependiente_row_number: dependienteRowNumber,
          message: 'Titular o dependiente no creado previamente',
        };
        execution.errores.push(errorEntry);
        throw new Error(`No se pudo resolver la asignacion de la fila ${item.row_number}`);
      }

      const titularRow = titulares.find((row) => row.row_number === titularRowNumber)
        || dependientes.find((row) => row.row_number === titularRowNumber);
      const session = sessions.get(normalizeUpper(titularRow?.username_info?.username || ''));
      if (!session) {
        throw new Error(`No existe sesion API para la asignacion de la fila ${item.row_number}`);
      }

      const response = await apiAsignarDependiente(baseUrl, session.token, {
        id_titular: titularCreated.id_benefactor,
        id_dependiente: dependienteCreated.id_benefactor,
      });

      if (!response.ok || !response.body?.success) {
        const errorEntry = {
          phase: 'asignaciones',
          row_number: item.row_number,
          status: response.status,
          body: response.body,
        };
        execution.errores.push(errorEntry);
        throw new Error(`Fallo asignando dependiente de la fila ${item.row_number}: ${response.body?.message || response.status}`);
      }

      execution.asignaciones_ok.push({
        row_number: item.row_number,
        id_titular: titularCreated.id_benefactor,
        id_dependiente: dependienteCreated.id_benefactor,
      });
    }
    writeJson(path.join(outputDir, 'asignaciones_ok.json'), execution.asignaciones_ok);

    execution.finished_at = new Date().toISOString();
    execution.resumen = {
      titulares_creados: execution.created_titulares.length,
      dependientes_creados: execution.created_dependientes.length,
      asignaciones_ok: execution.asignaciones_ok.length,
      errores: execution.errores.length,
    };
    writeJson(path.join(outputDir, 'execution-report.json'), execution);

    return execution;
  } finally {
    client.release();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  required('baseUrl', args.baseUrl);
  required('adminUser', args.adminUser);
  required('adminPass', args.adminPass);
  required('excel', args.excel);
  required('previewDir', args.previewDir);

  const execute = toBoolean(args.execute, false);
  const verbose = toBoolean(args.verbose, false);
  const ignoreBlocked = toBoolean(args.ignoreBlocked, false);
  const outputDir = path.resolve(
    args.outputDir
      || path.join(__dirname, 'output', `load-benefactores-${timestampForPath()}`)
  );

  ensureDir(outputDir);
  const logFile = path.join(outputDir, 'load.log');
  const writeLine = (line) => fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  const logger = createLogger({ verbose, writeLine });

  logger.info('Inicio del cargador masivo', {
    baseUrl: args.baseUrl,
    excel: path.resolve(args.excel),
    previewDir: path.resolve(args.previewDir),
    execute,
    ignoreBlocked,
    outputDir,
  });

  if (execute && String(args.confirm || '').trim() !== CONFIRM_TEXT) {
    throw new Error(
      `Confirmacion invalida. Para ejecutar de verdad debes pasar --confirm ${CONFIRM_TEXT}`
    );
  }

  const preview = loadPreviewDir(args.previewDir);
  const { rowMap, sheetName } = loadExcelRowMap(path.resolve(args.excel), logger);
  const titulares = buildExecutableRows(preview.titulares, rowMap, 'titulares');
  const dependientes = buildExecutableRows(preview.dependientes, rowMap, 'dependientes');
  const preflight = buildPreflight({
    titulares,
    dependientes,
    asignaciones: preview.asignaciones,
    ignoreBlocked,
  });

  const preflightReport = {
    generated_at: new Date().toISOString(),
    sheetName,
    preview_dir: preview.dir,
    execute,
    ignoreBlocked,
    resumen: preflight.resumen,
    fatals: preflight.fatals,
    blocked_rows: preflight.blockedRows.slice(0, 100),
    invalid_executives: preflight.invalidExecutives,
    executives_with_multiple_prefixes: preflight.executivesWithMultiplePrefixes,
    executives_without_prefix: preflight.executivesWithoutPrefix,
    assignment_conflicts: preflight.assignmentConflicts.slice(0, 100),
    executives: preflight.executives.map((item) => ({
      ejecutivo_excel: item.ejecutivo_excel,
      username: item.username_info.username,
      username_valido: item.username_info.isValid,
      convenio_prefixes: item.convenio_prefixes,
      rows_count: item.rows.length,
    })),
  };
  writeJson(path.join(outputDir, 'preflight-report.json'), preflightReport);

  logger.info('Preflight completado', {
    titulares: preflight.resumen.titulares,
    dependientes: preflight.resumen.dependientes,
    fatals: preflight.fatals.length,
    ejecutivos: preflight.executives.length,
  });

  if (preflight.fatals.length > 0) {
    logger.error('La carga no puede continuar por errores de preflight', {
      fatals: preflight.fatals,
    });
    console.log('\n=== PRECHECK FALLIDO ===');
    preflight.fatals.forEach((fatal) => console.log(`- ${fatal}`));
    console.log(`\nRevisa: ${path.join(outputDir, 'preflight-report.json')}`);
    process.exitCode = 1;
    return;
  }

  if (!execute) {
    console.log('\n=== DRY RUN COMPLETADO ===');
    console.log(`Hoja: ${sheetName}`);
    console.log(`Ejecutivos detectados: ${preflight.executives.length}`);
    console.log(`Titulares listos: ${(titulares.filter((row) => row.status !== 'bloqueada')).length}`);
    console.log(`Dependientes listos: ${(dependientes.filter((row) => row.status !== 'bloqueada')).length}`);
    console.log(`Confirmacion requerida para ejecutar: ${CONFIRM_TEXT}`);
    console.log(`Reporte: ${path.join(outputDir, 'preflight-report.json')}`);
    return;
  }

  const execution = await executeCarga({
    baseUrl: args.baseUrl,
    adminUser: args.adminUser,
    adminPass: args.adminPass,
    titulares,
    dependientes,
    asignaciones: preview.asignaciones,
    preflight,
    outputDir,
    logger,
  });

  console.log('\n=== CARGA COMPLETADA ===');
  console.log(`Titulares creados: ${execution.resumen.titulares_creados}`);
  console.log(`Dependientes creados: ${execution.resumen.dependientes_creados}`);
  console.log(`Asignaciones OK: ${execution.resumen.asignaciones_ok}`);
  console.log(`Errores: ${execution.resumen.errores}`);
  console.log(`Reporte: ${path.join(outputDir, 'execution-report.json')}`);
}

main()
  .catch((error) => {
    console.error('[load:error]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_error) {
      // noop
    }
  });
