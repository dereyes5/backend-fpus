const XLSX = require('xlsx');
const crypto = require('crypto');
const pool = require('../config/database');

/**
 * Servicio de Importación de Excel Bancario
 * Maneja la importación y procesamiento de archivos Excel con débitos mensuales
 */

/**
 * Genera un hash SHA256 del contenido del archivo para detectar duplicados
 * @param {Buffer} buffer - Contenido del archivo
 * @returns {string} Hash SHA256 en formato hex
 */
const generarHashArchivo = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Normaliza el nombre de columna del Excel a formato estándar
 * @param {string} columna - Nombre de columna del Excel
 * @returns {string} Nombre normalizado
 */
const normalizarNombreColumna = (columna) => {
  if (!columna) return '';

  // Convertir a minúsculas y eliminar caracteres especiales
  let normalizado = columna.toString().toLowerCase()
    .replace(/\s+/g, '_')           // Espacios a guiones bajos
    .replace(/\./g, '_')            // Puntos a guiones bajos
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9_]/g, '')    // Eliminar caracteres no alfanuméricos
    .replace(/_+/g, '_')           // Colapsar múltiples guiones bajos
    .replace(/^_|_$/g, '');        // Quitar guiones al inicio/fin

  // Mapeo de nombres comunes del Excel a nombres estándar
  const mapeo = {
    // Estado del cobro
    'estado': 'estado',

    // Moneda
    'moneda': 'moneda',

    // Forma de pago — varios formatos
    'forma': 'forma_pago',
    'forma_pago': 'forma_pago',
    'formapago': 'forma_pago',

    // Valor cobrado
    'valor': 'valor_cobrado',
    'valor_cobrado': 'valor_cobrado',

    // Código de tercero (N° convenio) — Excel a veces trunca a "cod.tercer" o "cod_tercer"
    'cod_tercero': 'cod_tercero',
    'cod_tercer': 'cod_tercero',   // Truncado
    'codtercero': 'cod_tercero',
    'cod__tercero': 'cod_tercero',
    'cod_terc': 'cod_tercero',

    // Nombre tercero
    'nom_terc': 'nom_terc',
    'nomterc': 'nom_terc',
    'nom__terc': 'nom_terc',
    'nom_tercero': 'nom_terc',

    // Fecha transmisión — muchas variantes del Excel bancario
    'fecha_transmision': 'fecha_transmision',
    'fechatransmision': 'fecha_transmision',
    'fecha__transmision': 'fecha_transmision',
    'fch_transmision': 'fecha_transmision',
    'fch_transm': 'fecha_transmision',
    'fecha_tra': 'fecha_transmision',   // Truncado frecuente
    'fecha_transm': 'fecha_transmision',
    'fch_tra': 'fecha_transmision',
    'fecha_trasm': 'fecha_transmision',

    // Banco
    'banco': 'banco',
    'banco_pld': 'banco',              // Variante del encabezado real

    // Tipo de cuenta
    'tipo_cta': 'tipo_cuenta',
    'tipocta': 'tipo_cuenta',
    'tipo__cta': 'tipo_cuenta',
    'tipo_cuenta': 'tipo_cuenta',

    // Número de cuenta
    'num_cta': 'num_cuenta',
    'numcta': 'num_cuenta',
    'num__cta': 'num_cuenta',
    'num_cuenta': 'num_cuenta',

    // Fecha pago — muchas variantes
    'fch_pago': 'fecha_pago',
    'fchpago': 'fecha_pago',
    'fch__pago': 'fecha_pago',
    'fecha_pago': 'fecha_pago',
    'fechapago': 'fecha_pago',
    'fch_pago_26': 'fecha_pago',       // A veces el banco pone sufijo numérico
  };

  return mapeo[normalizado] || normalizado;
};

/**
 * Parsea una fecha del Excel (puede venir como número de serie, string, o Date)
 * @param {any} valor - Valor de fecha del Excel
 * @returns {Date|null} Fecha parseada o null
 */
const parsearFechaExcel = (valor) => {
  if (!valor) return null;

  // Si ya es una fecha
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? null : valor;
  }

  // Si es número de serie de Excel (días desde 1900-01-01)
  if (typeof valor === 'number') {
    const fecha = new Date((valor - 25569) * 86400 * 1000);
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  // Si es string, intentar parsear
  if (typeof valor === 'string') {
    const s = valor.trim();

    // Formato DD/MM/YYYY o DD-MM-YYYY (el más común en bancos ecuatorianos)
    const dmyMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return isNaN(fecha.getTime()) ? null : fecha;
    }

    // Formato YYYY-MM-DD (ISO)
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const fecha = new Date(s);
      return isNaN(fecha.getTime()) ? null : fecha;
    }

    // Último intento con el constructor nativo
    const fecha = new Date(s);
    if (!isNaN(fecha.getTime())) {
      return fecha;
    }
  }

  return null;
};

