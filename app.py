from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import sqlite3
import os
import json

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)
@app.route("/")
def home():
    return jsonify({
        "status": "ok",
        "message": "Sistema Durtron backend corriendo 🚀"
    })

# Configuración para producción
DATABASE = 'inventory.db'
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db():
    """Obtener conexión a la base de datos"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inicializar la base de datos"""
    conn = get_db()
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
    
    # Tabla de cotizaciones
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cotizaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER,
            cliente_nombre TEXT,
            cliente_contacto TEXT,
            cliente_rfc TEXT,
            cliente_direccion TEXT,
            precio_ofertado REAL,
            descuento_porcentaje REAL,
            descuento_monto REAL,
            estado TEXT NOT NULL,
            vendedor TEXT,
            fecha_cotizacion TEXT,
            fecha_vencimiento TEXT,
            fecha_venta TEXT,
            autorizado_por TEXT,
            motivo_descuento TEXT,
            forma_pago TEXT,
            notas TEXT,
            FOREIGN KEY (equipo_id) REFERENCES equipos (id)
        )
    ''')
    
    # Tabla de alertas de precio
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alertas_precio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER,
            precio_intentado REAL,
            precio_minimo REAL,
            diferencia REAL,
            usuario TEXT,
            fecha TEXT,
            autorizado BOOLEAN DEFAULT 0,
            motivo TEXT,
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


# ==================== RUTAS WEB ====================

# @app.route('/')
# def index():
#     """Servir el frontend"""
#     return send_from_directory('frontend', 'index.html')

# @app.route('/<path:path>')
# def serve_static(path):
#     """Servir archivos estáticos"""
#     return send_from_directory('frontend', path)

# ==================== RUTAS API ====================

@app.route('/api/equipos', methods=['GET'])
def get_equipos():
    """Obtener todos los equipos"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM equipos ORDER BY fecha_ingreso DESC')
    equipos = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(equipos)

@app.route('/api/equipos/<int:id>', methods=['GET'])
def get_equipo(id):
    """Obtener un equipo específico"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM equipos WHERE id = ?', (id,))
    equipo = cursor.fetchone()
    conn.close()
    
    if equipo:
        return jsonify(dict(equipo))
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        
        equipo_id = cursor.lastrowid
        
        # Registrar movimiento
        cursor.execute('''
            INSERT INTO movimientos (
                equipo_id, tipo_movimiento, estado_nuevo, fecha, notas
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            equipo_id,
            'Ingreso',
            data.get('estado', 'Disponible'),
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'Registro inicial de equipo'
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'id': equipo_id,
            'message': 'Equipo creado exitosamente'
        }), 201
        
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({
            'success': False,
            'error': 'El código de equipo ya existe'
        }), 400
    except Exception as e:
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
    cursor.execute('SELECT estado, ubicacion FROM equipos WHERE id = ?', (id,))
    equipo_actual = cursor.fetchone()
    
    if not equipo_actual:
        conn.close()
        return jsonify({'error': 'Equipo no encontrado'}), 404
    
    try:
        cursor.execute('''
            UPDATE equipos SET
                nombre = ?, marca = ?, modelo = ?, categoria = ?,
                precio_lista = ?, precio_minimo = ?, precio_costo = ?,
                ubicacion = ?, estado = ?, especificaciones = ?,
                potencia_motor = ?, capacidad = ?, dimensiones = ?, peso = ?,
                cantidad_disponible = ?, observaciones = ?,
                fecha_actualizacion = ?
            WHERE id = ?
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
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Equipo actualizado exitosamente'
        })
        
    except Exception as e:
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
    cursor.execute('SELECT * FROM equipos WHERE id = ?', (id,))
    equipo = cursor.fetchone()
    
    if not equipo:
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
            WHERE numero_serie LIKE ?
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                numero_serie = ?,
                cantidad_disponible = cantidad_disponible - 1,
                fecha_actualizacion = ?
            WHERE id = ?
        ''', (numero_serie, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Venta registrada exitosamente',
            'numero_serie': numero_serie,
            'descuento_porcentaje': round(descuento_porcentaje, 2)
        })
        
    except Exception as e:
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
    
    ventas = [dict(row) for row in cursor.fetchall()]
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
        WHERE strftime('%Y-%m', fecha_venta) = strftime('%Y-%m', 'now')
    ''')
    ventas_mes = cursor.fetchone()
    
    conn.close()
    
    return jsonify({
        'total_equipos': total_equipos,
        'por_estado': por_estado,
        'por_ubicacion': por_ubicacion,
        'ventas_mes': {
            'cantidad': ventas_mes['total'] or 0,
            'ingresos': ventas_mes['ingresos'] or 0
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

# Inicializar BD al arrancar
if not os.path.exists(DATABASE):
    init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
