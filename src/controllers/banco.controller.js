const db = require('../config/database');
const { validarBancoCreacion, validarBancoActualizacion } = require('../dtos/banco.dto');

/**
 * Obtener todos los bancos
 */
const getAll = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id_banco, nombre FROM bancos ORDER BY nombre ASC'
    );

    res.status(200).json({
      ok: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener bancos:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener la lista de bancos'
    });
  }
};

/**
 * Obtener un banco por ID
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT id_banco, nombre FROM bancos WHERE id_banco = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Banco no encontrado'
      });
    }

    res.status(200).json({
      ok: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener banco:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener el banco'
    });
  }
};

/**
 * Crear un nuevo banco
 */
const create = async (req, res) => {
  try {
    const validacion = validarBancoCreacion(req.body);

    if (!validacion.valido) {
      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos',
        errores: validacion.errores
      });
    }

    const { nombre } = validacion.datos;

    // Verificar si ya existe
    const existente = await db.query(
      'SELECT id_banco FROM bancos WHERE UPPER(nombre) = $1',
      [nombre]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un banco con ese nombre'
      });
    }

    // Insertar
    const result = await db.query(
      'INSERT INTO bancos (nombre) VALUES ($1) RETURNING id_banco, nombre',
      [nombre]
    );

    res.status(201).json({
      ok: true,
      message: 'Banco creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear banco:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al crear el banco'
    });
  }
};

/**
 * Actualizar un banco
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const bancoExiste = await db.query(
      'SELECT id_banco FROM bancos WHERE id_banco = $1',
      [id]
    );

    if (bancoExiste.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Banco no encontrado'
      });
    }

    const validacion = validarBancoActualizacion(req.body);

    if (!validacion.valido) {
      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos',
        errores: validacion.errores
      });
    }

    const { nombre } = validacion.datos;

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        message: 'No hay datos para actualizar'
      });
    }

    // Verificar duplicado
    const duplicado = await db.query(
      'SELECT id_banco FROM bancos WHERE UPPER(nombre) = $1 AND id_banco != $2',
      [nombre, id]
    );

    if (duplicado.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe otro banco con ese nombre'
      });
    }

    // Actualizar
    const result = await db.query(
      'UPDATE bancos SET nombre = $1 WHERE id_banco = $2 RETURNING id_banco, nombre',
      [nombre, id]
    );

    res.status(200).json({
      ok: true,
      message: 'Banco actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar banco:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al actualizar el banco'
    });
  }
};

/**
 * Eliminar un banco
 */
const deleteBanco = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM bancos WHERE id_banco = $1 RETURNING id_banco, nombre',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Banco no encontrado'
      });
    }

    res.status(200).json({
      ok: true,
      message: 'Banco eliminado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al eliminar banco:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al eliminar el banco'
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteBanco
};
