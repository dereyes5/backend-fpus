# API de Gestión de Benefactores

API REST completa para la gestión de benefactores con autenticación JWT, control de roles y aprobación de registros.
URL DEL PROYECTO(SSH): git@github.com:dereyes5/backend-fpus.git

## 🚀 Características

- ✅ Autenticación con JWT
- ✅ Gestión de usuarios con contraseñas hasheadas (bcrypt)
- ✅ Sistema de roles y permisos
- ✅ CRUD completo de benefactores
- ✅ Gestión de dependientes y titulares
- ✅ Sistema de aprobación de registros
- ✅ **Sistema de cobros y saldos mensuales**
- ✅ **Control de pagos y morosos**
- ✅ **Estadísticas y reportes de recaudación**
- ✅ Validación de datos con DTOs
- ✅ Paginación en consultas
- ✅ Manejo de errores centralizado

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- PostgreSQL (v12 o superior)
- npm o yarn

## 🔧 Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno en `.env`:
```env
# Database Configuration
DB_HOST=154.12.234.100
DB_PORT=5432
DB_USER=david
DB_PASSWORD=tu_password
DB_NAME=nombre_db

# JWT Configuration
JWT_SECRET=tu_clave_secreta_super_segura
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development
```

4. Ejecutar el servidor:
```bash
# Modo producción
npm start

# Modo desarrollo con nodemon
npm run dev
```

## 📚 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Configuración de PostgreSQL
│   ├── controllers/
│   │   ├── auth.controller.js   # Controlador de autenticación
│   │   ├── rol.controller.js    # Controlador de roles
│   │   ├── benefactor.controller.js  # Controlador de benefactores
│   │   ├── aprobacion.controller.js  # Controlador de aprobaciones
│   │   └── cobros.controller.js      # Controlador de cobros y saldos
│   ├── dtos/
│   │   ├── usuario.dto.js       # DTOs de validación de usuarios
│   │   ├── rol.dto.js           # DTOs de validación de roles
│   │   ├── benefactor.dto.js    # DTOs de validación de benefactores
│   │   └── aprobacion.dto.js    # DTOs de validación de aprobaciones
│   ├── middleware/
│   │   ├── auth.middleware.js   # Verificación de JWT
│   │   └── validator.middleware.js  # Validación de errores
│   └── routes/
│       ├── auth.routes.js       # Rutas de autenticación
│       ├── rol.routes.js        # Rutas de roles
│       ├── benefactor.routes.js # Rutas de benefactores
│       ├── aprobacion.routes.js # Rutas de aprobaciones
│       ├── cobros.routes.js     # Rutas de cobros y saldos
│       └── index.js             # Enrutador principal
├── base/
│   ├── basescript.sql           # Script de base de datos
│   ├── cobros_y_saldos.sql      # Script de cobros y saldos
│   └── README_COBROS_SALDOS.md  # Documentación del módulo de cobros
├── .env                         # Variables de entorno
├── index.js                     # Punto de entrada
└── package.json
```

## 🔐 Endpoints de la API

### Autenticación

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "nombre_usuario": "PRODRIGUEZ",
  "password": "mi_password"
}
```

Respuesta:
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id_usuario": 1,
      "nombre_usuario": "PRODRIGUEZ",
      "roles": [
        {
          "id_rol": 1,
          "nombre": "EJECUTIVO"
        }
      ]
    }
  }
}
```

#### Crear Usuario
```http
POST /api/auth/usuarios
Content-Type: application/json

{
  "nombre_usuario": "nuevousuario",
  "password": "password123"
}
```

#### Asignar Rol a Usuario
```http
POST /api/auth/usuarios/asignar-rol
Authorization: Bearer {token}
Content-Type: application/json

