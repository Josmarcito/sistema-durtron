#!/usr/bin/env python3
"""Inicialización de base de datos PostgreSQL para Sistema Durtron"""

import psycopg2
import os
import sys

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://durtron:RBYwTg26IgSlKJN8giieAhUmylzpTzn6@dpg-d66b4d6sb7us73clsr7g-a/durtron')

def init_db():
    print("=" * 60)
    print("Inicializando base de datos PostgreSQL...")
    print("=" * 60)

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL no encontrada")
        sys.exit(1)

    url = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

    try:
        conn = psycopg2.connect(url)
        cursor = conn.cursor()
        print("Conexion exitosa a la base de datos")
    except Exception as e:
        print(f"ERROR al conectar: {e}")
        sys.exit(1)

    # Solo crear tablas si no existen (NO borrar datos existentes)
    print("Verificando tablas...")

    # Tabla equipos = Catalogo de productos
    print("Creando tabla 'equipos' (catalogo)...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipos (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(50) UNIQUE NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            marca VARCHAR(100),
            modelo VARCHAR(100),
            descripcion TEXT,
            categoria VARCHAR(100),
            precio_lista DECIMAL(12, 2) NOT NULL DEFAULT 0,
            precio_minimo DECIMAL(12, 2) NOT NULL DEFAULT 0,
            precio_costo DECIMAL(12, 2) DEFAULT 0,
            potencia_motor VARCHAR(50),
            capacidad VARCHAR(50),
            dimensiones VARCHAR(100),
            peso VARCHAR(50),
            especificaciones TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'equipos'")

    # Tabla inventario = Instancias reales de equipos
    print("Creando tabla 'inventario'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventario (
            id SERIAL PRIMARY KEY,
            equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
            numero_serie VARCHAR(100),
            estado VARCHAR(50) NOT NULL DEFAULT 'Disponible',
            observaciones TEXT,
            fecha_ingreso DATE DEFAULT CURRENT_DATE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'inventario'")

    # Tabla ventas
    print("Creando tabla 'ventas'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id SERIAL PRIMARY KEY,
            inventario_id INTEGER NOT NULL REFERENCES inventario(id),
            equipo_id INTEGER NOT NULL REFERENCES equipos(id),
            vendedor VARCHAR(100) NOT NULL,
            cliente_nombre VARCHAR(255) NOT NULL,
            cliente_contacto VARCHAR(100),
            cliente_rfc VARCHAR(20),
            cliente_direccion TEXT,
            precio_venta DECIMAL(12, 2) NOT NULL,
            descuento_monto DECIMAL(12, 2) DEFAULT 0,
            descuento_porcentaje DECIMAL(5, 2) DEFAULT 0,
            motivo_descuento TEXT,
            forma_pago VARCHAR(50),
            facturado BOOLEAN DEFAULT FALSE,
            numero_factura VARCHAR(50),
            autorizado_por VARCHAR(100),
            tiene_anticipo BOOLEAN DEFAULT FALSE,
            anticipo_monto DECIMAL(12, 2) DEFAULT 0,
            anticipo_fecha DATE,
            fecha_venta DATE DEFAULT CURRENT_DATE,
            notas TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Agregar columnas nuevas si no existen
    for col, tipo in [('tiene_anticipo', 'BOOLEAN DEFAULT FALSE'),
                      ('anticipo_monto', 'DECIMAL(12,2) DEFAULT 0'),
                      ('anticipo_fecha', 'DATE'),
                      ('cuenta_bancaria', 'TEXT'),
                      ('entregado', 'BOOLEAN DEFAULT FALSE'),
                      ('estado_venta', "VARCHAR(50) DEFAULT 'Anticipo'")]:
        try:
            cursor.execute(f"ALTER TABLE ventas ADD COLUMN IF NOT EXISTS {col} {tipo}")
        except Exception:
            pass
    print("  OK tabla 'ventas'")

    # Tabla anticipos (multiples anticipos por venta)
    print("Creando tabla 'anticipos'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS anticipos (
            id SERIAL PRIMARY KEY,
            venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
            monto DECIMAL(12, 2) NOT NULL,
            fecha DATE DEFAULT CURRENT_DATE,
            comprobante_url TEXT,
            notas TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'anticipos'")

    # Tabla vendedores_catalogo
    print("Creando tabla 'vendedores_catalogo'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vendedores_catalogo (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL UNIQUE,
            telefono VARCHAR(50),
            email VARCHAR(100),
            activo BOOLEAN DEFAULT TRUE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'vendedores_catalogo'")

    # Tabla cotizaciones
    print("Creando tabla 'cotizaciones'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cotizaciones (
            id SERIAL PRIMARY KEY,
            folio VARCHAR(20) UNIQUE NOT NULL,
            cliente_nombre VARCHAR(255) NOT NULL,
            cliente_empresa VARCHAR(255),
            cliente_telefono VARCHAR(50),
            cliente_email VARCHAR(100),
            cliente_direccion TEXT,
            vendedor VARCHAR(100) NOT NULL,
            incluye_iva BOOLEAN DEFAULT TRUE,
            subtotal DECIMAL(12, 2) DEFAULT 0,
            iva DECIMAL(12, 2) DEFAULT 0,
            total DECIMAL(12, 2) DEFAULT 0,
            vigencia_dias INTEGER DEFAULT 7,
            notas TEXT,
            estado VARCHAR(20) DEFAULT 'Activa',
            fecha_cotizacion DATE DEFAULT CURRENT_DATE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'cotizaciones'")

    # Tabla items de cotizacion
    print("Creando tabla 'cotizacion_items'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cotizacion_items (
            id SERIAL PRIMARY KEY,
            cotizacion_id INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
            equipo_id INTEGER REFERENCES equipos(id),
            descripcion VARCHAR(500) NOT NULL,
            cantidad INTEGER DEFAULT 1,
            precio_unitario DECIMAL(12, 2) NOT NULL,
            total_linea DECIMAL(12, 2) NOT NULL
        )
    ''')
    print("  OK tabla 'cotizacion_items'")

    # Tabla proveedores
    print("Creando tabla 'proveedores'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS proveedores (
            id SERIAL PRIMARY KEY,
            razon_social VARCHAR(255) NOT NULL,
            contacto_nombre VARCHAR(200),
            correo VARCHAR(100),
            telefono VARCHAR(50),
            whatsapp VARCHAR(50),
            medio_preferido VARCHAR(50) DEFAULT 'WhatsApp',
            notas TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'proveedores'")

    # Tabla plantillas_componentes
    print("Creando tabla 'plantillas_componentes'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plantillas_componentes (
            id SERIAL PRIMARY KEY,
            categoria VARCHAR(100) NOT NULL,
            componente VARCHAR(200) NOT NULL,
            cantidad_default INTEGER DEFAULT 1,
            unidad VARCHAR(50) DEFAULT 'pza'
        )
    ''')
    print("  OK tabla 'plantillas_componentes'")

    # Tabla requisiciones
    print("Creando tabla 'requisiciones'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS requisiciones (
            id SERIAL PRIMARY KEY,
            folio VARCHAR(20) UNIQUE NOT NULL,
            inventario_id INTEGER REFERENCES inventario(id),
            proveedor_id INTEGER REFERENCES proveedores(id),
            equipo_nombre VARCHAR(255),
            no_control VARCHAR(30),
            area VARCHAR(100) DEFAULT 'Departamento de Ingeniería',
            revisado_por VARCHAR(100),
            requerido_por VARCHAR(100),
            estado VARCHAR(20) DEFAULT 'Pendiente',
            notas TEXT,
            emitido_por VARCHAR(100),
            aprobado_por VARCHAR(100),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Agregar columnas nuevas si no existen (para BD existentes)
    for col, tipo in [('no_control', "VARCHAR(30)"),
                      ('area', "VARCHAR(100) DEFAULT 'Departamento de Ingeniería'"),
                      ('revisado_por', 'VARCHAR(100)'),
                      ('requerido_por', 'VARCHAR(100)'),
                      ('numero_serie', 'VARCHAR(100)')]:
        try:
            cursor.execute(f"ALTER TABLE requisiciones ADD COLUMN IF NOT EXISTS {col} {tipo}")
        except Exception:
            pass
    print("  OK tabla 'requisiciones'")

    # Tabla requisicion_items
    print("Creando tabla 'requisicion_items'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS requisicion_items (
            id SERIAL PRIMARY KEY,
            requisicion_id INTEGER NOT NULL REFERENCES requisiciones(id) ON DELETE CASCADE,
            componente VARCHAR(200) NOT NULL,
            proveedor_nombre VARCHAR(100),
            comentario TEXT,
            cantidad INTEGER DEFAULT 1,
            unidad VARCHAR(50) DEFAULT 'pza',
            precio_unitario DECIMAL(12,2) DEFAULT 0,
            tiene_iva BOOLEAN DEFAULT FALSE,
            precio_estimado DECIMAL(12,2) DEFAULT 0 -- Kept for migration safety
        )
    ''')
    print("  OK tabla 'requisicion_items'")

    # Tabla requisicion_envios (rastreo por proveedor)
    print("Creando tabla 'requisicion_envios'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS requisicion_envios (
            id SERIAL PRIMARY KEY,
            requisicion_id INTEGER NOT NULL REFERENCES requisiciones(id) ON DELETE CASCADE,
            proveedor_nombre VARCHAR(100) NOT NULL,
            estado VARCHAR(30) DEFAULT 'Pendiente',
            guia_rastreo VARCHAR(100),
            paqueteria VARCHAR(100),
            nombre_recoge VARCHAR(100),
            telefono_recoge VARCHAR(50),
            notas TEXT,
            fecha_envio DATE,
            fecha_recibido DATE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'requisicion_envios'")

    # Migration: add version column to equipos
    for col, tipo in [('version', "VARCHAR(20) DEFAULT '1.0'")]:
        try:
            cursor.execute(f"ALTER TABLE equipos ADD COLUMN IF NOT EXISTS {col} {tipo}")
        except Exception:
            pass
    print("  OK migracion 'equipos.version'")

    # Tabla equipo_partes (partes tecnicas por maquina)
    print("Creando tabla 'equipo_partes'...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipo_partes (
            id SERIAL PRIMARY KEY,
            equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
            nombre_parte VARCHAR(200) NOT NULL,
            descripcion TEXT,
            cantidad INTEGER DEFAULT 1,
            unidad VARCHAR(50) DEFAULT 'pza',
            proveedor_id INTEGER REFERENCES proveedores(id),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Migration for existing tables
    try:
        cursor.execute("ALTER TABLE equipo_partes ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id)")
    except Exception:
        pass
    print("  OK tabla 'equipo_partes'")

    conn.commit()
    cursor.close()
    conn.close()
    print("=" * 60)
    print("Base de datos inicializada correctamente")
    print("Tablas: equipos, inventario, ventas, cotizaciones, cotizacion_items, proveedores, plantillas_componentes, requisiciones, requisicion_items, equipo_partes")
    print("=" * 60)

if __name__ == '__main__':
    try:
        init_db()
    except Exception as e:
        print(f"FALLO: {e}")
        sys.exit(1)
