const pool = require('../config/database');
const logger = require('../config/logger');

const listarGruposCobroExterno = async (req, res) => {
  const client = await pool.connect();
  try {
    const incluirInactivos = String(req.query.incluir_inactivos || 'false').toLowerCase() === 'true';
    const result = await client.query(
      `
        SELECT
          g.*,
          COUNT(b.id_benefactor)::integer AS total_benefactores
        FROM grupos_cobro_externo g
        LEFT JOIN benefactores b
          ON b.id_grupo_cobro_externo = g.id_grupo_cobro
         AND b.estado_registro = 'APROBADO'
         AND COALESCE(LOWER(b.estado), 'activo') IN ('activo', 'active')
        WHERE ($1::boolean = true OR g.activo = true)
        GROUP BY g.id_grupo_cobro
        ORDER BY g.activo DESC, g.nombre_grupo ASC
      `,
      [incluirInactivos]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.logError(error, {
      action: 'listarGruposCobroExterno',
      userId: req.usuario?.id_usuario,
    });
    res.status(500).json({
      success: false,
      message: 'Error al listar grupos de cobro externo',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerGrupoCobroExternoPorId = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const grupoResult = await client.query(
      `
        SELECT
          g.*,
          COUNT(b.id_benefactor)::integer AS total_benefactores
        FROM grupos_cobro_externo g
        LEFT JOIN benefactores b
          ON b.id_grupo_cobro_externo = g.id_grupo_cobro
        WHERE g.id_grupo_cobro = $1
        GROUP BY g.id_grupo_cobro
      `,
      [id]
    );

    if (grupoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Grupo de cobro externo no encontrado',
      });
    }

    const miembrosResult = await client.query(
      `
        SELECT
          id_benefactor,
          nombre_completo,
          cedula,
          tipo_benefactor,
          n_convenio,
          aporte,
          estado,
          estado_registro
        FROM benefactores
        WHERE id_grupo_cobro_externo = $1
        ORDER BY nombre_completo ASC
      `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...grupoResult.rows[0],
        miembros: miembrosResult.rows,
      },
    });
  } catch (error) {
    logger.logError(error, {
      action: 'obtenerGrupoCobroExternoPorId',
      userId: req.usuario?.id_usuario,
      grupoId: req.params?.id,
    });
    res.status(500).json({
      success: false,
      message: 'Error al obtener grupo de cobro externo',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const crearGrupoCobroExterno = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      nombre_grupo,
      nombre_titular_externo,
      cedula_titular_externo,
      banco_emisor,
      tipo_cuenta,
      num_cuenta,
      n_convenio_cartera,
      observacion,
      activo,
    } = req.body;

    const convenioNormalizado = String(n_convenio_cartera || '').trim().toUpperCase();
    if (!nombre_grupo?.trim() || !nombre_titular_externo?.trim() || !convenioNormalizado) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de grupo, titular externo y convenio de cartera son obligatorios',
      });
    }

    await client.query('BEGIN');

    const conflictoGrupo = await client.query(
      `SELECT id_grupo_cobro
       FROM grupos_cobro_externo
       WHERE UPPER(TRIM(n_convenio_cartera)) = $1`,
      [convenioNormalizado]
    );

    if (conflictoGrupo.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ya existe un grupo externo con ese convenio de cartera',
      });
    }

    const conflictoBenefactor = await client.query(
      `SELECT id_benefactor
       FROM benefactores
       WHERE estado_registro <> 'RECHAZADO'
         AND UPPER(TRIM(n_convenio)) = $1
       LIMIT 1`,
      [convenioNormalizado]
    );

    if (conflictoBenefactor.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ese convenio de cartera ya esta usado por un benefactor',
      });
    }

    const result = await client.query(
      `
        INSERT INTO grupos_cobro_externo (
          nombre_grupo,
          nombre_titular_externo,
          cedula_titular_externo,
          banco_emisor,
          tipo_cuenta,
          num_cuenta,
          n_convenio_cartera,
          observacion,
          activo,
          id_usuario_creacion
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        RETURNING *
      `,
      [
        nombre_grupo.trim(),
        nombre_titular_externo.trim(),
        cedula_titular_externo?.trim() || null,
        banco_emisor?.trim() || null,
        tipo_cuenta?.trim() || null,
        num_cuenta?.trim() || null,
        convenioNormalizado,
        observacion?.trim() || null,
        activo !== false,
        req.usuario.id_usuario,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Grupo de cobro externo creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      action: 'crearGrupoCobroExterno',
      userId: req.usuario?.id_usuario,
    });
    res.status(500).json({
      success: false,
      message: 'Error al crear grupo de cobro externo',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarGrupoCobroExterno = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      nombre_grupo,
      nombre_titular_externo,
      cedula_titular_externo,
      banco_emisor,
      tipo_cuenta,
      num_cuenta,
      n_convenio_cartera,
      observacion,
      activo,
    } = req.body;

    const grupoActual = await client.query(
      'SELECT * FROM grupos_cobro_externo WHERE id_grupo_cobro = $1',
      [id]
    );

    if (grupoActual.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Grupo de cobro externo no encontrado',
      });
    }

    const convenioNormalizado = n_convenio_cartera !== undefined
      ? String(n_convenio_cartera || '').trim().toUpperCase()
      : null;

    await client.query('BEGIN');

    if (convenioNormalizado) {
      const conflictoGrupo = await client.query(
        `SELECT id_grupo_cobro
         FROM grupos_cobro_externo
         WHERE UPPER(TRIM(n_convenio_cartera)) = $1
           AND id_grupo_cobro <> $2`,
        [convenioNormalizado, id]
      );

      if (conflictoGrupo.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro grupo externo con ese convenio de cartera',
        });
      }

      const conflictoBenefactor = await client.query(
        `SELECT id_benefactor
         FROM benefactores
         WHERE estado_registro <> 'RECHAZADO'
           AND UPPER(TRIM(n_convenio)) = $1
         LIMIT 1`,
        [convenioNormalizado]
      );

      if (conflictoBenefactor.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Ese convenio de cartera ya esta usado por un benefactor',
        });
      }
    }

    const result = await client.query(
      `
        UPDATE grupos_cobro_externo
        SET
          nombre_grupo = COALESCE($1, nombre_grupo),
          nombre_titular_externo = COALESCE($2, nombre_titular_externo),
          cedula_titular_externo = $3,
          banco_emisor = $4,
          tipo_cuenta = $5,
          num_cuenta = $6,
          n_convenio_cartera = COALESCE($7, n_convenio_cartera),
          observacion = $8,
          activo = COALESCE($9, activo),
          fecha_actualizacion = NOW()
        WHERE id_grupo_cobro = $10
        RETURNING *
      `,
      [
        nombre_grupo?.trim() || null,
        nombre_titular_externo?.trim() || null,
        cedula_titular_externo?.trim() || null,
        banco_emisor?.trim() || null,
        tipo_cuenta?.trim() || null,
        num_cuenta?.trim() || null,
        convenioNormalizado || null,
        observacion?.trim() || null,
        typeof activo === 'boolean' ? activo : null,
        id,
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Grupo de cobro externo actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      action: 'actualizarGrupoCobroExterno',
      userId: req.usuario?.id_usuario,
      grupoId: req.params?.id,
    });
    res.status(500).json({
      success: false,
      message: 'Error al actualizar grupo de cobro externo',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  listarGruposCobroExterno,
  obtenerGrupoCobroExternoPorId,
  crearGrupoCobroExterno,
  actualizarGrupoCobroExterno,
};