{
  "id_usuario": 5,
  "id_rol": 1
}
```

#### Obtener Perfil
```http
GET /api/auth/perfil
Authorization: Bearer {token}
```

#### Cambiar Contraseña
```http
PUT /api/auth/cambiar-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "password_actual": "mi_password_actual",
  "password_nueva": "mi_password_nueva"
}
```

### Roles

#### Listar Roles
```http
GET /api/roles
Authorization: Bearer {token}
```

#### Obtener Rol por ID
```http
GET /api/roles/:id
Authorization: Bearer {token}
```

#### Crear Rol
```http
POST /api/roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "ADMINISTRADOR"
}
```

#### Actualizar Rol
```http
PUT /api/roles/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "SUPERVISOR"
}
```

#### Eliminar Rol
```http
DELETE /api/roles/:id
Authorization: Bearer {token}
```

### Benefactores

#### Listar Benefactores
```http
GET /api/benefactores?tipo_benefactor=TITULAR&estado_registro=PENDIENTE&page=1&limit=50
Authorization: Bearer {token}
```

Parámetros de query opcionales:
- `tipo_benefactor`: TITULAR | DEPENDIENTE
- `estado_registro`: PENDIENTE | APROBADO | RECHAZADO
- `page`: número de página (default: 1)
- `limit`: registros por página (default: 50)

#### Obtener Benefactor por ID
```http
GET /api/benefactores/:id
Authorization: Bearer {token}
```

#### Crear Benefactor
```http
POST /api/benefactores
Authorization: Bearer {token}
Content-Type: application/json

{
  "tipo_benefactor": "TITULAR",
  "nombre_completo": "Juan Pérez García",
  "cedula": "1234567890",
  "email": "juan.perez@example.com",
  "telefono": "0987654321",
  "direccion": "Calle Principal 123",
  "ciudad": "Santo Domingo",
  "provincia": "Santo Domingo",
  "fecha_nacimiento": "1990-05-15",
  "fecha_suscripcion": "2024-01-10",
  "tipo_afiliacion": "INDIVIDUAL",
  "inscripcion": 4.99,
  "aporte": 4.99,
  "estado": "ACTIVO"
}
```

#### Actualizar Benefactor
```http
PUT /api/benefactores/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "telefono": "0999888777",
  "email": "nuevo.email@example.com"
}
```

#### Eliminar Benefactor
```http
DELETE /api/benefactores/:id
Authorization: Bearer {token}
```

#### Asignar Dependiente a Titular
```http
POST /api/benefactores/asignar-dependiente
Authorization: Bearer {token}
Content-Type: application/json

{
  "id_titular": 1,
  "id_dependiente": 6
}
```

#### Obtener Dependientes de un Titular
```http
GET /api/benefactores/:id/dependientes
Authorization: Bearer {token}
```

### Aprobaciones

#### Listar Aprobaciones
```http
GET /api/aprobaciones?estado_aprobacion=APROBADO&page=1&limit=50
Authorization: Bearer {token}
```

Parámetros de query opcionales:
- `estado_aprobacion`: APROBADO | RECHAZADO
- `page`: número de página (default: 1)
- `limit`: registros por página (default: 50)

#### Obtener Registros Pendientes
```http
GET /api/aprobaciones/pendientes?page=1&limit=50
Authorization: Bearer {token}
```

#### Aprobar o Rechazar Registro
```http
POST /api/aprobaciones
Authorization: Bearer {token}
Content-Type: application/json

