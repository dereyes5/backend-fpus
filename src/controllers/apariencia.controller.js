const fs = require('fs');
const path = require('path');

const APARIENCIA_DIR = path.join(__dirname, '../../uploads/apariencia');
const CONFIG_PATH = path.join(APARIENCIA_DIR, 'config.json');

const LEGACY_ASSETS = {
  logo: path.join(__dirname, '../../../frontend/assets/img/FUNDACASDION.png'),
  carousel: [
    path.join(__dirname, '../../../frontend/assets/img/1 - copia.jpg'),
    path.join(__dirname, '../../../frontend/assets/img/2.jpg'),
    path.join(__dirname, '../../../frontend/assets/img/3.jpg'),
    path.join(__dirname, '../../../frontend/assets/img/5.jpg'),
    path.join(__dirname, '../../../frontend/assets/img/6.jpg'),
  ],
};

const defaultConfig = () => ({
  logo: null,
  carousel: [],
  updated_at: new Date().toISOString(),
});

const ensureStorage = () => {
  if (!fs.existsSync(APARIENCIA_DIR)) {
    fs.mkdirSync(APARIENCIA_DIR, { recursive: true });
  }
};

const sanitizeFilename = (filename) => filename.replace(/[^\w.-]/g, '_');

const copyLegacyAsset = (sourcePath, prefix) => {
  if (!fs.existsSync(sourcePath)) return null;
  const ext = path.extname(sourcePath).toLowerCase() || '.jpg';
  const filename = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}${sanitizeFilename(ext)}`;
  const targetPath = path.join(APARIENCIA_DIR, filename);
  fs.copyFileSync(sourcePath, targetPath);
  return filename;
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeConfig = (raw) => {
  const base = defaultConfig();
  const carouselRaw = Array.isArray(raw?.carousel) ? raw.carousel : [];

  const normalized = {
    logo: isNonEmptyString(raw?.logo) ? raw.logo : null,
    carousel: carouselRaw.filter(isNonEmptyString),
    updated_at: isNonEmptyString(raw?.updated_at) ? raw.updated_at : base.updated_at,
  };

  return normalized;
};

const saveConfig = (config) => {
  ensureStorage();
  const normalized = normalizeConfig({
    ...config,
    updated_at: new Date().toISOString(),
  });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
};

const buildLegacyInitialConfig = () => {
  ensureStorage();
  const logo = copyLegacyAsset(LEGACY_ASSETS.logo, 'logo_legacy');
  const carousel = LEGACY_ASSETS.carousel
    .map((assetPath, index) => copyLegacyAsset(assetPath, `carousel_legacy_${index}`))
    .filter(Boolean);

  return saveConfig({
    logo: logo || null,
    carousel,
  });
};

const readConfig = () => {
  ensureStorage();

  if (!fs.existsSync(CONFIG_PATH)) {
    return buildLegacyInitialConfig();
  }

  try {
    const file = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(file);
    const normalized = normalizeConfig(parsed);

    // Migracion para configuraciones antiguas vacias o formato anterior fijo
    if (!normalized.logo && normalized.carousel.length === 0) {
      return buildLegacyInitialConfig();
    }

    return normalized;
  } catch (error) {
    return buildLegacyInitialConfig();
  }
};

const removeImageIfExists = (filename) => {
  if (!isNonEmptyString(filename)) return;
  const filePath = path.join(APARIENCIA_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const buildFileUrl = (req, filename) => {
  if (!filename) return null;
  return `${req.protocol}://${req.get('host')}/api/apariencia/archivo/${encodeURIComponent(filename)}`;
};

const buildResponseData = (req, config) => {
  const carouselItems = config.carousel.map((filename, index) => ({
    index,
    filename,
    url: buildFileUrl(req, filename),
  }));

  return {
    logo: {
      filename: config.logo,
      url: buildFileUrl(req, config.logo),
    },
    carousel: carouselItems,
    carousel_urls: carouselItems.map((item) => item.url).filter(Boolean),
    updated_at: config.updated_at,
  };
};

const parseIndex = (indexRaw) => {
  const index = Number(indexRaw);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }
  return index;
};

