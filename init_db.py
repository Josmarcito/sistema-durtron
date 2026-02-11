#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de inicialización de base de datos PostgreSQL para Render
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os

DATABASE_URL = os.environ.get('DATABASE_URL')

def init_db():
    """Inicializar la base de datos PostgreSQL"""
    print("🔧 Inicializando base de datos PostgreSQL...")
    
    if not DATABASE_URL:
        print("❌ ERROR: DATABASE_URL no encontrada")
        return
    
    # Render proporciona DATABASE_URL con postgres://, pero psycopg2 necesita postgresql://
    url = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    conn = psycopg2.connect(url)
    cursor = conn.cursor()
    
    # Tabla de equipos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipos (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(50) UNIQUE NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            marca VARCHAR(100),
            modelo VARCHAR(100),
            numero_serie VARCHAR(100) UNIQUE,
            descripcion TEXT,
            categoria VARCHAR(100),
            precio_lista DECIMAL(10, 2) NOT NULL,
            precio_minimo DECIMAL(10, 2) NOT NULL,
            precio_costo DECIMAL(10, 2),
            ubicacion VARCHAR(200) NOT NULL,
            estado VARCHAR(50) NOT NULL,
            cantidad_disponible INTEGER DEFAULT 1,
            observaciones TEXT,
            fecha_ingreso DATE,
            proveedor VARCHAR(200),
            tiempo_stock_dias INTEGER,
            ficha_tecnica TEXT,
            fotos TEXT,
            especificaciones TEXT,
            potencia_motor VARCHAR(50),
            capacidad VARCHAR(50),
            dimensiones VARCHAR(50),
            peso VARCHAR(50),
            creado_por VARCHAR(100),
            fecha_creacion TIMESTAMP,
            actualizado_por VARCHAR(100),
            fecha_actualizacion TIMESTAMP
        )
    ''')
    
    # Tabla de movimientos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movimientos (
            id SERIAL PRIMARY KEY,
            equipo_id INTEGER REFERENCES equipos(id),
            tipo_movimiento VARCHAR(100) NOT NULL,
            estado_anterior VARCHAR(50),
            estado_nuevo VARCHAR(50),
            ubicacion_anterior VARCHAR(200),
            ubicacion_nueva VARCHAR(200),
            usuario VARCHAR(100),
            fecha TIMESTAMP,
            notas TEXT
        )
    ''')
    
    # Tabla de cotizaciones
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cotizaciones (
            id SERIAL PRIMARY KEY,
            equipo_id INTEGER REFERENCES equipos(id),
            cliente_nombre VARCHAR(255),
            cliente_contacto VARCHAR(100),
            cliente_rfc VARCHAR(20),
            cliente_direccion TEXT,
            precio_ofertado DECIMAL(10, 2),
            descuento_porcentaje DECIMAL(5, 2),
            descuento_monto DECIMAL(10, 2),
            estado VARCHAR(50) NOT NULL,
            vendedor VARCHAR(100),
            fecha_cotizacion DATE,
            fecha_vencimiento DATE,
            fecha_venta DATE,
            autorizado_por VARCHAR(100),
            motivo_descuento TEXT,
            forma_pago VARCHAR(50),
            notas TEXT
        )
    ''')
    
    # Tabla de alertas de precio
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alertas_precio (
            id SERIAL PRIMARY KEY,
            equipo_id INTEGER REFERENCES equipos(id),
            precio_intentado DECIMAL(10, 2),
            precio_minimo DECIMAL(10, 2),
            diferencia DECIMAL(10, 2),
            usuario VARCHAR(100),
            fecha TIMESTAMP,
            autorizado BOOLEAN DEFAULT FALSE,
            motivo TEXT
        )
    ''')
    
    # Tabla de ventas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id SERIAL PRIMARY KEY,
            equipo_id INTEGER NOT NULL REFERENCES equipos(id),
            vendedor VARCHAR(100) NOT NULL,
            cliente_nombre VARCHAR(255) NOT NULL,
            cliente_contacto VARCHAR(100),
            cliente_rfc VARCHAR(20),
            cliente_direccion TEXT,
            precio_venta DECIMAL(10, 2) NOT NULL,
            descuento_monto DECIMAL(10, 2) DEFAULT 0,
            descuento_porcentaje DECIMAL(5, 2) DEFAULT 0,
            motivo_descuento TEXT,
            forma_pago VARCHAR(50),
            autorizado_por VARCHAR(100),
            fecha_venta DATE DEFAULT CURRENT_DATE,
            numero_serie VARCHAR(100),
            notas TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✅ Base de datos PostgreSQL inicializada correctamente")

if __name__ == '__main__':
    init_db()
