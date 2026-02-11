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

    # Limpiar tablas anteriores
    print("Limpiando tablas anteriores...")
    cursor.execute("DROP TABLE IF EXISTS ventas CASCADE")
    cursor.execute("DROP TABLE IF EXISTS inventario CASCADE")
    cursor.execute("DROP TABLE IF EXISTS cotizaciones CASCADE")
    cursor.execute("DROP TABLE IF EXISTS alertas_precio CASCADE")
    cursor.execute("DROP TABLE IF EXISTS movimientos CASCADE")
    cursor.execute("DROP TABLE IF EXISTS equipos CASCADE")
    print("Tablas anteriores eliminadas")

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
            fecha_venta DATE DEFAULT CURRENT_DATE,
            notas TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  OK tabla 'ventas'")

    conn.commit()
    cursor.close()
    conn.close()
    print("=" * 60)
    print("Base de datos inicializada correctamente")
    print("Tablas: equipos, inventario, ventas")
    print("=" * 60)

if __name__ == '__main__':
    try:
        init_db()
    except Exception as e:
        print(f"FALLO: {e}")
        sys.exit(1)