/**
 * Valida que el Excel tiene las columnas mínimas requeridas
 * @param {object} primeraFila - Primera fila del Excel
 * @returns {object} { valido: boolean, columnasEncontradas: string[], columnasFaltantes: string[] }
 */
const validarColumnasExcel = (primeraFila) => {
  const columnasRequeridas = [
    'estado',
    'cod_tercero',
    'fecha_transmision'
  ];

  const columnasExcel = Object.keys(primeraFila).map(normalizarNombreColumna);
  const columnasFaltantes = columnasRequeridas.filter(col => !columnasExcel.includes(col));

  return {
    valido: columnasFaltantes.length === 0,
    columnasEncontradas: columnasExcel,
    columnasFaltantes
  };
};

/**
 * Lee y procesa un archivo Excel
 * @param {Buffer} buffer - Contenido del archivo Excel
 * @param {string} nombreArchivo - Nombre original del archivo
 * @returns {object} Datos procesados del Excel
 */
const procesarArchivoExcel = (buffer, nombreArchivo) => {
  try {
    // Leer el Excel
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    // Obtener la primera hoja
    const nombreHoja = workbook.SheetNames[0];
    const hoja = workbook.Sheets[nombreHoja];

    // Convertir a JSON
    let filas = XLSX.utils.sheet_to_json(hoja, { defval: null });

    if (filas.length === 0) {
      throw new Error('El archivo Excel está vacío');
    }

    // Validar columnas
    const validacion = validarColumnasExcel(filas[0]);
    if (!validacion.valido) {
      throw new Error(
        `El Excel no tiene las columnas requeridas. Faltantes: ${validacion.columnasFaltantes.join(', ')}`
      );
    }

    // Log de diagnóstico: mostrar columnas que llegan del Excel
    const columnasOriginales = Object.keys(filas[0]);
    const columnasNormalizadas = columnasOriginales.map(c => `"${c}"→"${normalizarNombreColumna(c)}"`).join(', ');
    console.log('[Excel] Columnas detectadas:', columnasNormalizadas);
    const colFechaTrans = columnasOriginales.find(c => normalizarNombreColumna(c) === 'fecha_transmision');
    console.log('[Excel] Col fecha_transmision encontrada:', colFechaTrans, '| Valor raw fila 1:', filas[0][colFechaTrans]);

    // Normalizar datos
    const datosNormalizados = filas.map((fila, index) => {
      const filaNormalizada = {};

      Object.keys(fila).forEach(columna => {
        const nombreNormalizado = normalizarNombreColumna(columna);
        filaNormalizada[nombreNormalizado] = fila[columna];
      });

      return {
        fila_excel: index + 2, // +2 porque Excel empieza en 1 y la fila 1 es el encabezado
        estado_raw: filaNormalizada.estado?.toString() || '',
        moneda: filaNormalizada.moneda?.toString() || 'DOLAR',
        forma_pago: filaNormalizada.forma_pago?.toString() || 'DEBITO',
        valor_cobrado: parseFloat(filaNormalizada.valor_cobrado) || 0,
        cod_tercero: filaNormalizada.cod_tercero?.toString() || '',
        nom_terc: filaNormalizada.nom_terc?.toString() || '',
        fecha_transmision: parsearFechaExcel(filaNormalizada.fecha_transmision),
        fecha_pago: parsearFechaExcel(filaNormalizada.fecha_pago || filaNormalizada.fecha_transmision),
        banco: filaNormalizada.banco?.toString() || '',
        tipo_cuenta: filaNormalizada.tipo_cuenta?.toString() || 'DEBITO',
        num_cuenta: filaNormalizada.num_cuenta?.toString() || '',
        observaciones: filaNormalizada.observaciones?.toString() || null
      };
    });

    return {
      nombreArchivo,
      nombreHoja,
      totalFilas: datosNormalizados.length,
      datos: datosNormalizados,
      hash: generarHashArchivo(buffer)
    };

  } catch (error) {
    throw new Error(`Error al procesar Excel: ${error.message}`);
  }
};

/**
 * Detecta el periodo (mes/año) del lote según las fechas de transmisión
 * @param {Array} datos - Array de registros del Excel
 * @returns {object} { mes: number, anio: number }
 */
