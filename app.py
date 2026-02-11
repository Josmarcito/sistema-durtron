from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import os

app = Flask(__name__, static_folder='frontend')
CORS(app)

# Configuración de PostgreSQL
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    """Obtener conexión a PostgreSQL"""
    if not DATABASE_URL:
        raise Exception("DATABASE_URL no configurada")
    
    # Render usa postgres:// pero psycopg2 necesita postgresql://
    url = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    return psycopg2.connect(url, cursor_factory=RealDictCursor)

# ==================== RUTAS ESTÁTICAS ====================

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('frontend', path)

# ==================== API - CONFIGURACIÓN ====================

@app.route('/api/config', methods=['GET'])
def get_config():
    """Obtener configuración de estados, ubicaciones, etc."""
    config = {
        'estados': [
            'Disponible',
            'Apartada',
            'Vendida',
            'En Tránsito',
            'En Reparación',
            'No Disponible'
        ],
        'ubicaciones': [
            'Bodega Principal',
            'Piso de Venta',
            'Bodega 2',
            'En Tránsito',
            'Cliente'
        ],
        'categorias': [
            'Quebradoras',
            'Molinos',
            'Cribas',
            'Bandas Transportadoras',
            'Equipos Auxiliares',
            'Otro'
        ],
        'formas_pago': [
            'Contado',
            'Crédito 30 días',
            'Crédito 60 días',
            'Crédito 90 días',
            'Anticipo + Contraentrega',
            'Otro'
        ]
    }
    return jsonify(config)