{
  "id_benefactor": 1,
  "estado_aprobacion": "APROBADO",
  "comentario": "Documentación completa y verificada"
}
```

#### Obtener Historial de Aprobaciones de un Benefactor
```http
GET /api/aprobaciones/benefactor/:id
Authorization: Bearer {token}
```

### Cobros y Saldos

#### Obtener Lista de Benefactores (para cobros)
```http
GET /api/cobros/benefactores
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "id_benefactor": 1,
      "nombre_completo": "Juan Pérez García",
      "cedula": "1234567890",
      "email": "juan@example.com",
      "telefono": "0987654321",
      "monto_a_pagar": "4.99",
      "banco_emisor": "Banco Pichincha",
      "tipo_cuenta": "AHORRO",
      "num_cuenta_tc": "2207501161"
    }
  ],
  "total": 150
}
```

#### Obtener Estado de Pagos del Mes Actual
```http
GET /api/cobros/estado/actual
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "id_benefactor": 1,
      "nombre_completo": "Juan Pérez García",
      "cedula": "1234567890",
      "email": "juan@example.com",
      "monto_a_pagar": "4.99",
      "monto_pagado": "4.99",
      "saldo_pendiente": "0.00",
      "estado_pago": "PAGADO",
      "ultima_fecha_pago": "2025-10-15",
      "cantidad_cobros": 2
    }
  ],
  "total": 150,
  "mes": 10,
  "anio": 2025
}
```

#### Obtener Estado de Pagos por Fecha
```http
GET /api/cobros/estado/fecha/2025-10-15
Authorization: Bearer {token}
```

#### Obtener Estado de Pagos por Mes
```http
GET /api/cobros/estado/mes/9/2025
Authorization: Bearer {token}
```

#### Obtener Lista de Morosos (No Pagaron)
```http
GET /api/cobros/morosos
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "id_benefactor": 3,
      "nombre_completo": "Pedro López",
      "cedula": "1122334455",
      "monto_a_pagar": "3.98",
      "monto_pagado": "0.00",
      "saldo_pendiente": "3.98",
      "estado_pago": "NO_PAGADO"
    }
  ],
  "total": 15
}
```

#### Obtener Lista de Pagados
```http
GET /api/cobros/pagados
Authorization: Bearer {token}
```

#### Obtener Lista de Pagos Parciales
```http
GET /api/cobros/pagos-parciales
Authorization: Bearer {token}
```

#### Obtener Estadísticas del Mes
```http
GET /api/cobros/estadisticas
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "total_titulares": "150",
    "pagados": "120",
    "parciales": "15",
    "no_pagados": "15",
    "total_esperado": "747.50",
    "total_recaudado": "620.25",
    "total_pendiente": "127.25",
    "porcentaje_recaudacion": "83.00"
  }
}
```

#### Obtener Historial Completo de Pagos
```http
GET /api/cobros/historial
Authorization: Bearer {token}
```

#### Obtener Historial de un Benefactor
```http
GET /api/cobros/benefactores/:id/historial
Authorization: Bearer {token}
```

#### Obtener Saldo Actual de un Benefactor
```http
GET /api/cobros/benefactores/:id/saldo
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "id_benefactor": 1,
    "saldo_actual": "25.50"
  }
}
```

#### Registrar Cobros (desde archivo del banco)
```http
POST /api/cobros/cobros
Authorization: Bearer {token}
Content-Type: application/json

