const fs = require('fs');
const path = require('path');

const APARIENCIA_DIR = path.join(__dirname, '../../uploads/apariencia');
const CONFIG_PATH = path.join(APARIENCIA_DIR, 'config.json');
const MAX_CAROUSEL_IMAGES = 5;

const defaultConfig = () => ({
  logo: null,
  carousel: Array.from({ length: MAX_CAROUSEL_IMAGES }, () => null),
  updated_at: new Date().toISOString(),
});

const ensureStorage = () => {
  if (!fs.existsSync(APARIENCIA_DIR)) {
    fs.mkdirSync(APARIENCIA_DIR, { recursive: true });
  }
};

const normalizeConfig = (raw) => {
  const base = defaultConfig();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const carousel = Array.isArray(raw.carousel) ? raw.carousel : [];
  return {
    logo: typeof raw.logo === 'string' ? raw.logo : null,
    carousel: Array.from({ length: MAX_CAROUSEL_IMAGES }, (_, index) => {
      const value = carousel[index];
      return typeof value === 'string' ? value : null;
    }),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : base.updated_at,
  };
};

const readConfig = () => {
  ensureStorage();
  if (!fs.existsSync(CONFIG_PATH)) {
    return defaultConfig();
  }

  try {
    const file = fs.readFileSync(CONFIG_PATH, 'utf8');
    return normalizeConfig(JSON.parse(file));
  } catch (error) {
    return defaultConfig();
  }
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

const removeImageIfExists = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return;
  }

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
    carousel_urls: carouselItems.filter((item) => item.url).map((item) => item.url),
    updated_at: config.updated_at,
  };
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
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_CAROUSEL_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `Indice invalido. Debe estar entre 0 y ${MAX_CAROUSEL_IMAGES - 1}`,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se envio ninguna imagen',
      });
    }

    const config = readConfig();
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
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_CAROUSEL_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `Indice invalido. Debe estar entre 0 y ${MAX_CAROUSEL_IMAGES - 1}`,
      });
    }

    const config = readConfig();
    const oldFile = config.carousel[index];
    if (!oldFile) {
      return res.status(404).json({
        success: false,
        message: 'No hay imagen para ese indice',
      });
    }

    removeImageIfExists(oldFile);
    const carousel = [...config.carousel];
    carousel[index] = null;
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
  eliminarLogo,
  eliminarImagenCarrusel,
  obtenerArchivo,
  APARIENCIA_DIR,
};