const detectarPeriodoLote = (datos) => {
  // Buscar la fecha de transmisión más común
  const conteoFechas = {};

  datos.forEach(registro => {
    if (registro.fecha_transmision) {
      const mes = registro.fecha_transmision.getMonth() + 1;
      const anio = registro.fecha_transmision.getFullYear();
      const clave = `${anio}-${mes}`;
      conteoFechas[clave] = (conteoFechas[clave] || 0) + 1;
    }
  });

  const claves = Object.keys(conteoFechas);

  if (claves.length === 0) {
    throw new Error(
      'No se encontraron fechas de transmisión válidas en el archivo. ' +
      'Verifique que el Excel tenga registros con fecha_transmision correctamente formateada.'
    );
  }

  // Obtener el periodo más frecuente
  const periodoMasFrecuente = claves.reduce((a, b) =>
    conteoFechas[a] > conteoFechas[b] ? a : b
  );

  const [anio, mes] = periodoMasFrecuente.split('-').map(Number);

  return { mes, anio };
};

/**
 * Importa un archivo Excel de débitos mensuales a la base de datos
 * @param {Buffer} buffer - Contenido del archivo
 * @param {string} nombreArchivo - Nombre original del archivo
 * @param {number} idUsuario - ID del usuario que realiza la importación
 * @returns {Promise<object>} Resultado de la importación
 */