{
  "cobros": [
    {
      "id_benefactor": 1,
      "fecha_transmision": "2025-10-15",
      "fecha_pago": "2025-10-25",
      "cod_tercero": "SD0002",
      "estado": "Proceso O.K.",
      "moneda": "DOLAR",
      "forma_pago": "CREDITO",
      "valor_cobrado": 4.99,
      "empresa": "FUNDACION PO",
      "tipo_movimiento": "Cobro",
      "pais": "Ecuador",
      "banco": "Banco Pichincha",
      "tipo_cuenta": "AHORRO",
      "num_cuenta": "2207501161",
      "observaciones": "Cobro mensual"
    }
  ]
}
```

Respuesta:
```json
{
  "success": true,
  "message": "Cobros registrados y procesados correctamente",
  "data": {
    "cobros_insertados": 10,
    "cobros": [...]
  }
}
```

#### Obtener Cobros Registrados
```http
GET /api/cobros/cobros?id_benefactor=1&estado=Proceso O.K.&procesado=false&page=1&limit=50
Authorization: Bearer {token}
```

Parámetros de query opcionales:
- `id_benefactor`: ID del benefactor
- `estado`: Estado del cobro (Proceso O.K., ERROR-...)
- `procesado`: true | false
- `fecha_desde`: Fecha inicio (YYYY-MM-DD)
- `fecha_hasta`: Fecha fin (YYYY-MM-DD)
- `page`: número de página
- `limit`: registros por página

#### Obtener Transacciones de Saldo (Auditoría)
```http
GET /api/cobros/benefactores/:id/transacciones?page=1&limit=50
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "id_transaccion": 1,
      "id_benefactor": 1,
      "id_cobro": 5,
      "tipo_transaccion": "COBRO_EXITOSO",
      "monto": "4.99",
      "saldo_anterior": "20.50",
      "saldo_posterior": "25.49",
      "fecha_transaccion": "2025-10-15T10:30:00",
      "descripcion": "Cobro procesado: SD0002"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 156,
    "pages": 4
  }
}
```

## 🔒 Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt (10 rounds)
- Todas las rutas (excepto login) requieren token JWT válido
- Los tokens expiran según la configuración `JWT_EXPIRES_IN`
- Validación de datos en todos los endpoints con express-validator
- Transacciones de base de datos para operaciones críticas

## 📊 Modelo de Base de Datos

### Tablas Principales

- **usuarios**: Usuarios del sistema con contraseñas hasheadas
- **roles**: Roles disponibles en el sistema
- **usuario_roles**: Relación muchos a muchos entre usuarios y roles
- **benefactores**: Información de benefactores (titulares y dependientes)
- **relaciones_dependientes**: Relación entre titulares y dependientes
- **aprobaciones_benefactores**: Historial de aprobaciones/rechazos
- **cobros**: Registro de todos los cobros del banco (exitosos y fallidos)
- **saldos_diarios**: Control diario de saldos por benefactor
- **transacciones_saldo**: Auditoría completa de movimientos de saldo

### Vistas y Funciones (Módulo de Cobros)

- **estado_pagos_mes_actual**: Vista de estado de pagos del mes en curso
- **historial_pagos_mensuales**: Historial completo de pagos por mes
- **procesar_cobros_del_dia()**: Función para procesar cobros de una fecha
- **procesar_todos_cobros_pendientes()**: Función para procesar todos los cobros pendientes
- **obtener_saldo_actual()**: Función para obtener el saldo de un benefactor
- **obtener_estado_pagos_por_fecha()**: Función para consultar estado en fecha específica
- **obtener_estado_pago_por_mes()**: Función para consultar estado de un mes

> 📚 Para más información sobre el módulo de cobros, consulta: `base/README_COBROS_SALDOS.md`

## 🛠️ Tecnologías Utilizadas

- **Express.js**: Framework web
- **PostgreSQL**: Base de datos
- **bcryptjs**: Hash de contraseñas
- **jsonwebtoken**: Autenticación JWT
- **express-validator**: Validación de datos
- **pg**: Cliente de PostgreSQL
- **dotenv**: Variables de entorno
- **cors**: Manejo de CORS

## 📝 Notas Importantes

1. Asegúrate de configurar correctamente el archivo `.env` con tus credenciales de base de datos
2. La clave `JWT_SECRET` debe ser segura y única para producción
3. Los endpoints de creación de benefactores crean registros con `estado_registro: PENDIENTE`
4. Solo usuarios autenticados pueden aprobar/rechazar registros
5. Las relaciones titular-dependiente se validan mediante triggers en la base de datos

## 🚦 Códigos de Estado HTTP

- `200`: Éxito
- `201`: Creado exitosamente
- `400`: Error de validación o solicitud incorrecta
- `401`: No autenticado o token inválido
- `404`: Recurso no encontrado
- `500`: Error interno del servidor

## 📞 Soporte

Para cualquier consulta o problema, contacta al equipo de desarrollo.
