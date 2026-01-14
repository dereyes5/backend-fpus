#!/bin/bash

# Script de deployment automático para API de Benefactores
# Este script se ejecuta cuando hay cambios en el repositorio

echo "🚀 Iniciando deployment..."

# Detener la aplicación
echo "⏹️  Deteniendo aplicación..."
pm2 stop api-benefactores || true

# Obtener últimos cambios
echo "📥 Descargando cambios..."
git pull origin main

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install --production

# Reiniciar la aplicación
echo "🔄 Reiniciando aplicación..."
pm2 restart api-benefactores || pm2 start ecosystem.config.js

# Guardar configuración de PM2
pm2 save

echo "✅ Deployment completado exitosamente!"
pm2 status