const getConfiguracionPublica = (req, res) => {
  try {
    const config = readConfig();
    return res.json({
      success: true,
      data: buildResponseData(req, config),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al obtener configuracion de apariencia',
      error: error.message,
    });
  }
};

const subirLogo = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se envio ninguna imagen',
      });
    }

    const config = readConfig();
    const oldLogo = config.logo;
    const next = saveConfig({
      ...config,
      logo: req.file.filename,
    });

    if (oldLogo && oldLogo !== req.file.filename) {
      removeImageIfExists(oldLogo);
    }

    return res.json({
      success: true,
      message: 'Logo actualizado exitosamente',
      data: buildResponseData(req, next),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar logo',
      error: error.message,
    });
  }
};

const subirImagenCarrusel = (req, res) => {
  try {
    const index = parseIndex(req.params.index);
    if (index === null) {
      return res.status(400).json({
        success: false,
        message: 'Indice invalido',
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se envio ninguna imagen',
      });
    }

    const config = readConfig();
    if (index >= config.carousel.length) {
      return res.status(400).json({
        success: false,
        message: 'Indice fuera de rango. Usa el endpoint de agregar para nuevas imagenes',
      });
    }

    const oldFile = config.carousel[index];
    const carousel = [...config.carousel];
    carousel[index] = req.file.filename;
    const next = saveConfig({
      ...config,
      carousel,
    });

    if (oldFile && oldFile !== req.file.filename) {
      removeImageIfExists(oldFile);
    }

    return res.json({
      success: true,
      message: `Imagen ${index + 1} del carrusel actualizada`,
      data: buildResponseData(req, next),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar imagen del carrusel',
      error: error.message,
    });
  }
};

const agregarImagenCarrusel = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se envio ninguna imagen',
      });
    }

    const config = readConfig();
    const carousel = [...config.carousel, req.file.filename];
    const next = saveConfig({
      ...config,
      carousel,
    });

    return res.json({
      success: true,
      message: 'Imagen agregada al carrusel',
      data: buildResponseData(req, next),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al agregar imagen del carrusel',
      error: error.message,
    });
  }
};

const eliminarLogo = (req, res) => {
  try {
    const config = readConfig();
    if (!config.logo) {
      return res.status(404).json({
        success: false,
        message: 'No hay logo configurado',
      });
    }

    removeImageIfExists(config.logo);
    const next = saveConfig({
      ...config,
      logo: null,
    });

    return res.json({
      success: true,
      message: 'Logo eliminado exitosamente',
      data: buildResponseData(req, next),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar logo',
      error: error.message,
    });
  }
};

const eliminarImagenCarrusel = (req, res) => {
  try {
    const index = parseIndex(req.params.index);
    if (index === null) {
      return res.status(400).json({
        success: false,
        message: 'Indice invalido',
      });
    }

    const config = readConfig();
    if (index >= config.carousel.length) {
      return res.status(404).json({
        success: false,
        message: 'No existe imagen para ese indice',
      });
    }

    const oldFile = config.carousel[index];
    removeImageIfExists(oldFile);
    const carousel = [...config.carousel];
    carousel.splice(index, 1);
    const next = saveConfig({
      ...config,
      carousel,
    });

    return res.json({
      success: true,
      message: `Imagen ${index + 1} del carrusel eliminada`,
      data: buildResponseData(req, next),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar imagen del carrusel',
      error: error.message,
    });
  }
};

const obtenerArchivo = (req, res) => {
  try {
    const decoded = decodeURIComponent(req.params.filename || '');
    const safeFilename = path.basename(decoded);
    if (!safeFilename || safeFilename !== decoded) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de archivo invalido',
      });
    }

    const filePath = path.join(APARIENCIA_DIR, safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado',
      });
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al obtener archivo',
      error: error.message,
    });
  }
};

module.exports = {
  getConfiguracionPublica,
  subirLogo,
  subirImagenCarrusel,
  agregarImagenCarrusel,
  eliminarLogo,
  eliminarImagenCarrusel,
  obtenerArchivo,
  APARIENCIA_DIR,
};

