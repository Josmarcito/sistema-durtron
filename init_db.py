#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de inicialización de base de datos para Render
"""

import sqlite3
import os

DATABASE = 'inventory.db'

def init_db():
    """Inicializar la base de datos"""
    print("🔧 Inicializando base de datos...")
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Tabla de equipos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            marca TEXT,
            modelo TEXT,
            numero_serie TEXT UNIQUE,
            descripcion TEXT,
            categoria TEXT,
            precio_lista REAL NOT NULL,
            precio_minimo REAL NOT NULL,
            precio_costo REAL,
            ubicacion TEXT NOT NULL,
            estado TEXT NOT NULL,
            cantidad_disponible INTEGER DEFAULT 1,
            observaciones TEXT,
            fecha_ingreso TEXT,
            proveedor TEXT,
            tiempo_stock_dias INTEGER,
            ficha_tecnica TEXT,
            fotos TEXT,
            especificaciones TEXT,
            potencia_motor TEXT,
            capacidad TEXT,
            dimensiones TEXT,
            peso TEXT,
            creado_por TEXT,
            fecha_creacion TEXT,
            actualizado_por TEXT,
            fecha_actualizacion TEXT
        )
    ''')
    
    # Tabla de movimientos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER,
            tipo_movimiento TEXT NOT NULL,
            estado_anterior TEXT,
            estado_nuevo TEXT,
            ubicacion_anterior TEXT,
            ubicacion_nueva TEXT,
            usuario TEXT,
            fecha TEXT,
            notas TEXT,
            FOREIGN KEY (equipo_id) REFERENCES equipos (id)
        )
    ''')
    
    # Tabla de ventas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER NOT NULL,
            vendedor TEXT NOT NULL,
            cliente_nombre TEXT NOT NULL,
            cliente_contacto TEXT,
            cliente_rfc TEXT,
            cliente_direccion TEXT,
            precio_venta REAL NOT NULL,
            descuento_monto REAL DEFAULT 0,
            descuento_porcentaje REAL DEFAULT 0,
            motivo_descuento TEXT,
            forma_pago TEXT,
            autorizado_por TEXT,
            fecha_venta DATE DEFAULT CURRENT_DATE,
            numero_serie TEXT,
            notas TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (equipo_id) REFERENCES equipos (id)
        )
    ''')
    
    conn.commit()
    conn.close()
    
    print("✅ Base de datos inicializada correctamente")

if __name__ == '__main__':
    init_db()
