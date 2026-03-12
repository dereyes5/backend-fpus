#!/usr/bin/env node

/**
 * Diagnostico de discrepancias entre:
 * 1) POST /api/cobros/debitos/validar-preview
 * 2) GET  /api/cobros/estado/actual
 *
 * Uso:
 * node scripts/diagnostico-validar-preview.js \
 *   --baseUrl http://localhost:3000 \
 *   --user PRODRIGUEZ \
 *   --pass TU_PASSWORD \
 *   --mes 3 \
 *   --anio 2026 \
 *   --codigos SD6478,SD6575,SD64646
 */

const DEFAULT_TIMEOUT_MS = 20000;

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
    } catch (_e) {
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

function normalizeCode(code) {
  return (code || '').toString().trim().toUpperCase();
}

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

async function main() {
  try {
    const args = parseArgs(process.argv);

    required('baseUrl', args.baseUrl);
    required('user', args.user);
    required('pass', args.pass);
    required('mes', args.mes);
    required('anio', args.anio);
    required('codigos', args.codigos);

    const baseUrl = String(args.baseUrl).replace(/\/$/, '');
    const mes = Number(args.mes);
    const anio = Number(args.anio);

    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error('Mes invalido: use --mes entre 1 y 12');
    }

    if (!Number.isInteger(anio) || anio < 2000) {
      throw new Error('Anio invalido: use --anio valido (ej. 2026)');
    }

    const codigos = String(args.codigos)
      .split(',')
      .map(normalizeCode)
      .filter(Boolean);

    if (codigos.length === 0) {
      throw new Error('No hay codigos validos en --codigos');
    }

    console.log('1) Login...');
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        nombre_usuario: args.user,
        password: args.pass,
      }),
    });

    if (!login.ok || !login.body?.data?.token) {
      console.error('ERROR login:', login.status, login.body);
      process.exit(1);
    }

    const token = login.body.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    console.log('2) validar-preview...');
    const preview = await requestJson(`${baseUrl}/api/cobros/debitos/validar-preview`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        codigosTercero: codigos,
        mes,
        anio,
      }),
    });

    if (!preview.ok) {
      console.error('ERROR validar-preview:', preview.status, preview.body);
      process.exit(1);
    }

    console.log('3) estado/actual...');
    const estado = await requestJson(`${baseUrl}/api/cobros/estado/actual`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!estado.ok) {
      console.error('ERROR estado/actual:', estado.status, estado.body);
      process.exit(1);
    }

    const previewRows = Array.isArray(preview.body?.data) ? preview.body.data : [];
    const estadoRows = Array.isArray(estado.body?.data) ? estado.body.data : [];

    const previewSet = new Set(previewRows.map((r) => normalizeCode(r.cod_tercero)));

    const estadoPorConvenio = new Map();
    for (const row of estadoRows) {
      const convenio = normalizeCode(row.n_convenio);
      if (convenio) estadoPorConvenio.set(convenio, row);
    }

    console.log('\n=== DIAGNOSTICO ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Periodo: ${mes}/${anio}`);
    console.log(`Codigos analizados: ${codigos.join(', ')}`);
    console.log(`Filas devueltas por validar-preview: ${previewRows.length}`);

    const report = codigos.map((codigo) => {
      const p = previewSet.has(codigo);
      const e = estadoPorConvenio.get(codigo);
      const estadoCartera = e?.estado_cobro || e?.estado_aporte || 'NO_ENCONTRADO';

      return {
        codigo,
        previewBloquea: p ? 'SI' : 'NO',
        estadoCartera,
        montoEsperado: toMoney(e?.monto_esperado),
        montoAportado: toMoney(e?.monto_aportado),
        cobrosDebitados: Number(e?.cobros_debitados || 0),
        ultimaFecha: e?.ultima_fecha_aporte || 'N/A',
      };
    });

    console.table(report);

    const inconsistentes = report.filter(
      (r) => r.previewBloquea === 'SI' && r.estadoCartera !== 'APORTADO'
    );

    if (inconsistentes.length > 0) {
      console.log('\nINCONSISTENCIAS DETECTADAS (preview bloquea pero cartera no esta APORTADO):');
      console.table(inconsistentes);
    } else {
      console.log('\nSin inconsistencias de ese tipo en los codigos analizados.');
    }

    console.log('\nDetalle de filas que devolvio validar-preview:');
    console.log(JSON.stringify(previewRows, null, 2));
  } catch (error) {
    console.error('ERROR diagnostico:', error.message);
    process.exit(1);
  }
}

main();