# ==================== API - DASHBOARD ====================

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Obtener estadísticas del dashboard"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Total de equipos
        cursor.execute('SELECT COUNT(*) as total FROM equipos')
        total_equipos = cursor.fetchone()['total']
        
        # Equipos disponibles
        cursor.execute("SELECT COUNT(*) as total FROM equipos WHERE estado = 'Disponible'")
        equipos_disponibles = cursor.fetchone()['total']
        
        # Total de ventas
        cursor.execute('SELECT COUNT(*) as total FROM ventas')
        total_ventas = cursor.fetchone()['total']
        
        # Ingresos totales
        cursor.execute('SELECT COALESCE(SUM(precio_venta), 0) as total FROM ventas')
        ingresos_totales = cursor.fetchone()['total']
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'total_equipos': total_equipos,
            'equipos_disponibles': equipos_disponibles,
            'total_ventas': total_ventas,
            'ingresos_totales': float(ingresos_totales) if ingresos_totales else 0
        })
    except Exception as e:
        print(f"Error en dashboard: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ==================== API - EQUIPOS ====================

@app.route('/api/equipos', methods=['GET'])
def get_equipos():
    """Obtener todos los equipos"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM equipos 
            ORDER BY fecha_creacion DESC
        ''')
        
        equipos = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify(equipos)
    except Exception as e:
        print(f"Error al obtener equipos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos', methods=['POST'])
def create_equipo():
    """Crear nuevo equipo"""
    try:
        data = request.json
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO equipos (
                codigo, nombre, marca, modelo, numero_serie,
                descripcion, categoria, precio_lista, precio_minimo, precio_costo,
                ubicacion, estado, cantidad_disponible,
                especificaciones, potencia_motor, capacidad,
                dimensiones, peso, observaciones,
                fecha_creacion
            ) VALUES (
                %(codigo)s, %(nombre)s, %(marca)s, %(modelo)s, %(numero_serie)s,
                %(descripcion)s, %(categoria)s, %(precio_lista)s, %(precio_minimo)s, %(precio_costo)s,
                %(ubicacion)s, %(estado)s, %(cantidad_disponible)s,
                %(especificaciones)s, %(potencia_motor)s, %(capacidad)s,
                %(dimensiones)s, %(peso)s, %(observaciones)s,
                CURRENT_TIMESTAMP
            ) RETURNING id
        ''', data)
        
        equipo_id = cursor.fetchone()['id']
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'id': equipo_id, 'message': 'Equipo creado exitosamente'}), 201
    except Exception as e:
        print(f"Error al crear equipo: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:equipo_id>', methods=['GET'])
def get_equipo(equipo_id):
    """Obtener un equipo específico"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM equipos WHERE id = %s', (equipo_id,))
        equipo = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if equipo:
            return jsonify(equipo)
        return jsonify({'error': 'Equipo no encontrado'}), 404
    except Exception as e:
        print(f"Error al obtener equipo: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:equipo_id>', methods=['PUT'])
def update_equipo(equipo_id):
    """Actualizar un equipo"""
    try:
        data = request.json
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE equipos SET
                codigo = %(codigo)s,
                nombre = %(nombre)s,
                marca = %(marca)s,
                modelo = %(modelo)s,
                numero_serie = %(numero_serie)s,
                descripcion = %(descripcion)s,
                categoria = %(categoria)s,
                precio_lista = %(precio_lista)s,
                precio_minimo = %(precio_minimo)s,
                precio_costo = %(precio_costo)s,
                ubicacion = %(ubicacion)s,
                estado = %(estado)s,
                cantidad_disponible = %(cantidad_disponible)s,
                especificaciones = %(especificaciones)s,
                potencia_motor = %(potencia_motor)s,
                capacidad = %(capacidad)s,
                dimensiones = %(dimensiones)s,
                peso = %(peso)s,
                observaciones = %(observaciones)s,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = %(id)s
        ''', {**data, 'id': equipo_id})
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Equipo actualizado exitosamente'})
    except Exception as e:
        print(f"Error al actualizar equipo: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:equipo_id>', methods=['DELETE'])
def delete_equipo(equipo_id):
    """Eliminar un equipo"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM equipos WHERE id = %s', (equipo_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Equipo eliminado exitosamente'})
    except Exception as e:
        print(f"Error al eliminar equipo: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ==================== API - VENTAS ====================

@app.route('/api/ventas', methods=['GET'])
def get_ventas():
    """Obtener todas las ventas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT v.*, e.nombre as equipo_nombre, e.modelo as equipo_modelo
            FROM ventas v
            LEFT JOIN equipos e ON v.equipo_id = e.id
            ORDER BY v.fecha_venta DESC
        ''')
        
        ventas = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify(ventas)
    except Exception as e:
        print(f"Error al obtener ventas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ventas', methods=['POST'])
def create_venta():
    """Registrar una venta"""
    try:
        data = request.json
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Insertar venta
        cursor.execute('''
            INSERT INTO ventas (
                equipo_id, vendedor, cliente_nombre, cliente_contacto,
                cliente_rfc, cliente_direccion, precio_venta,
                descuento_monto, descuento_porcentaje, motivo_descuento,
                forma_pago, autorizado_por, numero_serie, notas
            ) VALUES (
                %(equipo_id)s, %(vendedor)s, %(cliente_nombre)s, %(cliente_contacto)s,
                %(cliente_rfc)s, %(cliente_direccion)s, %(precio_venta)s,
                %(descuento_monto)s, %(descuento_porcentaje)s, %(motivo_descuento)s,
                %(forma_pago)s, %(autorizado_por)s, %(numero_serie)s, %(notas)s
            ) RETURNING id
        ''', data)
        
        venta_id = cursor.fetchone()['id']
        
        # Actualizar estado del equipo a "Vendida"
        cursor.execute('''
            UPDATE equipos 
            SET estado = 'Vendida', 
                cantidad_disponible = 0,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (data['equipo_id'],))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'id': venta_id, 'message': 'Venta registrada exitosamente'}), 201
    except Exception as e:
        print(f"Error al crear venta: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ==================== VERIFICACIÓN DE SALUD ====================

@app.route('/health')
def health():
    """Endpoint de verificación de salud"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.close()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
