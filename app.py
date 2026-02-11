from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

# Configuración para producción
DATABASE_URL = os.environ.get('DATABASE_URL')
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db():
    """Obtener conexión a la base de datos PostgreSQL"""
    # Render proporciona DATABASE_URL con postgres://, pero psycopg2 necesita postgresql://
    if DATABASE_URL:
        url = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    else:
        # Fallback para desarrollo local (no debería pasar en producción)
        conn = psycopg2.connect(
            dbname='durtron',
            user='postgres',
            password='postgres',
            host='localhost',
            cursor_factory=RealDictCursor
        )
    return conn

def init_db():
    """Inicializar la base de datos PostgreSQL"""
    conn = get_db()
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

# ==================== RUTAS API (DEBEN IR PRIMERO) ====================

@app.route('/api/equipos', methods=['GET'])
def get_equipos():
    """Obtener todos los equipos"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM equipos ORDER BY fecha_ingreso DESC')
    equipos = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(equipos)

@app.route('/api/equipos/<int:id>', methods=['GET'])
def get_equipo(id):
    """Obtener un equipo específico"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM equipos WHERE id = %s', (id,))
    equipo = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if equipo:
        return jsonify(equipo)
    return jsonify({'error': 'Equipo no encontrado'}), 404

@app.route('/api/equipos', methods=['POST'])
def crear_equipo():
    """Crear un nuevo equipo"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO equipos (
                codigo, nombre, marca, modelo, categoria,
                precio_lista, precio_minimo, precio_costo,
                ubicacion, estado, especificaciones,
                potencia_motor, capacidad, dimensiones, peso,
                cantidad_disponible, observaciones, fecha_ingreso
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            data.get('codigo'),
            data.get('nombre'),
            data.get('marca'),
            data.get('modelo'),
            data.get('categoria'),
            data.get('precio_lista'),
            data.get('precio_minimo'),
            data.get('precio_costo'),
            data.get('ubicacion'),
            data.get('estado', 'Disponible'),
            data.get('especificaciones'),
            data.get('potencia_motor'),
            data.get('capacidad'),
            data.get('dimensiones'),
            data.get('peso'),
            data.get('cantidad_disponible', 1),
            data.get('observaciones'),
            datetime.now().strftime('%Y-%m-%d')
        ))
        
        equipo_id = cursor.fetchone()['id']
        
        # Registrar movimiento
        cursor.execute('''
            INSERT INTO movimientos (
                equipo_id, tipo_movimiento, estado_nuevo, fecha, notas
            ) VALUES (%s, %s, %s, %s, %s)
        ''', (
            equipo_id,
            'Ingreso',
            data.get('estado', 'Disponible'),
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'Registro inicial de equipo'
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'id': equipo_id,
            'message': 'Equipo creado exitosamente'
        }), 201
        
    except psycopg2.IntegrityError as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({
            'success': False,
            'error': 'El código de equipo ya existe'
        }), 400
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/equipos/<int:id>', methods=['PUT'])
def actualizar_equipo(id):
    """Actualizar un equipo existente"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    # Obtener estado actual
    cursor.execute('SELECT estado, ubicacion FROM equipos WHERE id = %s', (id,))
    equipo_actual = cursor.fetchone()
    
    if not equipo_actual:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Equipo no encontrado'}), 404
    
    try:
        cursor.execute('''
            UPDATE equipos SET
                nombre = %s, marca = %s, modelo = %s, categoria = %s,
                precio_lista = %s, precio_minimo = %s, precio_costo = %s,
                ubicacion = %s, estado = %s, especificaciones = %s,
                potencia_motor = %s, capacidad = %s, dimensiones = %s, peso = %s,
                cantidad_disponible = %s, observaciones = %s,
                fecha_actualizacion = %s
            WHERE id = %s
        ''', (
            data.get('nombre'),
            data.get('marca'),
            data.get('modelo'),
            data.get('categoria'),
            data.get('precio_lista'),
            data.get('precio_minimo'),
            data.get('precio_costo'),
            data.get('ubicacion'),
            data.get('estado'),
            data.get('especificaciones'),
            data.get('potencia_motor'),
            data.get('capacidad'),
            data.get('dimensiones'),
            data.get('peso'),
            data.get('cantidad_disponible'),
            data.get('observaciones'),
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            id
        ))
        
        # Registrar movimiento si cambió estado/ubicación
        if (data.get('estado') != equipo_actual['estado'] or 
            data.get('ubicacion') != equipo_actual['ubicacion']):
            
            cursor.execute('''
                INSERT INTO movimientos (
                    equipo_id, tipo_movimiento,
                    estado_anterior, estado_nuevo,
                    ubicacion_anterior, ubicacion_nueva,
                    fecha, notas
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                id,
                'Cambio de Estado/Ubicación',
                equipo_actual['estado'],
                data.get('estado'),
                equipo_actual['ubicacion'],
                data.get('ubicacion'),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                data.get('observaciones', 'Actualización de equipo')
            ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Equipo actualizado exitosamente'
        })
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/equipos/<int:id>/vender', methods=['POST'])
def vender_equipo(id):
    """Registrar venta de un equipo"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    # Obtener información del equipo
    cursor.execute('SELECT * FROM equipos WHERE id = %s', (id,))
    equipo = cursor.fetchone()
    
    if not equipo:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Equipo no encontrado'}), 404
    
    precio_venta = float(data.get('precio_venta', 0))
    precio_lista = float(equipo['precio_lista'])
    precio_minimo = float(equipo['precio_minimo'])
    
    # Calcular descuento
    descuento_monto = precio_lista - precio_venta
    descuento_porcentaje = (descuento_monto / precio_lista) * 100 if precio_lista > 0 else 0
    
    # Verificar autorización
    requiere_autorizacion = precio_venta < precio_minimo
    
    if requiere_autorizacion:
        password = data.get('password_gerente', '')
        if password != 'gerente123':  # Cambiar en producción
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Contraseña de gerente incorrecta',
                'requiere_autorizacion': True
            }), 403
        
        autorizado_por = 'Gerente'
    else:
        autorizado_por = 'Automático'
    
    try:
        # Generar número de serie
        año = datetime.now().year
        cursor.execute('''
            SELECT COUNT(*) as count FROM ventas 
            WHERE numero_serie LIKE %s
        ''', (f"DUR-{equipo['modelo']}-{año}-%",))
        
        count = cursor.fetchone()['count']
        numero_serie = f"DUR-{equipo['modelo']}-{año}-{count+1:04d}"
        
        # Registrar venta
        cursor.execute('''
            INSERT INTO ventas (
                equipo_id, vendedor, cliente_nombre, cliente_contacto,
                cliente_rfc, cliente_direccion, precio_venta,
                descuento_monto, descuento_porcentaje, motivo_descuento,
                forma_pago, autorizado_por, numero_serie, notas
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            id,
            data.get('vendedor'),
            data.get('cliente_nombre'),
            data.get('cliente_contacto'),
            data.get('cliente_rfc'),
            data.get('cliente_direccion'),
            precio_venta,
            descuento_monto,
            descuento_porcentaje,
            data.get('motivo_descuento'),
            data.get('forma_pago'),
            autorizado_por,
            numero_serie,
            data.get('notas')
        ))
        
        # Actualizar equipo
        cursor.execute('''
            UPDATE equipos SET
                estado = 'Vendida',
                numero_serie = %s,
                cantidad_disponible = cantidad_disponible - 1,
                fecha_actualizacion = %s
            WHERE id = %s
        ''', (numero_serie, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Venta registrada exitosamente',
            'numero_serie': numero_serie,
            'descuento_porcentaje': round(descuento_porcentaje, 2)
        })
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ventas', methods=['GET'])
def get_ventas():
    """Obtener todas las ventas"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT v.*, e.codigo, e.nombre, e.modelo
        FROM ventas v
        LEFT JOIN equipos e ON v.equipo_id = e.id
        ORDER BY v.fecha_venta DESC
    ''')
    
    ventas = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jsonify(ventas)

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Obtener estadísticas para el dashboard"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Total de equipos
    cursor.execute('SELECT COUNT(*) as total FROM equipos')
    total_equipos = cursor.fetchone()['total']
    
    # Equipos por estado
    cursor.execute('''
        SELECT estado, COUNT(*) as cantidad
        FROM equipos
        GROUP BY estado
    ''')
    por_estado = {row['estado']: row['cantidad'] for row in cursor.fetchall()}
    
    # Equipos por ubicación
    cursor.execute('''
        SELECT ubicacion, COUNT(*) as cantidad
        FROM equipos
        GROUP BY ubicacion
    ''')
    por_ubicacion = {row['ubicacion']: row['cantidad'] for row in cursor.fetchall()}
    
    # Ventas del mes
    cursor.execute('''
        SELECT COUNT(*) as total, SUM(precio_venta) as ingresos
        FROM ventas
        WHERE EXTRACT(YEAR FROM fecha_venta) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM fecha_venta) = EXTRACT(MONTH FROM CURRENT_DATE)
    ''')
    ventas_mes = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    return jsonify({
        'total_equipos': total_equipos,
        'por_estado': por_estado,
        'por_ubicacion': por_ubicacion,
        'ventas_mes': {
            'cantidad': ventas_mes['total'] or 0,
            'ingresos': float(ventas_mes['ingresos'] or 0)
        }
    })

@app.route('/api/config', methods=['GET'])
def get_config():
    """Obtener configuración del sistema"""
    return jsonify({
        'estados': [
            'Disponible',
            'En Piso de Venta',
            'En Bodega/Almacén',
            'Apartada',
            'En Cotización',
            'Vendida - Por Entregar',
            'Vendida - Entregada',
            'En Tránsito'
        ],
        'ubicaciones': [
            'Piso de Venta - Showroom',
            'Bodega Principal',
            'Bodega Secundaria',
            'En Producción',
            'Área de Exhibición',
            'Almacén Externo'
        ],
        'categorias': [
            'Quebradoras de Quijada',
            'Pulverizadores de Martillos',
            'Molinos de Bolas',
            'Bandas Transportadoras',
            'Tolvas',
            'Tanques Agitadores',
            'Mesas de Concentración',
            'Concentradores Centrífugos',
            'Equipo de Laboratorio'
        ],
        'formas_pago': [
            'Efectivo',
            'Transferencia Bancaria',
            'Cheque',
            'Tarjeta de Crédito',
            'Financiamiento'
        ]
    })

# ==================== RUTAS WEB (AL FINAL) ====================

@app.route('/')
def index():
    """Servir el frontend"""
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Servir archivos estáticos"""
    # No capturar rutas API
    if path.startswith('api/'):
        return jsonify({'error': 'API route not found'}), 404
    
    try:
        return send_from_directory('frontend', path)
    except:
        # Si no encuentra el archivo, devuelve index.html
        return send_from_directory('frontend', 'index.html')

# Inicializar BD al arrancar
if __name__ == '__main__':
    # Solo inicializar en producción si la variable de entorno está presente
    if DATABASE_URL:
        try:
            init_db()
            print("✅ Base de datos PostgreSQL inicializada")
        except Exception as e:
            print(f"⚠️ Error inicializando BD: {e}")
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
