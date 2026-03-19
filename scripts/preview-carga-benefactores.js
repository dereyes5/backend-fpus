#!/usr/bin/env node

/**
 * Previsualizacion segura de carga de benefactores desde Excel.
 *
 * Lee el archivo, hace login contra la API y genera payloads/reporte
 * sin insertar nada en la base ni llamar POST /benefactores.
 *
 * Uso:
 * node scripts/preview-carga-benefactores.js ^
 *   --baseUrl http://localhost:3000 ^
 *   --user MZAMBRANO ^
 *   --pass TU_PASSWORD ^
 *   --excel C:\ruta\benefactores.xlsx
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_TIMEOUT_MS = 20000;
const PREVIEW_SAMPLE_ROWS = 5;

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

function createLogger({ verbose = false, writeLine = null } = {}) {
  const emit = (level, message, data) => {
    const suffix = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    const line = `[preview:${level}] ${message}${suffix}`;
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

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  if (!normalized || normalized === '-' || normalized === 'N/A') return null;
  return normalized;
}

function normalizeUpperNullableString(value) {
  const normalized = normalizeNullableString(value);
  return normalized ? stripAccents(normalized).toUpperCase() : null;
}

function normalizeEmail(value) {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  if (normalized === '-') return null;
  return normalized.toLowerCase();
}

function normalizePhone(value) {
  const normalized = normalizeNullableString(value);
  return normalized;
}

function normalizeCedula(value) {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  const digits = normalized.replace(/[^\dA-Za-z]/g, '');
  return digits || null;
}

function normalizeCurrency(value) {
  const normalized = normalizeString(value);
  if (!normalized || normalized === '-') return 0;
  const sanitized = normalized.replace(/\$/g, '').replace(/,/g, '').trim();
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeConvenio(value) {
  const normalized = normalizeNullableString(value);
  return normalized ? stripAccents(normalized).toUpperCase() : null;
}

function parseDate(value) {
  const normalized = normalizeString(value);
  if (!normalized || normalized === '-') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeMesProd(value) {
  const normalized = normalizeString(value);
  if (!normalized || normalized === '-') return null;
  const match = normalized.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return normalized;
  return `${String(match[1]).padStart(2, '0')}/${match[2]}`;
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

function csvEscape(value) {
  const normalized = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

const HEADER_ALIASES = new Map([
  ['TIPO DE AFILIACION', 'tipo_afiliacion'],
  ['CUENTA', 'tipo_benefactor'],
  ['EJECUTIVO', 'ejecutivo'],
  ['N CONVENIO', 'n_convenio'],
  ['MES PROD', 'mes_prod'],
  ['FECHA DE SUSCRIPCION', 'fecha_suscripcion'],
  ['BENEFACTOR', 'nombre_completo'],
  ['N CEDULA', 'cedula'],
  ['NACIONALIDAD', 'nacionalidad'],
  ['ESTADO CIVIL', 'estado_civil'],
  ['FECHA DE NACIMIENTO', 'fecha_nacimiento'],
  ['DIRECCION', 'direccion'],
  ['CIUDAD', 'ciudad'],
  ['PROVINCIA', 'provincia'],
  ['TELEFONO', 'telefono'],
  ['EMAIL', 'email'],
  ['N CUENTA T C', 'num_cuenta_tc'],
  ['TIPO DE CUENTA', 'tipo_cuenta'],
  ['BANCO EMISIOR', 'banco_emisor'],
  ['BANCO EMISOR', 'banco_emisor'],
  ['TITULAR', 'titular_nombre_excel'],
  ['CI TITULAR', 'titular_cedula_excel'],
  ['INSCRIPCION', 'inscripcion'],
  ['APORTE', 'aporte'],
  ['OBSERVACION', 'observacion'],
  ['DIA', 'dia'],
  ['MES2', 'mes2'],
  ['ANO2', 'anio2'],
  ['AÑO2', 'anio2'],
  ['ESTADO', 'estado'],
]);

function mapRowKeys(rawRow) {
  const mapped = {};

  for (const [originalKey, value] of Object.entries(rawRow)) {
    const normalizedKey = normalizeHeader(originalKey);
    const targetKey = HEADER_ALIASES.get(normalizedKey);
    if (targetKey) {
      mapped[targetKey] = value;
    }
  }

  return mapped;
}

function convenioObservation(convenio, expectedPrefix, duplicatesInFile) {
  if (!convenio) return 'faltante';
  if (!/^[A-Z]+[0-9]+$/.test(convenio)) return 'prefijo_invalido';
  if (duplicatesInFile.has(convenio)) return 'duplicado_en_excel';
  if (expectedPrefix && !convenio.startsWith(expectedPrefix)) return 'posible_conflicto_con_regla_backend';
  return 'ok';
}

function buildWarningsAndErrors(row) {
  const errors = [];
  const warnings = [];

  if (!row.nombre_completo) errors.push('nombre_completo_faltante');
  if (!row.tipo_benefactor) errors.push('tipo_benefactor_faltante');
  if (!row.tipo_afiliacion) errors.push('tipo_afiliacion_faltante');
  if (!row.estado) warnings.push('estado_faltante');
  if (!row.cedula) warnings.push('cedula_faltante');

  if (row.tipo_benefactor && !['TITULAR', 'DEPENDIENTE'].includes(row.tipo_benefactor)) {
    errors.push('tipo_benefactor_invalido');
  }

  if (row.tipo_afiliacion && !['INDIVIDUAL', 'CORPORATIVO'].includes(row.tipo_afiliacion)) {
    errors.push('tipo_afiliacion_invalido');
  }

  if (row.tipo_afiliacion === 'CORPORATIVO' && !row.corporacion) {
    errors.push('corporacion_obligatoria');
  }

  if (row.tipo_benefactor === 'DEPENDIENTE') {
    if (!row.titular_cedula_excel) {
      errors.push('dependiente_sin_ci_titular');
    }

    if (row.num_cuenta_tc || row.tipo_cuenta || row.banco_emisor || row.cuenta_bancaria) {
      warnings.push('dependiente_con_datos_bancarios_en_excel');
    }
  }

  if (row.tipo_benefactor === 'TITULAR' && row.num_cuenta_tc && !row.cuenta_bancaria) {
    warnings.push('excel_solo_trae_n_cuenta_t_c_y_no_cuenta_bancaria_separada');
  }

  if (row.fecha_nacimiento_raw && !row.fecha_nacimiento) {
    warnings.push('fecha_nacimiento_invalida');
  }

  if (row.fecha_suscripcion_raw && !row.fecha_suscripcion) {
    warnings.push('fecha_suscripcion_invalida');
  }

  if (Number.isNaN(row.inscripcion)) errors.push('inscripcion_invalida');
  if (Number.isNaN(row.aporte)) errors.push('aporte_invalido');

  return { errors, warnings };
}

function buildPayload(row) {
  const payload = {
    tipo_benefactor: row.tipo_benefactor,
    tipo_afiliacion: row.tipo_afiliacion ? row.tipo_afiliacion.toLowerCase() : undefined,
    mes_prod: row.mes_prod || undefined,
    fecha_suscripcion: row.fecha_suscripcion || undefined,
    nombre_completo: row.nombre_completo || undefined,
    cedula: row.cedula || undefined,
    nacionalidad: row.nacionalidad || undefined,
    estado_civil: row.estado_civil || undefined,
    fecha_nacimiento: row.fecha_nacimiento || undefined,
    direccion: row.direccion || undefined,
    ciudad: row.ciudad || undefined,
    provincia: row.provincia || undefined,
    telefono: row.telefono || undefined,
    email: row.email || undefined,
    inscripcion: Number.isNaN(row.inscripcion) ? undefined : row.inscripcion,
    aporte: Number.isNaN(row.aporte) ? undefined : row.aporte,
    observacion: row.observacion || undefined,
    estado: row.estado || undefined,
  };

  if (row.tipo_afiliacion === 'CORPORATIVO') {
    payload.corporacion = row.corporacion || undefined;
  }

  if (row.tipo_benefactor === 'TITULAR') {
    payload.cuenta = row.cuenta_bancaria || undefined;
    payload.num_cuenta_tc = row.num_cuenta_tc || undefined;
    payload.tipo_cuenta = row.tipo_cuenta || undefined;
    payload.banco_emisor = row.banco_emisor || undefined;
  }

  return payload;
}

function sanitizeForPayload(rawRow, rowNumber) {
  const tipoBenefactor = normalizeUpperNullableString(rawRow.tipo_benefactor);
  const tipoAfiliacion = normalizeUpperNullableString(rawRow.tipo_afiliacion);
  const cuentaBancaria = normalizeNullableString(rawRow.cuenta_bancaria);

  const row = {
    row_number: rowNumber,
    ejecutivo_excel: normalizeNullableString(rawRow.ejecutivo),
    tipo_benefactor: tipoBenefactor,
    tipo_afiliacion: tipoAfiliacion,
    n_convenio: normalizeConvenio(rawRow.n_convenio),
    mes_prod: normalizeMesProd(rawRow.mes_prod),
    fecha_suscripcion_raw: normalizeNullableString(rawRow.fecha_suscripcion),
    fecha_suscripcion: parseDate(rawRow.fecha_suscripcion),
    nombre_completo: normalizeUpperNullableString(rawRow.nombre_completo),
    cedula: normalizeCedula(rawRow.cedula),
    nacionalidad: normalizeUpperNullableString(rawRow.nacionalidad),
    estado_civil: normalizeUpperNullableString(rawRow.estado_civil),
    fecha_nacimiento_raw: normalizeNullableString(rawRow.fecha_nacimiento),
    fecha_nacimiento: parseDate(rawRow.fecha_nacimiento),
    direccion: normalizeNullableString(rawRow.direccion),
    ciudad: normalizeUpperNullableString(rawRow.ciudad),
    provincia: normalizeUpperNullableString(rawRow.provincia),
    telefono: normalizePhone(rawRow.telefono),
    email: normalizeEmail(rawRow.email),
    cuenta_bancaria: cuentaBancaria,
    num_cuenta_tc: normalizeNullableString(rawRow.num_cuenta_tc),
    tipo_cuenta: normalizeUpperNullableString(rawRow.tipo_cuenta),
    banco_emisor: normalizeUpperNullableString(rawRow.banco_emisor),
    titular_nombre_excel: normalizeUpperNullableString(rawRow.titular_nombre_excel),
    titular_cedula_excel: normalizeCedula(rawRow.titular_cedula_excel),
    inscripcion: normalizeCurrency(rawRow.inscripcion),
    aporte: normalizeCurrency(rawRow.aporte),
    observacion: normalizeNullableString(rawRow.observacion),
    estado: normalizeUpperNullableString(rawRow.estado),
    dia: normalizeNullableString(rawRow.dia),
    mes2: normalizeNullableString(rawRow.mes2),
    anio2: normalizeNullableString(rawRow.anio2),
    corporacion: tipoAfiliacion === 'CORPORATIVO' ? normalizeUpperNullableString(rawRow.corporacion) : null,
  };

  return row;
}

function summarizeRows(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      if (row.tipo_benefactor === 'TITULAR') acc.titulares += 1;
      if (row.tipo_benefactor === 'DEPENDIENTE') acc.dependientes += 1;
      return acc;
    },
    { total: 0, titulares: 0, dependientes: 0 }
  );
}

async function main() {
  try {
    const args = parseArgs(process.argv);

    required('baseUrl', args.baseUrl);
    required('user', args.user);
    required('pass', args.pass);
    required('excel', args.excel);

    const baseUrl = String(args.baseUrl).replace(/\/$/, '');
    const excelPath = path.resolve(String(args.excel));
    const verbose = args.verbose === true || String(args.verbose || '').toLowerCase() === 'true';
    const outputDir = path.join(__dirname, 'output', `preview-benefactores-${timestampForPath()}`);
    ensureDir(outputDir);
    const logFilePath = path.join(outputDir, 'preview.log');
    const writeLogLine = (line) => fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
    const logger = createLogger({ verbose, writeLine: writeLogLine });

    logger.info('Inicio del preview', {
      baseUrl,
      excelPath,
      verbose,
      outputDir,
    });

    if (!fs.existsSync(excelPath)) {
      throw new Error(`No existe el archivo Excel: ${excelPath}`);
    }

    logger.info('Paso 1: login');
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        nombre_usuario: args.user,
        password: args.pass,
      }),
    });

    if (!login.ok || !login.body?.data?.token) {
      logger.error('Error en login', {
        status: login.status,
        body: login.body,
      });
      process.exit(1);
    }

    const token = login.body.data.token;
    const usuario = login.body.data.usuario || {};
    const authHeaders = { Authorization: `Bearer ${token}` };
    logger.info('Login exitoso', {
      id_usuario: usuario.id_usuario || null,
      nombre_usuario: usuario.nombre_usuario || null,
    });

    logger.info('Paso 2: obteniendo convenio de referencia');
    const convenioResponse = await requestJson(`${baseUrl}/api/benefactores/convenio/siguiente`, {
      method: 'GET',
      headers: authHeaders,
    });

    let convenioInfo = {
      n_convenio: null,
      iniciales_sucursal: null,
      error: null,
    };

    if (convenioResponse.ok) {
      convenioInfo = {
        n_convenio: convenioResponse.body?.data?.n_convenio || null,
        iniciales_sucursal: convenioResponse.body?.data?.iniciales_sucursal || null,
        error: null,
      };
    } else {
      convenioInfo.error = convenioResponse.body?.message || 'No se pudo consultar el siguiente convenio';
    }
    logger.info('Convenio de referencia consultado', convenioInfo);

    logger.info('Paso 3: leyendo Excel');
    const workbook = XLSX.readFile(excelPath, {
      raw: false,
      cellDates: false,
      dense: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El Excel no contiene hojas');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const headerRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    const rawHeaders = Array.isArray(headerRows[0]) ? headerRows[0] : [];
    const normalizedHeaders = rawHeaders.map((header) => ({
      original: header,
      normalized: normalizeHeader(header),
      mapped_to: HEADER_ALIASES.get(normalizeHeader(header)) || null,
    }));
    logger.info('Hoja detectada', { hoja: firstSheetName, total_columnas: rawHeaders.length });
    logger.debug('Encabezados detectados', normalizedHeaders);

    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
    });
    logger.info('Filas crudas leidas', { total: rawRows.length });
    logger.debug('Muestra de filas crudas', rawRows.slice(0, PREVIEW_SAMPLE_ROWS));

    const mappedRows = rawRows.map((row, index) => {
      const mapped = mapRowKeys(row);
      const sanitized = sanitizeForPayload(mapped, index + 2);
      if (index < PREVIEW_SAMPLE_ROWS) {
        logger.debug('Fila transformada', {
          row_number: index + 2,
          raw: row,
          mapped,
          sanitized,
        });
      }
      return sanitized;
    });
    logger.info('Filas transformadas', {
      total: mappedRows.length,
      titulares: mappedRows.filter((item) => item.tipo_benefactor === 'TITULAR').length,
      dependientes: mappedRows.filter((item) => item.tipo_benefactor === 'DEPENDIENTE').length,
    });

    const convenioCount = new Map();
    for (const row of mappedRows) {
      if (!row.n_convenio) continue;
      convenioCount.set(row.n_convenio, (convenioCount.get(row.n_convenio) || 0) + 1);
    }
    const duplicatedConvenios = new Set(
      [...convenioCount.entries()].filter(([, count]) => count > 1).map(([convenio]) => convenio)
    );

    const titularesByCedula = new Map();
    const titularesPreparados = [];
    const dependientesPreparados = [];
    const asignacionesPreparadas = [];
    const reportRows = [];

    const expectedPrefix = convenioInfo.iniciales_sucursal || null;
    logger.debug('Convenios duplicados en archivo', [...duplicatedConvenios]);

    logger.info('Paso 4: pasada de titulares');
    for (const row of mappedRows.filter((item) => item.tipo_benefactor === 'TITULAR')) {
      const { errors, warnings } = buildWarningsAndErrors(row);
      const payload = buildPayload(row);
      const convenioStatus = convenioObservation(row.n_convenio, expectedPrefix, duplicatedConvenios);
      const allWarnings = [...warnings];

      if (convenioStatus !== 'ok') {
        allWarnings.push(`convenio:${convenioStatus}`);
      }

      const status = errors.length > 0 ? 'bloqueada' : (allWarnings.length > 0 ? 'con_observaciones' : 'lista_para_api');

      const item = {
        row_number: row.row_number,
        tipo_benefactor: row.tipo_benefactor,
        nombre_completo: row.nombre_completo,
        cedula: row.cedula,
        convenio_excel: row.n_convenio,
        convenio_esperado_backend: convenioInfo.n_convenio,
        observacion_convenio: convenioStatus,
        status,
        errors,
        warnings: allWarnings,
        payload,
        correlacion: {
          titular_cedula: row.cedula,
          titular_convenio_excel: row.n_convenio,
        },
      };

      reportRows.push(item);
      titularesPreparados.push(item);
      logger.debug('Titular procesado', {
        row_number: item.row_number,
        status: item.status,
        convenio_excel: item.convenio_excel,
        errors: item.errors,
        warnings: item.warnings,
      });

      if (row.cedula) {
        titularesByCedula.set(row.cedula, {
          row_number: row.row_number,
          nombre_completo: row.nombre_completo,
          cedula: row.cedula,
          convenio_excel: row.n_convenio,
          payload,
          status,
        });
      }
    }
    logger.info('Resumen pasada titulares', summarizeRows(titularesPreparados));

    logger.info('Paso 5: pasada de dependientes');
    for (const row of mappedRows.filter((item) => item.tipo_benefactor === 'DEPENDIENTE')) {
      const { errors, warnings } = buildWarningsAndErrors(row);
      const titular = row.titular_cedula_excel ? titularesByCedula.get(row.titular_cedula_excel) : null;
      const payload = buildPayload(row);
      const convenioStatus = convenioObservation(row.n_convenio, expectedPrefix, duplicatedConvenios);
      const allWarnings = [...warnings];

      if (convenioStatus !== 'ok') {
        allWarnings.push(`convenio:${convenioStatus}`);
      }

      if (!titular) {
        errors.push('titular_no_resuelto_en_excel');
      }

      const status = errors.length > 0 ? 'bloqueada' : (allWarnings.length > 0 ? 'con_observaciones' : 'lista_para_api');

      const item = {
        row_number: row.row_number,
        tipo_benefactor: row.tipo_benefactor,
        nombre_completo: row.nombre_completo,
        cedula: row.cedula,
        convenio_excel: row.n_convenio,
        convenio_esperado_backend: convenioInfo.n_convenio,
        observacion_convenio: convenioStatus,
        status,
        errors,
        warnings: allWarnings,
        payload,
        correlacion: {
          dependiente_cedula: row.cedula,
          titular_cedula_excel: row.titular_cedula_excel,
          titular_nombre_excel: row.titular_nombre_excel,
        },
        dependencia_previa: titular
          ? {
              titular_row_number: titular.row_number,
              titular_cedula: titular.cedula,
              titular_nombre: titular.nombre_completo,
              titular_convenio_excel: titular.convenio_excel,
            }
          : null,
      };

      reportRows.push(item);
      dependientesPreparados.push(item);
      logger.debug('Dependiente procesado', {
        row_number: item.row_number,
        status: item.status,
        convenio_excel: item.convenio_excel,
        titular_cedula_excel: row.titular_cedula_excel,
        titular_resuelto: Boolean(titular),
        errors: item.errors,
        warnings: item.warnings,
      });

      if (titular) {
        asignacionesPreparadas.push({
          status,
          row_number: row.row_number,
          tipo: 'asignar_dependiente',
          correlacion: {
            titular_row_number: titular.row_number,
            titular_cedula: titular.cedula,
            dependiente_row_number: row.row_number,
            dependiente_cedula: row.cedula,
          },
          payload_estimado: {
            id_titular: '__RESOLVER_TRAS_CREACION__',
            id_dependiente: '__RESOLVER_TRAS_CREACION__',
          },
        });
      }
    }
    logger.info('Resumen pasada dependientes', summarizeRows(dependientesPreparados));

    const resumen = {
      archivo_excel: excelPath,
      hoja: firstSheetName,
      usuario_autenticado: {
        id_usuario: usuario.id_usuario || null,
        nombre_usuario: usuario.nombre_usuario || null,
        cargo: usuario.cargo || null,
      },
      convenio_referencia_backend: convenioInfo,
      columnas_detectadas: normalizedHeaders,
      resumen_titulares: summarizeRows(titularesPreparados),
      resumen_dependientes: summarizeRows(dependientesPreparados),
      resumen_total: summarizeRows(reportRows),
      generated_at: new Date().toISOString(),
      log_file: logFilePath,
    };

    writeJson(path.join(outputDir, 'payloads_titulares.json'), {
      resumen: resumen.resumen_titulares,
      data: titularesPreparados,
    });

    writeJson(path.join(outputDir, 'payloads_dependientes.json'), {
      resumen: resumen.resumen_dependientes,
      data: dependientesPreparados,
    });

    writeJson(path.join(outputDir, 'payloads_asignaciones.json'), {
      total: asignacionesPreparadas.length,
      data: asignacionesPreparadas,
    });

    writeJson(path.join(outputDir, 'reporte_validacion.json'), {
      resumen,
      data: reportRows,
    });

    writeCsv(
      path.join(outputDir, 'preview.csv'),
      reportRows.map((row) => ({
        row_number: row.row_number,
        tipo_benefactor: row.tipo_benefactor,
        nombre_completo: row.nombre_completo || '',
        cedula: row.cedula || '',
        convenio_excel: row.convenio_excel || '',
        observacion_convenio: row.observacion_convenio || '',
        status: row.status,
        errors: row.errors.join('|'),
        warnings: row.warnings.join('|'),
      }))
    );

    logger.info('Preview generado', {
      archivo: excelPath,
      hoja: firstSheetName,
      salida: outputDir,
      usuario_autenticado: usuario.nombre_usuario || 'N/A',
      convenio_referencia_backend: convenioInfo.n_convenio || 'N/A',
      titulares_preparados: titularesPreparados.length,
      dependientes_preparados: dependientesPreparados.length,
      asignaciones_preparadas: asignacionesPreparadas.length,
      total_filas_analizadas: reportRows.length,
    });

    console.log('\n=== PREVIEW CARGA BENEFATORES ===');
    console.log(`Archivo: ${excelPath}`);
    console.log(`Hoja: ${firstSheetName}`);
    console.log(`Salida: ${outputDir}`);
    console.log(`Log detallado: ${logFilePath}`);
    console.log(`Usuario autenticado: ${usuario.nombre_usuario || 'N/A'}`);
    console.log(`Convenio referencia backend: ${convenioInfo.n_convenio || 'N/A'}`);
    console.log(`Titulares preparados: ${titularesPreparados.length}`);
    console.log(`Dependientes preparados: ${dependientesPreparados.length}`);
    console.log(`Asignaciones preparadas: ${asignacionesPreparadas.length}`);
    console.log(`Total filas analizadas: ${reportRows.length}`);
  } catch (error) {
    console.error('ERROR preview-carga-benefactores:', error.message);
    process.exit(1);
  }
}

main();