const importarExcelDebitos = async (buffer, nombreArchivo, idUsuario) => {
  const client = await pool.connect();

  try {
    // 1. Procesar el archivo Excel
    const excel = procesarArchivoExcel(buffer, nombreArchivo);

    // 2. Detectar periodo
    const { mes, anio } = detectarPeriodoLote(excel.datos);

    // 3. Verificar si el archivo ya fue importado
    const existente = await client.query(
      'SELECT id_lote, nombre_archivo, fecha_importacion FROM lotes_importacion WHERE hash_archivo = $1',
      [excel.hash]
    );

    if (existente.rows.length > 0) {
      throw new Error(
        `Este archivo ya fue importado el ${new Date(existente.rows[0].fecha_importacion).toLocaleString('es-EC')} ` +
        `con el nombre "${existente.rows[0].nombre_archivo}"`
      );
    }

    // 4. Iniciar transacción
    await client.query('BEGIN');

    // 5. Crear registro del lote
    const loteResult = await client.query(
      `INSERT INTO lotes_importacion (
        nombre_archivo, hash_archivo, mes_proceso, anio_proceso,
        total_registros, id_usuario_carga
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_lote, mes_proceso, anio_proceso`,
      [nombreArchivo, excel.hash, mes, anio, excel.totalFilas, idUsuario]
    );

    const idLote = loteResult.rows[0].id_lote;

    // 6. Insertar registros de cobros
    let insertadosExitosos = 0;
    let insertadosFallidos = 0;
    const errores = [];

    for (const dato of excel.datos) {
      try {
        // Buscar titular por cod_tercero (n_convenio)
        const titularResult = await client.query(
          `SELECT id_benefactor, nombre_completo 
           FROM benefactores 
           WHERE n_convenio = $1 
             AND tipo_benefactor = 'TITULAR'
             AND estado_registro = 'APROBADO'
           LIMIT 1`,
          [dato.cod_tercero]
        );

        if (titularResult.rows.length === 0) {
          errores.push({
            fila: dato.fila_excel,
            cod_tercero: dato.cod_tercero,
            error: 'Titular no encontrado o no aprobado'
          });
          insertadosFallidos++;
          continue;
        }

        const idBenefactor = titularResult.rows[0].id_benefactor;

        // Insertar cobro
        await client.query(
          `INSERT INTO cobros (
            id_benefactor, fecha_transmision, fecha_pago, cod_tercero,
            estado, estado_banco_raw, moneda, forma_pago, valor_cobrado,
            empresa, tipo_movimiento, pais, banco, tipo_cuenta, num_cuenta,
            observaciones, id_lote_importacion, fila_excel
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )`,
          [
            idBenefactor,
            dato.fecha_transmision,
            dato.fecha_pago,
            dato.cod_tercero,
            dato.estado_raw, // Estado original del banco
            dato.estado_raw, // Guardamos también en estado_banco_raw
            dato.moneda,
            dato.forma_pago,
            dato.valor_cobrado,
            'BANCO', // empresa
            'Cobro', // tipo_movimiento
            'Ecuador', // pais
            dato.banco,
            dato.tipo_cuenta,
            dato.num_cuenta,
            dato.observaciones,
            idLote,
            dato.fila_excel
          ]
        );

        insertadosExitosos++;

      } catch (error) {
        errores.push({
          fila: dato.fila_excel,
          cod_tercero: dato.cod_tercero,
          error: error.message
        });
        insertadosFallidos++;
      }
    }

    // 7. Procesar el lote (normalizar estados y propagar a dependientes)
    const procesamientoResult = await client.query(
      'SELECT * FROM procesar_lote_debitos($1)',
      [idLote]
    );

    const procesamiento = procesamientoResult.rows[0];

    // 8. Commit de la transacción
    await client.query('COMMIT');

    // 9. Retornar resultado
    return {
      success: true,
      lote: {
        id_lote: idLote,
        nombre_archivo: nombreArchivo,
        mes: mes,
        anio: anio,
        total_registros: excel.totalFilas,
        insertados_exitosos: insertadosExitosos,
        insertados_fallidos: insertadosFallidos
      },
      procesamiento: {
        total_procesados: procesamiento.total_procesados,
        titulares_aportados: procesamiento.titulares_aportados,
        titulares_no_aportados: procesamiento.titulares_no_aportados,
        dependientes_actualizados: procesamiento.dependientes_actualizados,
        errores: procesamiento.errores
      },
      errores: errores.length > 0 ? errores : null
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Obtiene la lista de lotes importados
 * @param {object} filtros - Filtros opcionales { mes, anio, limit, offset }
 * @returns {Promise<Array>} Lista de lotes
 */
const obtenerLotesImportados = async (filtros = {}) => {
  const { mes, anio, limit = 50, offset = 0 } = filtros;

  let query = `
    SELECT 
      l.id_lote,
      l.nombre_archivo,
      l.mes_proceso,
      l.anio_proceso,
      l.total_registros,
      l.registros_exitosos,
      l.registros_fallidos,
      l.fecha_importacion,
      l.observaciones,
      u.nombre_usuario,
      COUNT(DISTINCT c.id_cobro) as total_cobros
    FROM lotes_importacion l
    JOIN usuarios u ON u.id_usuario = l.id_usuario_carga
    LEFT JOIN cobros c ON c.id_lote_importacion = l.id_lote
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (mes) {
    params.push(mes);
    query += ` AND l.mes_proceso = $${paramIndex++}`;
  }

  if (anio) {
    params.push(anio);
    query += ` AND l.anio_proceso = $${paramIndex++}`;
  }

  query += `
    GROUP BY l.id_lote, u.nombre_usuario
    ORDER BY l.fecha_importacion DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtiene el detalle de un lote específico
 * @param {number} idLote - ID del lote
 * @returns {Promise<object>} Detalle del lote con sus registros
 */
const obtenerDetalleLote = async (idLote) => {
  const client = await pool.connect();

  try {
    // Información del lote
    const loteResult = await client.query(
      `SELECT 
        l.*,
        u.nombre_usuario
      FROM lotes_importacion l
      JOIN usuarios u ON u.id_usuario = l.id_usuario_carga
      WHERE l.id_lote = $1`,
      [idLote]
    );

    if (loteResult.rows.length === 0) {
      throw new Error('Lote no encontrado');
    }

    // Registros de cobros del lote
    const cobrosResult = await client.query(
      `SELECT 
        c.id_cobro,
        c.id_benefactor,
        b.nombre_completo,
        b.cedula,
        b.n_convenio,
        c.cod_tercero,
        c.estado_banco_raw,
        c.valor_cobrado,
        c.fecha_transmision,
        c.fecha_pago,
        c.banco,
        c.tipo_cuenta,
        c.num_cuenta,
        c.fila_excel
      FROM cobros c
      JOIN benefactores b ON b.id_benefactor = c.id_benefactor
      WHERE c.id_lote_importacion = $1
      ORDER BY c.fila_excel`,
      [idLote]
    );

    // Estados generados del lote
    const estadosResult = await client.query(
      `SELECT 
        e.*,
        b.nombre_completo,
        b.tipo_benefactor
      FROM estado_aportes_mensuales e
      JOIN benefactores b ON b.id_benefactor = e.id_benefactor
      WHERE e.id_lote_origen = $1
      ORDER BY e.es_titular DESC, b.nombre_completo`,
      [idLote]
    );

    return {
      lote: loteResult.rows[0],
      cobros: cobrosResult.rows,
      estados: estadosResult.rows
    };

  } finally {
    client.release();
  }
};

module.exports = {
  importarExcelDebitos,
  obtenerLotesImportados,
  obtenerDetalleLote,
  procesarArchivoExcel, // Exportar para testing
  generarHashArchivo    // Exportar para testing
};
