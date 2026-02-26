from flask import Flask, request, jsonify, send_from_directory, send_file, session, redirect, Response
from flask_cors import CORS
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date
from decimal import Decimal
import os
import json
import secrets
import io
import logging
import traceback
import threading
from PIL import Image, ImageDraw, ImageFont

app = Flask(__name__, static_folder='frontend')
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'durtron-secret-key-2024-cambiar')
CORS(app, supports_credentials=True)

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://durtron:RBYwTg26IgSlKJN8giieAhUmylzpTzn6@dpg-d66b4d6sb7us73clsr7g-a/durtron')

# Credenciales de acceso (puedes cambiarlas aqui o en variables de entorno de Render)
AUTH_USER = os.environ.get('AUTH_USER', 'durtron')
AUTH_PASS = os.environ.get('AUTH_PASS', 'durtron2024')

MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

def get_db():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL no configurada")
    url = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    return psycopg2.connect(url, cursor_factory=RealDictCursor)

# Auto-migrar columnas nuevas al iniciar
def run_migrations():
    try:
        conn = get_db()
        cur = conn.cursor()
        migrations = [
            "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tiene_anticipo BOOLEAN DEFAULT FALSE",
            "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS anticipo_monto DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS anticipo_fecha DATE",
        ]
        # Helper to execute safely
        def safe_execute(sql, desc):
            try:
                cur.execute(sql)
                conn.commit() # Commit after each success to save progress
            except Exception as e:
                conn.rollback() # Rollback ONLY this failure to reset transaction state
                print(f"Warning ({desc}): {e}")

        for sql in migrations:
            safe_execute(sql, "ventas migration")

        # Phase B: tablas nuevas
        phase_b_tables = [
            """CREATE TABLE IF NOT EXISTS proveedores (
                id SERIAL PRIMARY KEY,
                razon_social VARCHAR(255) NOT NULL,
                contacto_nombre VARCHAR(200),
                correo VARCHAR(100),
                telefono VARCHAR(50),
                whatsapp VARCHAR(50),
                medio_preferido VARCHAR(50) DEFAULT 'WhatsApp',
                notas TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS plantillas_componentes (
                id SERIAL PRIMARY KEY,
                categoria VARCHAR(100) NOT NULL,
                componente VARCHAR(200) NOT NULL,
                cantidad_default INTEGER DEFAULT 1,
                unidad VARCHAR(50) DEFAULT 'pza'
            )""",
            """CREATE TABLE IF NOT EXISTS requisiciones (
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
            )""",
            """CREATE TABLE IF NOT EXISTS requisicion_items (
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
            )""",
        ]
        for sql in phase_b_tables:
            safe_execute(sql, "phase_b table")
        
        # Migraciones adicionales para campos nuevos en Requisiciones (Refinamiento Usuario)
        # These are now handled by safe_execute individually or as part of req_items_cols
        # The original 'refinements' list is removed as per the instruction.

        # Tabla equipo_partes para partes técnicas por máquina
        partes_table = [
            """CREATE TABLE IF NOT EXISTS equipo_partes (
                id SERIAL PRIMARY KEY,
                equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                nombre_parte VARCHAR(200) NOT NULL,
                descripcion TEXT,
                cantidad INTEGER DEFAULT 1,
                unidad VARCHAR(50) DEFAULT 'pza',
                proveedor_id INTEGER REFERENCES proveedores(id),
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            "ALTER TABLE equipo_partes ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id)",
        ]
        for sql in partes_table:
            safe_execute(sql, "equipo_partes table")

        # Explicit migrations
        safe_execute("ALTER TABLE equipo_partes ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id)", "equipo_partes.proveedor_id")
        
        # Requests items migrations
        req_items_cols = [
             "ALTER TABLE requisicion_items ADD COLUMN IF NOT EXISTS proveedor_nombre VARCHAR(100)",
             "ALTER TABLE requisicion_items ADD COLUMN IF NOT EXISTS comentario TEXT",
             "ALTER TABLE requisicion_items ADD COLUMN IF NOT EXISTS unidad VARCHAR(50) DEFAULT 'pza'",
             "ALTER TABLE requisicion_items ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(12,2) DEFAULT 0",
             "ALTER TABLE requisicion_items ADD COLUMN IF NOT EXISTS tiene_iva BOOLEAN DEFAULT FALSE"
        ]
        for sql in req_items_cols:
             safe_execute(sql, "req_items col")

        # Equipos label fields
        equipos_label_cols = [
            "ALTER TABLE equipos ADD COLUMN IF NOT EXISTS apertura VARCHAR(50)",
            "ALTER TABLE equipos ADD COLUMN IF NOT EXISTS tamano_alimentacion VARCHAR(50)",
            "ALTER TABLE equipos ADD COLUMN IF NOT EXISTS fecha_fabricacion DATE",
        ]
        for sql in equipos_label_cols:
            safe_execute(sql, "equipos label col")

        # Serial number counter table
        safe_execute("CREATE TABLE IF NOT EXISTS serial_counters (equipo_codigo VARCHAR(50) PRIMARY KEY, last_serial INTEGER DEFAULT 0)", "serial_counters table")

        # Cotizaciones discount and anticipo columns
        cot_cols = [
            "ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0",
            "ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS descuento_monto DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS anticipo_porcentaje DECIMAL(5,2) DEFAULT 0",
            "ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS anticipo_monto DECIMAL(12,2) DEFAULT 0",
        ]
        for sql in cot_cols:
            safe_execute(sql, "cotizaciones col")

        # Cotizacion items modelo column
        safe_execute("ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS modelo VARCHAR(100)", "cot_items modelo col")

        conn.commit()
        cur.close()
        conn.close()
        print("Migraciones ejecutadas OK")
    except Exception as e:
        print(f"Error CRITICO en migraciones: {e}")

run_migrations()

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    raise TypeError

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            # Si es una peticion API, devolver 401
            if request.path.startswith('/api/'):
                return jsonify({'error': 'No autorizado'}), 401
            # Si es una pagina, redirigir al login
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated

# ==================== AUTH ====================
@app.route('/login')
def login_page():
    return send_from_directory('frontend', 'login.html')

@app.route('/api/login', methods=['POST'])
def login():
    d = request.json or {}
    user = d.get('usuario', '')
    pwd = d.get('password', '')
    if user == AUTH_USER and pwd == AUTH_PASS:
        session['logged_in'] = True
        session['usuario'] = user
        return jsonify({'success': True, 'message': 'Acceso concedido'})
    return jsonify({'error': 'Usuario o contraseña incorrecta'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Sesion cerrada'})

@app.route('/api/check-auth')
def check_auth():
    if session.get('logged_in'):
        return jsonify({'authenticated': True, 'usuario': session.get('usuario')})
    return jsonify({'authenticated': False}), 401

# ==================== RUTAS ESTATICAS ====================
@app.route('/')
@login_required
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    # Permitir acceso a login.html y sus recursos sin autenticar
    if path in ('login.html', 'style.css', 'logo.png'):
        return send_from_directory('frontend', path)
    if not session.get('logged_in'):
        return redirect('/login')
    return send_from_directory('frontend', path)

# ==================== CONFIGURACION ====================
# Proteger todas las rutas /api/ excepto auth y health
@app.before_request
def check_auth_before():
    open_paths = ('/api/login', '/api/logout', '/api/check-auth', '/api/init-db', '/health', '/login')
    if request.path in open_paths or not request.path.startswith('/api/'):
        return None
    if not session.get('logged_in'):
        return jsonify({'error': 'No autorizado'}), 401

@app.route('/api/config')
def get_config():
    return jsonify({
        'estados_inventario': [
            'Disponible', 'En Fabricacion', 'Disponible - Faltan Piezas'
        ],
        'categorias': [
            'Quebradoras de Quijadas', 'Pulverizadores de Martillos',
            'Molinos de Bolas', 'Mesas de Concentracion',
            'Cribas Vibratorias', 'Bandas Transportadoras',
            'Tolvas', 'Tanques Agitadores', 'Concentrador Centrifugo',
            'Planta Integral 500kg/hr', 'Planta Integral 1 ton/hr', 'Planta Integral 2 ton/hr',
            'Quebradora de Laboratorio', 'Pulverizador de Laboratorio', 'Mesa de Laboratorio',
            'Otro'
        ],
        'formas_pago': [
            'Contado', 'Credito 30 dias', 'Credito 60 dias', 'Credito 90 dias',
            'Anticipo + Contraentrega', 'Transferencia', 'Otro'
        ]
    })

# ==================== DASHBOARD ====================
@app.route('/api/dashboard')
def get_dashboard():
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute('SELECT COUNT(*) as total FROM equipos')
        total_catalogo = cur.fetchone()['total']

        cur.execute('SELECT COUNT(*) as total FROM inventario')
        total_inventario = cur.fetchone()['total']

        # Ingresos: No Facturado, Facturado, Total + Utilidad Bruta
        cur.execute('''
            SELECT
                COALESCE(SUM(CASE WHEN facturado=false THEN precio_venta ELSE 0 END),0) as no_facturado,
                COALESCE(SUM(CASE WHEN facturado=true THEN precio_venta * 1.16 ELSE 0 END),0) as facturado,
                COALESCE(SUM(v.precio_venta - COALESCE(e.precio_costo,0)),0) as utilidad,
                COUNT(*) as total_ventas
            FROM ventas v
            LEFT JOIN equipos e ON v.equipo_id = e.id
        ''')
        row = cur.fetchone()
        ingreso_no_facturado = round(float(row['no_facturado']), 2)
        ingreso_facturado = round(float(row['facturado']), 2)
        ingreso_total = round(ingreso_no_facturado + ingreso_facturado, 2)
        utilidad_bruta = round(float(row['utilidad']), 2)
        total_ventas = row['total_ventas']

        # Top equipos más vendidos (porcentaje por volumen de venta)
        cur.execute('''
            SELECT e.nombre, e.codigo, COUNT(v.id) as total_vendidos,
                   COALESCE(SUM(CASE WHEN v.facturado=true THEN v.precio_venta * 1.16 ELSE v.precio_venta END),0) as ingreso_total
            FROM ventas v
            JOIN equipos e ON v.equipo_id = e.id
            GROUP BY e.nombre, e.codigo
            ORDER BY total_vendidos DESC, ingreso_total DESC
            LIMIT 10
        ''')
        top_equipos = [dict(r) for r in cur.fetchall()]
        total_unidades = sum(t['total_vendidos'] for t in top_equipos)
        for t in top_equipos:
            t['ingreso_total'] = round(float(t['ingreso_total']), 2)
            t['porcentaje'] = round(t['total_vendidos'] / total_unidades * 100, 1) if total_unidades > 0 else 0

        # Historial anual (2026-2030) con desglose mensual
        cur.execute('''
            SELECT EXTRACT(YEAR FROM fecha_venta)::int as anio,
                   EXTRACT(MONTH FROM fecha_venta)::int as mes,
                   COUNT(*) as ventas,
                   COALESCE(SUM(CASE WHEN facturado=false THEN precio_venta ELSE 0 END),0) as no_facturado,
                   COALESCE(SUM(CASE WHEN facturado=true THEN precio_venta * 1.16 ELSE 0 END),0) as facturado
            FROM ventas
            WHERE EXTRACT(YEAR FROM fecha_venta) BETWEEN 2026 AND 2030
            GROUP BY anio, mes ORDER BY anio, mes
        ''')
        monthly_data = {}
        for r in cur.fetchall():
            y = r['anio']
            if y not in monthly_data:
                monthly_data[y] = {}
            nf = round(float(r['no_facturado']), 2)
            f = round(float(r['facturado']), 2)
            monthly_data[y][r['mes']] = {
                'mes': r['mes'],
                'nombre': MESES[r['mes'] - 1],
                'ventas': r['ventas'],
                'no_facturado': nf,
                'facturado': f,
                'total': round(nf + f, 2)
            }

        historial_anual = []
        default_month = {'ventas': 0, 'no_facturado': 0, 'facturado': 0, 'total': 0}
        for y in range(2026, 2031):
            ym = monthly_data.get(y, {})
            meses_arr = []
            total_ventas_y = 0
            total_nf_y = 0
            total_f_y = 0
            for m in range(1, 13):
                md = ym.get(m, default_month)
                meses_arr.append({
                    'mes': m,
                    'nombre': MESES[m - 1],
                    'ventas': md.get('ventas', 0),
                    'no_facturado': md.get('no_facturado', 0),
                    'facturado': md.get('facturado', 0),
                    'total': md.get('total', 0)
                })
                total_ventas_y += md.get('ventas', 0)
                total_nf_y += md.get('no_facturado', 0)
                total_f_y += md.get('facturado', 0)
            historial_anual.append({
                'anio': y,
                'ventas': total_ventas_y,
                'no_facturado': round(total_nf_y, 2),
                'facturado': round(total_f_y, 2),
                'total': round(total_nf_y + total_f_y, 2),
                'meses': meses_arr
            })

        cur.close()
        conn.close()

        return jsonify({
            'total_catalogo': total_catalogo,
            'total_inventario': total_inventario,
            'ingreso_no_facturado': ingreso_no_facturado,
            'ingreso_facturado': ingreso_facturado,
            'ingreso_total': ingreso_total,
            'utilidad_bruta': utilidad_bruta,
            'total_ventas': total_ventas,
            'top_equipos': top_equipos,
            'historial_anual': historial_anual
        })
    except Exception as e:
        print(f"Error dashboard: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== CATALOGO DE EQUIPOS ====================
@app.route('/api/equipos')
def get_equipos():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM equipos ORDER BY nombre ASC')
        data = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(data, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos', methods=['POST'])
def create_equipo():
    try:
        d = request.json
        if not d:
            return jsonify({'error': 'No se recibieron datos'}), 400
        nombre = (d.get('nombre') or '').strip()
        modelo = (d.get('modelo') or '').strip()
        if not nombre:
            return jsonify({'error': 'Nombre es obligatorio'}), 400

        # Auto-generate codigo from modelo or nombre
        codigo = modelo if modelo else nombre[:50]

        def to_float(val, default=0):
            try:
                v = float(val) if val not in (None, '', 'null') else default
                return v
            except (ValueError, TypeError):
                return default

        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO equipos (codigo, nombre, marca, modelo, descripcion, categoria,
                precio_lista, precio_costo, version,
                potencia_motor, capacidad, dimensiones, peso, especificaciones,
                apertura, tamano_alimentacion)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (
            codigo, nombre, d.get('marca') or '', modelo,
            d.get('descripcion') or '', d.get('categoria') or '',
            to_float(d.get('precio_lista')), to_float(d.get('precio_costo')),
            d.get('version') or '1.0',
            d.get('potencia_motor') or '', d.get('capacidad') or '', d.get('dimensiones') or '',
            d.get('peso') or '', d.get('especificaciones') or '',
            d.get('apertura') or '', d.get('tamano_alimentacion') or ''
        ))
        eid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': eid, 'message': 'Equipo agregado al catalogo'})
    except Exception as e:
        print(f'Error creando equipo: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:eid>')
def get_equipo(eid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM equipos WHERE id=%s', (eid,))
        eq = cur.fetchone()
        cur.close()
        conn.close()
        if eq:
            return json.dumps(eq, default=decimal_default), 200, {'Content-Type': 'application/json'}
        return jsonify({'error': 'No encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:eid>', methods=['DELETE'])
def delete_equipo(eid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM equipos WHERE id=%s', (eid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Equipo eliminado del catalogo'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:eid>', methods=['PUT'])
def update_equipo(eid):
    try:
        d = request.json
        if not d:
            return jsonify({'error': 'No se recibieron datos'}), 400

        def to_float(val, default=0):
            try:
                v = float(val) if val not in (None, '', 'null') else default
                return v
            except (ValueError, TypeError):
                return default

        modelo = (d.get('modelo') or '').strip()
        nombre = (d.get('nombre') or '').strip()
        codigo = modelo if modelo else nombre[:50]

        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            UPDATE equipos SET
                codigo=%s, nombre=%s, marca=%s, modelo=%s, descripcion=%s, categoria=%s,
                precio_lista=%s, precio_costo=%s, version=%s,
                potencia_motor=%s, capacidad=%s, dimensiones=%s, peso=%s, especificaciones=%s,
                apertura=%s, tamano_alimentacion=%s
            WHERE id=%s
        ''', (
            codigo, nombre,
            d.get('marca') or '', modelo,
            d.get('descripcion') or '', d.get('categoria') or '',
            to_float(d.get('precio_lista')), to_float(d.get('precio_costo')),
            d.get('version') or '1.0',
            d.get('potencia_motor') or '', d.get('capacidad') or '', d.get('dimensiones') or '',
            d.get('peso') or '', d.get('especificaciones') or '',
            d.get('apertura') or '', d.get('tamano_alimentacion') or '',
            eid
        ))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Equipo actualizado'})
    except Exception as e:
        print(f'Error actualizando equipo: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== SERIAL NUMBER GENERATION ====================
@app.route('/api/equipos/<int:eid>/serial', methods=['GET'])
def get_next_serial(eid):
    """Generates next sequential serial number for an equipment based on its code."""
    try:
        conn = get_db()
        cur = conn.cursor()
        # Get equipo code
        cur.execute('SELECT codigo FROM equipos WHERE id=%s', (eid,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify({'error': 'Equipo no encontrado'}), 404

        equipo_codigo = row['codigo']

        # Atomic increment: INSERT or UPDATE the counter
        cur.execute('''
            INSERT INTO serial_counters (equipo_codigo, last_serial)
            VALUES (%s, 1)
            ON CONFLICT (equipo_codigo)
            DO UPDATE SET last_serial = serial_counters.last_serial + 1
            RETURNING last_serial
        ''', (equipo_codigo,))
        new_serial = cur.fetchone()['last_serial']
        conn.commit()

        serial_str = f"{equipo_codigo}-{new_serial:03d}"
        cur.close()
        conn.close()
        return jsonify({'serial': serial_str, 'counter': new_serial})
    except Exception as e:
        print(f'Error generating serial: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:eid>/serial', methods=['DELETE'])
def reset_serial(eid):
    """Decrements serial counter by 1 (undo last serial) or resets to a specific value."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT codigo FROM equipos WHERE id=%s', (eid,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({'error': 'Equipo no encontrado'}), 404

        equipo_codigo = row['codigo']
        target = request.args.get('target')  # optional: reset to a specific number

        if target is not None:
            target_val = max(0, int(target))
            cur.execute('UPDATE serial_counters SET last_serial=%s WHERE equipo_codigo=%s RETURNING last_serial',
                        (target_val, equipo_codigo))
        else:
            # Decrement by 1, min 0
            cur.execute('''
                UPDATE serial_counters SET last_serial = GREATEST(last_serial - 1, 0)
                WHERE equipo_codigo=%s RETURNING last_serial
            ''', (equipo_codigo,))

        result = cur.fetchone()
        new_val = result['last_serial'] if result else 0
        conn.commit()
        cur.close(); conn.close()
        return jsonify({'success': True, 'counter': new_val, 'equipo_codigo': equipo_codigo})
    except Exception as e:
        print(f'Error resetting serial: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/serial-counters', methods=['GET'])
def list_serial_counters():
    """Lists all serial counters for management."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT sc.equipo_codigo, sc.last_serial, e.nombre, e.id as equipo_id
            FROM serial_counters sc
            LEFT JOIN equipos e ON e.codigo = sc.equipo_codigo
            ORDER BY sc.equipo_codigo
        ''')
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        print(f'Error listing serial counters: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== PARTES TECNICAS POR EQUIPO ====================
@app.route('/api/equipos/<int:eid>/partes')
def get_equipo_partes(eid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT ep.*, p.razon_social as proveedor_nombre, p.whatsapp as proveedor_whatsapp
            FROM equipo_partes ep
            LEFT JOIN proveedores p ON ep.proveedor_id = p.id
            WHERE ep.equipo_id=%s ORDER BY ep.id ASC
        ''', (eid,))
        data = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(data, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/<int:eid>/partes', methods=['POST'])
def add_equipo_parte(eid):
    try:
        d = request.json
        nombre = (d.get('nombre_parte') or '').strip()
        if not nombre:
            return jsonify({'error': 'Nombre de parte es obligatorio'}), 400
        prov_id = d.get('proveedor_id') or None
        if prov_id:
            prov_id = int(prov_id)
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO equipo_partes (equipo_id, nombre_parte, descripcion, cantidad, unidad, proveedor_id)
            VALUES (%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (eid, nombre, d.get('descripcion') or '', d.get('cantidad', 1), d.get('unidad') or 'pza', prov_id))
        pid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': pid, 'message': 'Parte agregada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/equipos/partes/<int:pid>', methods=['DELETE'])
def delete_equipo_parte(pid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM equipo_partes WHERE id=%s', (pid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Parte eliminada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== PDF ORDEN DE COMPRA POR PROVEEDOR ====================
@app.route('/api/equipos/<int:eid>/orden-proveedor/<int:prov_id>', methods=['GET'])
def generar_orden_proveedor(eid, prov_id):
    """Genera un PDF-imagen con las partes de un equipo filtradas por proveedor"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        conn = get_db()
        cur = conn.cursor()
        # Get equipo info
        cur.execute('SELECT * FROM equipos WHERE id=%s', (eid,))
        equipo = cur.fetchone()
        if not equipo:
            return jsonify({'error': 'Equipo no encontrado'}), 404
        # Get proveedor info
        cur.execute('SELECT * FROM proveedores WHERE id=%s', (prov_id,))
        prov = cur.fetchone()
        if not prov:
            return jsonify({'error': 'Proveedor no encontrado'}), 404
        # Get parts for this equipo + proveedor
        cur.execute('''
            SELECT nombre_parte, descripcion, cantidad, unidad
            FROM equipo_partes
            WHERE equipo_id=%s AND proveedor_id=%s ORDER BY id ASC
        ''', (eid, prov_id))
        partes = cur.fetchall()
        cur.close()
        conn.close()
        if not partes:
            return jsonify({'error': 'No hay partes para este proveedor'}), 404

        # Generate image (professional order document)
        W, H_base = 800, 400
        row_h = 30
        H = H_base + len(partes) * row_h
        img = Image.new('RGB', (W, H), '#FFFFFF')
        draw = ImageDraw.Draw(img)

        try:
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
            font_head = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
            font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
        except:
            font_title = ImageFont.load_default()
            font_head = font_title
            font_body = font_title
            font_small = font_title

        # Header bar
        draw.rectangle([(0, 0), (W, 70)], fill='#1a1a2e')
        draw.text((20, 15), "DURTRON", fill='#D2152B', font=font_title)
        draw.text((20, 42), "Innovacion Industrial", fill='#8888a4', font=font_small)
        draw.text((W - 250, 15), "SOLICITUD DE COTIZACION", fill='#FFFFFF', font=font_head)
        from datetime import datetime
        draw.text((W - 250, 38), f"Fecha: {datetime.now().strftime('%d/%m/%Y')}", fill='#cccccc', font=font_small)

        y = 85
        # Equipo info
        draw.text((20, y), f"Proyecto / Equipo:", fill='#666666', font=font_small)
        draw.text((150, y), f"{equipo.get('nombre', '')} ({equipo.get('codigo', '')})", fill='#000000', font=font_body)
        y += 22
        draw.text((20, y), f"Proveedor:", fill='#666666', font=font_small)
        draw.text((150, y), f"{prov.get('razon_social', '')}", fill='#000000', font=font_body)
        y += 22
        if prov.get('contacto_nombre'):
            draw.text((20, y), f"Contacto:", fill='#666666', font=font_small)
            draw.text((150, y), f"{prov.get('contacto_nombre', '')}", fill='#000000', font=font_body)
            y += 22

        y += 10
        # Separator
        draw.line([(20, y), (W - 20, y)], fill='#D2152B', width=2)
        y += 15

        # Table header
        draw.rectangle([(20, y), (W - 20, y + 28)], fill='#f0f0f0')
        draw.text((30,  y + 7), "#", fill='#333333', font=font_head)
        draw.text((60,  y + 7), "PARTE / COMPONENTE", fill='#333333', font=font_head)
        draw.text((400, y + 7), "DESCRIPCION", fill='#333333', font=font_head)
        draw.text((620, y + 7), "CANT.", fill='#333333', font=font_head)
        draw.text((700, y + 7), "UNIDAD", fill='#333333', font=font_head)
        y += 30

        # Table rows
        for i, p in enumerate(partes):
            bg = '#FFFFFF' if i % 2 == 0 else '#f8f8f8'
            draw.rectangle([(20, y), (W - 20, y + row_h)], fill=bg)
            draw.text((30,  y + 8), str(i + 1), fill='#333333', font=font_body)
            draw.text((60,  y + 8), str(p.get('nombre_parte', ''))[:40], fill='#000000', font=font_body)
            draw.text((400, y + 8), str(p.get('descripcion', ''))[:25], fill='#666666', font=font_body)
            draw.text((620, y + 8), str(p.get('cantidad', 1)), fill='#000000', font=font_body)
            draw.text((700, y + 8), str(p.get('unidad', 'pza')), fill='#000000', font=font_body)
            y += row_h
        
        # Bottom border
        draw.line([(20, y), (W - 20, y)], fill='#cccccc', width=1)
        y += 20

        # Footer
        draw.text((20, y), "DURTRON - Innovacion Industrial | Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056", fill='#999999', font=font_small)
        y += 15
        draw.text((20, y), "Este documento es una solicitud de cotizacion. Favor de responder con precios y tiempos de entrega.", fill='#999999', font=font_small)

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        filename = f"orden_{equipo.get('codigo', 'equipo')}_{prov.get('razon_social', 'prov').replace(' ', '_')}.png"
        return send_file(buf, mimetype='image/png', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f'Error generando orden proveedor: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== INVENTARIO ====================
@app.route('/api/inventario')
def get_inventario():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT i.*, e.codigo as equipo_codigo, e.nombre as equipo_nombre,
                   e.marca, e.modelo, e.categoria, e.precio_lista, e.precio_costo
            FROM inventario i
            JOIN equipos e ON i.equipo_id = e.id
            WHERE i.estado != 'Vendida'
            ORDER BY i.fecha_creacion DESC
        ''')
        data = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(data, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario', methods=['POST'])
def create_inventario():
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()

        # Auto-generar numero de serie si viene vacio
        numero_serie = (d.get('numero_serie') or '').strip()
        if not numero_serie:
            today = datetime.now().strftime('%Y%m%d')
            rand = secrets.token_hex(2).upper()  # 4 caracteres hex
            numero_serie = f'DRT-{today}-{rand}'

        cur.execute('''
            INSERT INTO inventario (equipo_id, numero_serie, estado, observaciones)
            VALUES (%s,%s,%s,%s) RETURNING id
        ''', (
            d.get('equipo_id'), numero_serie,
            d.get('estado','Disponible'), d.get('observaciones','')
        ))
        iid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': iid, 'numero_serie': numero_serie, 'message': 'Agregado al inventario'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/<int:iid>')
def get_inv_item(iid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT i.*, e.codigo as equipo_codigo, e.nombre as equipo_nombre,
                   e.marca, e.modelo, e.categoria, e.precio_lista, e.precio_minimo,
                   e.precio_costo, e.potencia_motor, e.capacidad, e.dimensiones,
                   e.peso, e.especificaciones, e.descripcion
            FROM inventario i JOIN equipos e ON i.equipo_id = e.id
            WHERE i.id=%s
        ''', (iid,))
        item = cur.fetchone()
        cur.close()
        conn.close()
        if item:
            return json.dumps(item, default=decimal_default), 200, {'Content-Type': 'application/json'}
        return jsonify({'error': 'No encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/<int:iid>/estado', methods=['PATCH'])
def update_inv_estado(iid):
    try:
        d = request.json
        nuevo_estado = (d.get('estado') or '').strip()
        nota_piezas = (d.get('nota_piezas') or '').strip()
        if nuevo_estado not in ['Disponible', 'En Fabricacion', 'Disponible - Faltan Piezas']:
            return jsonify({'error': 'Estado no valido'}), 400
        obs = nota_piezas if nuevo_estado == 'Disponible - Faltan Piezas' else ''
        conn = get_db()
        cur = conn.cursor()
        cur.execute('UPDATE inventario SET estado=%s, observaciones=%s WHERE id=%s', (nuevo_estado, obs, iid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': f'Estado actualizado a {nuevo_estado}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/<int:iid>', methods=['DELETE'])
def delete_inv_item(iid):
    try:
        conn = get_db()
        cur = conn.cursor()
        # Verificar que no tenga ventas asociadas
        cur.execute('SELECT COUNT(*) as cnt FROM ventas WHERE inventario_id=%s', (iid,))
        if cur.fetchone()['cnt'] > 0:
            cur.close()
            conn.close()
            return jsonify({'error': 'No se puede eliminar: tiene ventas asociadas. Elimina la venta primero.'}), 400
        cur.execute('DELETE FROM inventario WHERE id=%s', (iid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Item eliminado del inventario'})
    except Exception as e:
        print(f'Error eliminando inventario: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== ETIQUETA PNG ====================
@app.route('/api/inventario/<int:iid>/etiqueta')
def generar_etiqueta(iid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT i.*, e.codigo as equipo_codigo, e.nombre as equipo_nombre,
                   e.marca, e.modelo, e.categoria, e.potencia_motor, e.capacidad,
                   e.dimensiones, e.peso
            FROM inventario i JOIN equipos e ON i.equipo_id = e.id
            WHERE i.id=%s
        ''', (iid,))
        item = cur.fetchone()
        cur.close()
        conn.close()
        if not item:
            return jsonify({'error': 'No encontrado'}), 404

        # Crear imagen de etiqueta 800x420
        W, H = 800, 420
        img = Image.new('RGB', (W, H), '#FFFFFF')
        draw = ImageDraw.Draw(img)

        # Usar fuente por defecto (Pillow built-in)
        try:
            font_title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
            font_subtitle = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
            font_label = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
            font_value = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
            font_footer = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
            font_badge = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
        except Exception:
            font_title = ImageFont.load_default()
            font_subtitle = font_title
            font_label = font_title
            font_value = font_title
            font_footer = font_title
            font_badge = font_title

        # Header: DURTRON
        draw.text((30, 20), 'DURTRON', fill='#000000', font=font_title)
        draw.text((30, 52), 'INNOVACION INDUSTRIAL', fill='#555555', font=font_subtitle)

        # Badge: Calidad Industrial
        draw.text((550, 20), 'Calidad Industrial', fill='#333333', font=font_badge)
        draw.text((550, 38), 'Durtron Planta 1 Durango', fill='#555555', font=font_badge)

        # Linea separadora
        draw.line([(25, 72), (W-25, 72)], fill='#000000', width=2)

        # Grid de datos - 3 columnas x 3 filas
        campos = [
            ('Equipo', item.get('equipo_nombre') or '-'),
            ('Apertura', item.get('dimensiones') or '-'),
            ('Peso del Equipo', item.get('peso') or '-'),
            ('Modelo', item.get('modelo') or '-'),
            ('Tamano de Alimentacion', item.get('capacidad') or '-'),
            ('Fecha de Fabricacion', str(item.get('fecha_ingreso') or '-')),
            ('Capacidad', item.get('capacidad') or '-'),
            ('Potencia', item.get('potencia_motor') or '-'),
            ('Numero de Serie', item.get('numero_serie') or '-'),
        ]

        col_w = (W - 60) // 3
        start_y = 85
        row_h = 65

        for idx, (label, value) in enumerate(campos):
            col = idx % 3
            row = idx // 3
            x = 30 + col * col_w
            y = start_y + row * row_h

            # Label
            draw.text((x, y), label, fill='#666666', font=font_label)
            # Value box
            box_y = y + 16
            draw.rectangle([(x, box_y), (x + col_w - 15, box_y + 28)], outline='#000000', width=1)
            # Value text inside box
            val_str = str(value)[:25]  # Truncar si es muy largo
            draw.text((x + 6, box_y + 6), val_str, fill='#000000', font=font_value)

        # Footer
        footer_y = start_y + 3 * row_h + 15
        draw.line([(25, footer_y), (W-25, footer_y)], fill='#000000', width=1)
        footer_y += 10
        draw.text((30, footer_y), '6181341056', fill='#333333', font=font_footer)
        draw.text((280, footer_y), 'contacto@durtron.com', fill='#333333', font=font_footer)
        draw.text((560, footer_y), 'www.durtron.com', fill='#333333', font=font_footer)

        # Convertir a bytes
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)

        serie = (item.get('numero_serie') or 'etiqueta').replace(' ', '_')
        return Response(
            buf.getvalue(),
            mimetype='image/png',
            headers={'Content-Disposition': f'attachment; filename=etiqueta_{serie}.png'}
        )
    except Exception as e:
        print(f'Error generando etiqueta: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/<int:iid>/vender', methods=['POST'])
def vender_item(iid):
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()

        cur.execute('SELECT * FROM inventario WHERE id=%s', (iid,))
        inv = cur.fetchone()
        if not inv:
            return jsonify({'error': 'Item de inventario no encontrado'}), 404

        precio_venta = float(d.get('precio_venta', 0))
        precio_lista = 0
        cur.execute('SELECT precio_lista FROM equipos WHERE id=%s', (inv['equipo_id'],))
        eq = cur.fetchone()
        if eq:
            precio_lista = float(eq['precio_lista'])

        descuento_monto = precio_lista - precio_venta if precio_lista > precio_venta else 0
        descuento_pct = (descuento_monto / precio_lista * 100) if precio_lista > 0 else 0

        # Anticipo inicial
        anticipo_monto = float(d.get('anticipo_monto', 0))
        tiene_anticipo = anticipo_monto > 0
        estado_venta = 'Liquidado' if anticipo_monto >= precio_venta else 'Anticipo'

        cur.execute('''
            INSERT INTO ventas (inventario_id, equipo_id, vendedor, cliente_nombre,
                cliente_contacto, cliente_rfc, cliente_direccion, precio_venta,
                descuento_monto, descuento_porcentaje, motivo_descuento,
                forma_pago, facturado, numero_factura, autorizado_por,
                tiene_anticipo, anticipo_monto, anticipo_fecha,
                cuenta_bancaria, entregado, estado_venta, notas)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (
            iid, inv['equipo_id'], d.get('vendedor',''),
            d.get('cliente_nombre',''), d.get('cliente_contacto',''),
            d.get('cliente_rfc',''), d.get('cliente_direccion',''),
            precio_venta, descuento_monto, round(descuento_pct, 2),
            d.get('motivo_descuento',''), d.get('forma_pago',''),
            d.get('facturado', False), d.get('numero_factura',''),
            d.get('autorizado_por',''),
            tiene_anticipo, anticipo_monto, d.get('anticipo_fecha') or None,
            d.get('cuenta_bancaria', ''),
            d.get('entregado', False),
            estado_venta,
            d.get('notas','')
        ))
        vid = cur.fetchone()['id']

        # Si hay anticipo inicial, registrarlo en tabla anticipos
        if tiene_anticipo and anticipo_monto > 0:
            cur.execute('''
                INSERT INTO anticipos (venta_id, monto, fecha, notas)
                VALUES (%s, %s, %s, %s)
            ''', (vid, anticipo_monto, d.get('anticipo_fecha') or None, 'Anticipo inicial'))

        # Marcar inventario como vendida
        cur.execute("UPDATE inventario SET estado='Vendida' WHERE id=%s", (iid,))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': vid, 'message': 'Venta registrada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== VENTAS ====================
@app.route('/api/ventas')
def get_ventas():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT v.*, e.nombre as equipo_nombre, e.codigo as equipo_codigo,
                   e.modelo as equipo_modelo, i.numero_serie
            FROM ventas v
            LEFT JOIN equipos e ON v.equipo_id = e.id
            LEFT JOIN inventario i ON v.inventario_id = i.id
            ORDER BY v.fecha_venta DESC
        ''')
        ventas = cur.fetchall()
        # Agregar anticipos a cada venta
        for v in ventas:
            cur.execute('SELECT * FROM anticipos WHERE venta_id=%s ORDER BY fecha ASC', (v['id'],))
            v['anticipos'] = cur.fetchall()
            total_anticipos = sum(float(a['monto']) for a in v['anticipos'])
            v['total_anticipos'] = total_anticipos
        cur.close()
        conn.close()
        return json.dumps(ventas, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ventas/<int:vid>', methods=['PUT'])
def update_venta(vid):
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            UPDATE ventas SET
                vendedor=%s, cliente_nombre=%s, cliente_contacto=%s,
                cliente_rfc=%s, cliente_direccion=%s, precio_venta=%s,
                forma_pago=%s, facturado=%s, numero_factura=%s,
                cuenta_bancaria=%s, entregado=%s, estado_venta=%s, notas=%s
            WHERE id=%s
        ''', (
            d.get('vendedor',''), d.get('cliente_nombre',''),
            d.get('cliente_contacto',''), d.get('cliente_rfc',''),
            d.get('cliente_direccion',''), float(d.get('precio_venta', 0)),
            d.get('forma_pago',''), d.get('facturado', False),
            d.get('numero_factura',''), d.get('cuenta_bancaria',''),
            d.get('entregado', False), d.get('estado_venta','Anticipo'),
            d.get('notas',''), vid
        ))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Venta actualizada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ventas/<int:vid>', methods=['DELETE'])
def delete_venta(vid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT inventario_id FROM ventas WHERE id=%s', (vid,))
        venta = cur.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404
        cur.execute("UPDATE inventario SET estado='Disponible' WHERE id=%s", (venta['inventario_id'],))
        cur.execute('DELETE FROM ventas WHERE id=%s', (vid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Venta eliminada y equipo restaurado a inventario'})
    except Exception as e:
        print(f'Error eliminando venta: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== ANTICIPOS ====================
@app.route('/api/ventas/<int:vid>/anticipos', methods=['POST'])
def add_anticipo(vid):
    try:
        conn = get_db()
        cur = conn.cursor()
        # Handle multipart (with file) or JSON
        if request.content_type and 'multipart' in request.content_type:
            monto = float(request.form.get('monto', 0))
            fecha = request.form.get('fecha') or None
            notas = request.form.get('notas', '')
            comprobante_url = ''
            if 'comprobante' in request.files:
                file = request.files['comprobante']
                if file.filename:
                    # Save to static/uploads
                    import os
                    uploads_dir = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
                    os.makedirs(uploads_dir, exist_ok=True)
                    fname = f'anticipo_{vid}_{secrets.token_hex(4)}.png'
                    fpath = os.path.join(uploads_dir, fname)
                    file.save(fpath)
                    comprobante_url = f'/static/uploads/{fname}'
        else:
            d = request.json or {}
            monto = float(d.get('monto', 0))
            fecha = d.get('fecha') or None
            notas = d.get('notas', '')
            comprobante_url = d.get('comprobante_url', '')

        if monto <= 0:
            return jsonify({'error': 'El monto debe ser mayor a 0'}), 400

        cur.execute('''
            INSERT INTO anticipos (venta_id, monto, fecha, comprobante_url, notas)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        ''', (vid, monto, fecha, comprobante_url, notas))
        aid = cur.fetchone()['id']

        # Recalcular total anticipos y actualizar estado de la venta
        cur.execute('SELECT SUM(monto) as total FROM anticipos WHERE venta_id=%s', (vid,))
        total = float(cur.fetchone()['total'] or 0)
        cur.execute('SELECT precio_venta FROM ventas WHERE id=%s', (vid,))
        pv = float(cur.fetchone()['precio_venta'])
        nuevo_estado = 'Liquidado' if total >= pv else 'Anticipo'
        cur.execute('UPDATE ventas SET anticipo_monto=%s, tiene_anticipo=TRUE, estado_venta=%s WHERE id=%s',
                    (total, nuevo_estado, vid))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': aid, 'total_anticipos': total, 'estado': nuevo_estado})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/anticipos/<int:aid>', methods=['DELETE'])
def delete_anticipo(aid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT venta_id FROM anticipos WHERE id=%s', (aid,))
        ant = cur.fetchone()
        if not ant:
            return jsonify({'error': 'Anticipo no encontrado'}), 404
        vid = ant['venta_id']
        cur.execute('DELETE FROM anticipos WHERE id=%s', (aid,))
        # Recalcular
        cur.execute('SELECT COALESCE(SUM(monto),0) as total FROM anticipos WHERE venta_id=%s', (vid,))
        total = float(cur.fetchone()['total'])
        cur.execute('SELECT precio_venta FROM ventas WHERE id=%s', (vid,))
        pv = float(cur.fetchone()['precio_venta'])
        nuevo_estado = 'Liquidado' if total >= pv else 'Anticipo'
        tiene = total > 0
        cur.execute('UPDATE ventas SET anticipo_monto=%s, tiene_anticipo=%s, estado_venta=%s WHERE id=%s',
                    (total, tiene, nuevo_estado, vid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'total_anticipos': total, 'estado': nuevo_estado})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/reset', methods=['POST'])
def reset_inventario():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM anticipos')
        cur.execute('DELETE FROM ventas')
        cur.execute('DELETE FROM inventario')
        cur.execute('ALTER SEQUENCE inventario_id_seq RESTART WITH 1')
        cur.execute('ALTER SEQUENCE ventas_id_seq RESTART WITH 1')
        cur.execute('ALTER SEQUENCE anticipos_id_seq RESTART WITH 1')
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Inventario, ventas y anticipos reiniciados. IDs desde 1.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== VENDEDORES ====================
@app.route('/api/vendedores')
def get_vendedores():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT vendedor,
                   COUNT(*) as total_ventas,
                   COALESCE(SUM(precio_venta),0) as ingreso_total
            FROM ventas
            GROUP BY vendedor
            ORDER BY ingreso_total DESC
        ''')
        data = cur.fetchall()
        cur.close()
        conn.close()
        result = []
        for i, r in enumerate(data):
            result.append({
                'posicion': i + 1,
                'vendedor': r['vendedor'],
                'total_ventas': r['total_ventas'],
                'ingreso_total': float(r['ingreso_total']),
                'ingreso_iva': round(float(r['ingreso_total']) * 1.16, 2)
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== VENDEDORES CATALOGO ====================
@app.route('/api/vendedores/catalogo')
def get_vendedores_catalogo():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM vendedores_catalogo ORDER BY nombre ASC')
        data = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/vendedores/catalogo', methods=['POST'])
def create_vendedor():
    try:
        d = request.json
        nombre = d.get('nombre', '').strip()
        if not nombre:
            return jsonify({'error': 'El nombre es obligatorio'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO vendedores_catalogo (nombre, telefono, email)
            VALUES (%s, %s, %s) RETURNING id
        ''', (nombre, d.get('telefono', ''), d.get('email', '')))
        vid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': vid, 'message': 'Vendedor agregado'})
    except Exception as e:
        if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
            return jsonify({'error': 'Ya existe un vendedor con ese nombre'}), 400
        return jsonify({'error': str(e)}), 500

@app.route('/api/vendedores/catalogo/<int:vid>', methods=['DELETE'])
def delete_vendedor_catalogo(vid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM vendedores_catalogo WHERE id=%s', (vid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Vendedor eliminado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== COTIZACIONES ====================
@app.route('/api/cotizaciones')
def get_cotizaciones():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT c.*, 
                   (SELECT COUNT(*) FROM cotizacion_items ci WHERE ci.cotizacion_id = c.id) as num_items
            FROM cotizaciones c
            ORDER BY c.fecha_creacion DESC
        ''')
        data = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(data, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cotizaciones', methods=['POST'])
def create_cotizacion():
    try:
        d = request.json
        if not d:
            return jsonify({'error': 'No se recibieron datos'}), 400

        conn = get_db()
        cur = conn.cursor()

        # Generar folio automatico: COT-YYYY-NNNN
        year = datetime.now().year
        cur.execute("SELECT COUNT(*) as cnt FROM cotizaciones WHERE folio LIKE %s", (f'COT-{year}-%',))
        count = cur.fetchone()['cnt'] + 1
        folio = f'COT-{year}-{count:04d}'

        items = d.get('items', [])
        if not items:
            return jsonify({'error': 'Debe agregar al menos un equipo'}), 400

        incluye_iva = d.get('incluye_iva', True)

        # Calculate subtotal
        subtotal = 0
        for item in items:
            qty = int(item.get('cantidad', 1))
            precio = float(item.get('precio_unitario', 0))
            subtotal += qty * precio

        # Discount
        descuento_pct = float(d.get('descuento_porcentaje', 0))
        descuento_monto = round(subtotal * descuento_pct / 100, 2)

        # IVA on (subtotal - descuento)
        base_iva = subtotal - descuento_monto
        iva = round(base_iva * 0.16, 2) if incluye_iva else 0
        total = round(base_iva + iva, 2)

        # Anticipo
        anticipo_pct = float(d.get('anticipo_porcentaje', 0))
        anticipo_monto = round(total * anticipo_pct / 100, 2)

        cur.execute('''
            INSERT INTO cotizaciones (folio, cliente_nombre, cliente_empresa, cliente_telefono,
                cliente_email, cliente_direccion, vendedor, incluye_iva,
                subtotal, iva, total, vigencia_dias, notas,
                descuento_porcentaje, descuento_monto, anticipo_porcentaje, anticipo_monto)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (
            folio,
            d.get('cliente_nombre', ''),
            d.get('cliente_empresa', ''),
            d.get('cliente_telefono', ''),
            d.get('cliente_email', ''),
            d.get('cliente_direccion', ''),
            d.get('vendedor', ''),
            incluye_iva,
            subtotal, iva, total,
            d.get('vigencia_dias', 7),
            d.get('notas', ''),
            descuento_pct, descuento_monto,
            anticipo_pct, anticipo_monto
        ))
        cot_id = cur.fetchone()['id']

        for item in items:
            qty = int(item.get('cantidad', 1))
            precio = float(item.get('precio_unitario', 0))
            total_linea = round(qty * precio, 2)
            cur.execute('''
                INSERT INTO cotizacion_items (cotizacion_id, equipo_id, descripcion, cantidad, precio_unitario, total_linea, modelo)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
            ''', (
                cot_id,
                item.get('equipo_id') or None,
                item.get('descripcion', ''),
                qty, precio, total_linea,
                item.get('modelo', '')
            ))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': cot_id, 'folio': folio, 'message': f'Cotizacion {folio} creada'})
    except Exception as e:
        print(f'Error creando cotizacion: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/cotizaciones/<int:cid>')
def get_cotizacion(cid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM cotizaciones WHERE id=%s', (cid,))
        cot = cur.fetchone()
        if not cot:
            cur.close()
            conn.close()
            return jsonify({'error': 'Cotizacion no encontrada'}), 404

        cur.execute('''
            SELECT ci.*, e.codigo as equipo_codigo, e.nombre as equipo_nombre,
                   e.marca, e.modelo, e.capacidad, e.potencia_motor
            FROM cotizacion_items ci
            LEFT JOIN equipos e ON ci.equipo_id = e.id
            WHERE ci.cotizacion_id = %s
            ORDER BY ci.id
        ''', (cid,))
        items = cur.fetchall()
        cur.close()
        conn.close()

        result = dict(cot)
        result['items'] = [dict(i) for i in items]
        return json.dumps(result, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cotizaciones/<int:cid>', methods=['DELETE'])
def delete_cotizacion(cid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM cotizaciones WHERE id=%s', (cid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Cotizacion eliminada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== PROVEEDORES ====================
@app.route('/api/proveedores', methods=['GET'])
def get_proveedores():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM proveedores ORDER BY razon_social')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return Response(json.dumps(rows, default=decimal_default), mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/proveedores', methods=['POST'])
def create_proveedor():
    try:
        d = request.json
        if not d.get('razon_social'):
            return jsonify({'error': 'Razon social es obligatoria'}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO proveedores (razon_social, contacto_nombre, correo, telefono, whatsapp, medio_preferido, notas)
            VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (d['razon_social'], d.get('contacto_nombre',''), d.get('correo',''),
              d.get('telefono',''), d.get('whatsapp',''), d.get('medio_preferido','WhatsApp'), d.get('notas','')))
        pid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': pid, 'message': 'Proveedor creado'})
    except Exception as e:
        logger.error(f"Error creating proveedor: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

@app.route('/api/proveedores/<int:pid>', methods=['PUT'])
def update_proveedor(pid):
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            UPDATE proveedores SET razon_social=%s, contacto_nombre=%s, correo=%s,
            telefono=%s, whatsapp=%s, medio_preferido=%s, notas=%s WHERE id=%s
        ''', (d.get('razon_social',''), d.get('contacto_nombre',''), d.get('correo',''),
              d.get('telefono',''), d.get('whatsapp',''), d.get('medio_preferido','WhatsApp'),
              d.get('notas',''), pid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Proveedor actualizado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/proveedores/<int:pid>', methods=['DELETE'])
def delete_proveedor(pid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM proveedores WHERE id=%s', (pid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Proveedor eliminado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== REQUISICIONES ====================
@app.route('/api/requisiciones', methods=['GET'])
def get_requisiciones():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT r.*, p.razon_social as proveedor_nombre
            FROM requisiciones r
            LEFT JOIN proveedores p ON r.proveedor_id = p.id
            ORDER BY r.fecha_creacion DESC
        ''')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return Response(json.dumps(rows, default=decimal_default), mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones', methods=['POST'])
def create_requisicion():
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()
        # Generar folio
        anio = datetime.now().year
        cur.execute("SELECT COUNT(*) as cnt FROM requisiciones WHERE folio LIKE %s", (f'REQ-{anio}-%',))
        cnt = cur.fetchone()['cnt']
        folio = f"REQ-{anio}-{cnt+1:04d}"
        # Insertar requisicion
        cur.execute('''
            INSERT INTO requisiciones (folio, inventario_id, proveedor_id, equipo_nombre, no_control, area, revisado_por, requerido_por, notas, emitido_por, aprobado_por, numero_serie)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (folio, d.get('inventario_id'), d.get('proveedor_id'),
              d.get('equipo_nombre',''), d.get('no_control',''), 
              d.get('area','Departamento de Ingeniería'),
              d.get('revisado_por',''), d.get('requerido_por',''),
              d.get('notas',''),
              d.get('emitido_por',''), d.get('aprobado_por',''),
              d.get('numero_serie','')))
        rid = cur.fetchone()['id']
        # Insertar items
        items = d.get('items', [])
        for item in items:
            cur.execute('''
                INSERT INTO requisicion_items (requisicion_id, componente, proveedor_nombre, comentario, cantidad, unidad, precio_unitario, tiene_iva)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ''', (rid, item.get('componente',''), item.get('proveedor_nombre',''), item.get('comentario',''),
                  item.get('cantidad',1), item.get('unidad','pza'), 
                  item.get('precio_unitario',0), item.get('tiene_iva',False)))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': rid, 'folio': folio, 'message': f'Requisicion {folio} creada'})
    except Exception as e:
        logger.error(f"Error creating requisicion: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

@app.route('/api/requisiciones/<int:rid>', methods=['GET'])
def get_requisicion(rid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT r.*, p.razon_social as proveedor_nombre_header, p.correo as proveedor_correo,
                   p.telefono as proveedor_telefono, p.whatsapp as proveedor_whatsapp
            FROM requisiciones r
            LEFT JOIN proveedores p ON r.proveedor_id = p.id
            WHERE r.id=%s
        ''', (rid,))
        req = cur.fetchone()
        if not req:
            return jsonify({'error': 'Requisicion no encontrada'}), 404
        cur.execute('SELECT * FROM requisicion_items WHERE requisicion_id=%s ORDER BY id', (rid,))
        req['items'] = cur.fetchall()
        cur.execute('SELECT * FROM requisicion_envios WHERE requisicion_id=%s ORDER BY proveedor_nombre', (rid,))
        req['envios'] = cur.fetchall()
        cur.close()
        conn.close()
        return Response(json.dumps(req, default=decimal_default), mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones/<int:rid>', methods=['DELETE'])
def delete_requisicion(rid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM requisicion_items WHERE requisicion_id=%s', (rid,))
        cur.execute('DELETE FROM requisiciones WHERE id=%s', (rid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Requisicion eliminada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones/<int:rid>/estado', methods=['PUT'])
def update_requisicion_estado(rid):
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()
        cur.execute('UPDATE requisiciones SET estado=%s WHERE id=%s', (d.get('estado','Pendiente'), rid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Estado actualizado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones/<int:rid>/envios', methods=['PUT'])
def upsert_requisicion_envio(rid):
    try:
        d = request.json
        prov = d.get('proveedor_nombre', '').strip()
        if not prov:
            return jsonify({'error': 'proveedor_nombre es requerido'}), 400
        conn = get_db()
        cur = conn.cursor()
        # Check if envio already exists
        cur.execute('SELECT id FROM requisicion_envios WHERE requisicion_id=%s AND proveedor_nombre=%s', (rid, prov))
        existing = cur.fetchone()
        if existing:
            cur.execute('''
                UPDATE requisicion_envios
                SET estado=%s, guia_rastreo=%s, paqueteria=%s, nombre_recoge=%s,
                    telefono_recoge=%s, notas=%s, fecha_envio=%s, fecha_recibido=%s
                WHERE requisicion_id=%s AND proveedor_nombre=%s
            ''', (
                d.get('estado', 'Pendiente'),
                d.get('guia_rastreo', ''),
                d.get('paqueteria', ''),
                d.get('nombre_recoge', ''),
                d.get('telefono_recoge', ''),
                d.get('notas', ''),
                d.get('fecha_envio') or None,
                d.get('fecha_recibido') or None,
                rid, prov
            ))
        else:
            cur.execute('''
                INSERT INTO requisicion_envios (requisicion_id, proveedor_nombre, estado, guia_rastreo,
                    paqueteria, nombre_recoge, telefono_recoge, notas, fecha_envio, fecha_recibido)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ''', (
                rid, prov,
                d.get('estado', 'Pendiente'),
                d.get('guia_rastreo', ''),
                d.get('paqueteria', ''),
                d.get('nombre_recoge', ''),
                d.get('telefono_recoge', ''),
                d.get('notas', ''),
                d.get('fecha_envio') or None,
                d.get('fecha_recibido') or None
            ))
        # Auto-update requisicion general estado
        cur.execute('SELECT DISTINCT proveedor_nombre FROM requisicion_items WHERE requisicion_id=%s AND proveedor_nombre IS NOT NULL AND proveedor_nombre != %s', (rid, ''))
        all_provs = [r['proveedor_nombre'] for r in cur.fetchall()]
        cur.execute('SELECT estado FROM requisicion_envios WHERE requisicion_id=%s', (rid,))
        envio_estados = [r['estado'] for r in cur.fetchall()]
        if all_provs and len(envio_estados) >= len(all_provs) and all(e == 'Recibido' for e in envio_estados):
            cur.execute('UPDATE requisiciones SET estado=%s WHERE id=%s', ('Recibida', rid))
        elif any(e == 'Enviado' for e in envio_estados):
            cur.execute('UPDATE requisiciones SET estado=%s WHERE id=%s', ('Enviada', rid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': f'Envio de {prov} actualizado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== PDF ORDEN DE COMPRA POR PROVEEDOR (REQUISICION) ====================
@app.route('/api/requisiciones/<int:rid>/orden-proveedor/<prov_name>', methods=['GET'])
def generar_orden_requisicion_proveedor(rid, prov_name):
    """Genera un PNG profesional con los items de una requisicion filtrados por proveedor"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        from urllib.parse import unquote
        prov_name = unquote(prov_name)

        conn = get_db()
        cur = conn.cursor()

        # Get requisicion header
        cur.execute('''
            SELECT r.*, p.razon_social as prov_razon, p.contacto_nombre as prov_contacto
            FROM requisiciones r
            LEFT JOIN proveedores p ON r.proveedor_id = p.id
            WHERE r.id=%s
        ''', (rid,))
        req = cur.fetchone()
        if not req:
            cur.close(); conn.close()
            return jsonify({'error': 'Requisicion no encontrada'}), 404

        # Get items for this provider only
        cur.execute('''
            SELECT componente, comentario, cantidad, unidad, precio_unitario, tiene_iva, proveedor_nombre
            FROM requisicion_items
            WHERE requisicion_id=%s AND LOWER(proveedor_nombre) = LOWER(%s)
            ORDER BY id ASC
        ''', (rid, prov_name))
        items = cur.fetchall()
        cur.close()
        conn.close()

        if not items:
            return jsonify({'error': f'No hay items para proveedor {prov_name}'}), 404

        # Generate image
        W = 820
        row_h = 32
        H_header = 300
        H_table = len(items) * row_h + 60  # header row + items
        H_footer = 120
        H = H_header + H_table + H_footer
        img = Image.new('RGB', (W, H), '#FFFFFF')
        draw = ImageDraw.Draw(img)

        try:
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
            font_head = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
            font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
            font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 10)
        except:
            font_title = ImageFont.load_default()
            font_head = font_title
            font_body = font_title
            font_small = font_title
            font_label = font_title

        # Header bar
        draw.rectangle([(0, 0), (W, 70)], fill='#1a1a2e')
        draw.text((20, 12), "DURTRON", fill='#D2152B', font=font_title)
        draw.text((20, 42), "Innovacion Industrial", fill='#8888a4', font=font_small)
        draw.text((W - 280, 12), "SOLICITUD DE COTIZACION", fill='#FFFFFF', font=font_head)
        draw.text((W - 280, 30), f"Folio: {req.get('folio', '-')}", fill='#F47427', font=font_body)
        draw.text((W - 280, 48), f"Fecha: {datetime.now().strftime('%d/%m/%Y')}", fill='#cccccc', font=font_small)

        # Orange accent line
        draw.rectangle([(0, 70), (W, 74)], fill='#F47427')

        y = 90
        # Requisition info
        draw.text((20, y), "PROVEEDOR:", fill='#888888', font=font_label)
        draw.text((130, y), prov_name, fill='#000000', font=font_body)
        y += 20
        draw.text((20, y), "PROYECTO:", fill='#888888', font=font_label)
        draw.text((130, y), req.get('equipo_nombre', '-') or '-', fill='#000000', font=font_body)
        y += 20
        draw.text((20, y), "AREA:", fill='#888888', font=font_label)
        draw.text((130, y), req.get('area', '-') or '-', fill='#000000', font=font_body)
        y += 20
        draw.text((20, y), "NO. CONTROL:", fill='#888888', font=font_label)
        draw.text((130, y), req.get('no_control', '-') or '-', fill='#000000', font=font_body)
        y += 20
        draw.text((20, y), "EMITIDO POR:", fill='#888888', font=font_label)
        draw.text((130, y), req.get('emitido_por', '-') or '-', fill='#000000', font=font_body)
        draw.text((400, y), "APROBADO POR:", fill='#888888', font=font_label)
        draw.text((520, y), req.get('aprobado_por', '-') or '-', fill='#000000', font=font_body)
        y += 25

        # Separator
        draw.line([(20, y), (W - 20, y)], fill='#D2152B', width=2)
        y += 12

        # Table header
        cols = [20, 50, 280, 460, 530, 610, 720]
        draw.rectangle([(20, y), (W - 20, y + 28)], fill='#1a1a2e')
        draw.text((cols[0] + 5, y + 8), "#", fill='#FFFFFF', font=font_head)
        draw.text((cols[1] + 5, y + 8), "COMPONENTE", fill='#FFFFFF', font=font_head)
        draw.text((cols[2] + 5, y + 8), "COMENTARIOS", fill='#FFFFFF', font=font_head)
        draw.text((cols[3] + 5, y + 8), "CANT.", fill='#FFFFFF', font=font_head)
        draw.text((cols[4] + 5, y + 8), "P.UNIT", fill='#FFFFFF', font=font_head)
        draw.text((cols[5] + 5, y + 8), "SUBTOTAL", fill='#FFFFFF', font=font_head)
        draw.text((cols[6] + 5, y + 8), "IVA", fill='#FFFFFF', font=font_head)
        y += 30

        total_general = 0
        for i, item in enumerate(items):
            bg = '#FFFFFF' if i % 2 == 0 else '#f5f5f5'
            draw.rectangle([(20, y), (W - 20, y + row_h)], fill=bg)

            cant = float(item.get('cantidad', 1) or 1)
            precio = float(item.get('precio_unitario', 0) or 0)
            subtotal = cant * precio
            tiene_iva = item.get('tiene_iva', False)
            total_row = subtotal * 1.16 if tiene_iva else subtotal
            total_general += total_row

            draw.text((cols[0] + 5, y + 9), str(i + 1), fill='#333', font=font_body)
            draw.text((cols[1] + 5, y + 9), str(item.get('componente', ''))[:30], fill='#000', font=font_body)
            draw.text((cols[2] + 5, y + 9), str(item.get('comentario', ''))[:22], fill='#666', font=font_body)
            draw.text((cols[3] + 5, y + 9), str(int(cant) if cant == int(cant) else cant), fill='#000', font=font_body)
            draw.text((cols[4] + 5, y + 9), f"${precio:,.2f}", fill='#000', font=font_body)
            draw.text((cols[5] + 5, y + 9), f"${subtotal:,.2f}", fill='#000', font=font_body)
            draw.text((cols[6] + 5, y + 9), "Si" if tiene_iva else "No", fill='#000', font=font_body)
            y += row_h

        # Bottom border
        draw.line([(20, y), (W - 20, y)], fill='#1a1a2e', width=2)
        y += 10

        # Totals
        draw.rectangle([(W - 250, y), (W - 20, y + 28)], fill='#1a1a2e')
        draw.text((W - 245, y + 7), f"TOTAL: ${total_general:,.2f}", fill='#F47427', font=font_head)
        y += 45

        # Notes
        if req.get('notas'):
            draw.text((20, y), "NOTAS:", fill='#888888', font=font_label)
            draw.text((80, y), str(req.get('notas', ''))[:80], fill='#333', font=font_small)
            y += 20

        # Footer
        draw.text((20, y), "DURTRON - Innovacion Industrial | Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056", fill='#999999', font=font_small)
        y += 15
        draw.text((20, y), "Favor de responder con precios y tiempos de entrega.", fill='#999999', font=font_small)

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        safe_name = prov_name.replace(' ', '_').replace('/', '_')
        filename = f"req_{req.get('folio', 'REQ')}_{safe_name}.png"
        return send_file(buf, mimetype='image/png', as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Error generando orden req proveedor: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones/<int:rid>/enviar-email', methods=['POST'])
def enviar_requisicion_email(rid):
    try:
        resend_key = os.environ.get('RESEND_API_KEY', '')
        from_email = os.environ.get('RESEND_FROM', 'Durtron <onboarding@resend.dev>')

        if not resend_key:
            return jsonify({'error': 'Configure RESEND_API_KEY en variables de entorno. Regístrese gratis en resend.com'}), 400

        target_proveedor = request.args.get('proveedor')

        conn = get_db()
        cur = conn.cursor()
        
        cur.execute('SELECT * FROM requisiciones WHERE id=%s', (rid,))
        req = cur.fetchone()
        if not req:
            cur.close()
            conn.close()
            return jsonify({'error': 'Requisicion no encontrada'}), 404
            
        if target_proveedor:
            cur.execute('SELECT * FROM requisicion_items WHERE requisicion_id=%s AND proveedor_nombre=%s ORDER BY id', (rid, target_proveedor))
        else:
            cur.execute('SELECT * FROM requisicion_items WHERE requisicion_id=%s ORDER BY id', (rid,))
        items = cur.fetchall()

        prov_data = None
        if target_proveedor:
            cur.execute('SELECT * FROM proveedores WHERE razon_social=%s', (target_proveedor,))
            prov_data = cur.fetchone()
        elif req.get('proveedor_id'):
            cur.execute('SELECT * FROM proveedores WHERE id=%s', (req['proveedor_id'],))
            prov_data = cur.fetchone()
        
        cur.close()
        conn.close()

        if not items:
            return jsonify({'error': 'No hay items para enviar'}), 400
        if not prov_data:
            return jsonify({'error': f'No se encontraron datos del proveedor: {target_proveedor or "Principal"}'}), 400

        dest_email = prov_data.get('correo')
        if not dest_email:
            return jsonify({'error': f'El proveedor {prov_data["razon_social"]} no tiene correo registrado'}), 400

        items_text = "\n".join([
            f"  - {it['componente']} ({it.get('comentario') or ''}): {it['cantidad']} {it['unidad']}"
            for it in items
        ])
        
        body = f"""Estimado/a {prov_data.get('contacto_nombre', prov_data['razon_social'])},

Le enviamos la solicitud de cotización/pedido: {req['folio']} 
Proyecto / Referencia: {req.get('equipo_nombre','')}

Partidas requeridas:
{items_text}

Notas: {req.get('notas', 'N/A')}

Solicitado por: {req.get('emitido_por', 'DURTRON')}

Favor de confirmar recepción y tiempos de entrega.

Saludos,
DURTRON - Innovacion Industrial
"""
        subject = f"Requisicion {req['folio']} - {prov_data['razon_social']} - DURTRON"

        def _send_resend():
            try:
                import urllib.request
                payload = json.dumps({
                    "from": from_email,
                    "to": [dest_email],
                    "subject": subject,
                    "text": body
                }).encode('utf-8')
                rq = urllib.request.Request(
                    'https://api.resend.com/emails',
                    data=payload,
                    headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'}
                )
                print(f'[EMAIL] Sending via Resend API to {dest_email}...')
                resp = urllib.request.urlopen(rq, timeout=15)
                result = json.loads(resp.read())
                print(f'[EMAIL] Sent OK - id: {result.get("id")}')
            except urllib.request.HTTPError as he:
                err_body = he.read().decode('utf-8', errors='replace')
                print(f'[EMAIL ERROR] HTTP {he.code}: {err_body}')
            except Exception as e:
                print(f'[EMAIL ERROR] {e}')
                traceback.print_exc()

        t = threading.Thread(target=_send_resend, daemon=True)
        t.start()
        return jsonify({'success': True, 'message': f'Email en proceso de envío a {dest_email}'})
    except Exception as e:
        print(f'[EMAIL ERROR] {e}')
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones/<int:rid>/whatsapp-url', methods=['GET'])
def get_whatsapp_url(rid):
    try:
        target_proveedor = request.args.get('proveedor')
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM requisiciones WHERE id=%s', (rid,))
        req = cur.fetchone()
        if not req: return jsonify({'error': 'Requisicion no encontrada'}), 404

        prov_data = None
        if target_proveedor:
            cur.execute('SELECT * FROM requisicion_items WHERE requisicion_id=%s AND proveedor_nombre=%s', (rid, target_proveedor))
            items = cur.fetchall()
            cur.execute('SELECT * FROM proveedores WHERE razon_social=%s', (target_proveedor,))
            prov_data = cur.fetchone()
        else:
            cur.execute('SELECT * FROM requisicion_items WHERE requisicion_id=%s', (rid,))
            items = cur.fetchall()
            if req.get('proveedor_id'):
                cur.execute('SELECT * FROM proveedores WHERE id=%s', (req['proveedor_id'],))
                prov_data = cur.fetchone()
        
        cur.close()
        conn.close()

        if not items: return jsonify({'error': 'No hay items'}), 400
        if not prov_data: return jsonify({'error': 'No se encontraron datos del proveedor'}), 400

        tel = (prov_data.get('whatsapp') or prov_data.get('telefono') or '').replace(' ','').replace('-','').replace('+','')
        if not tel: return jsonify({'error': 'El proveedor no tiene telefono/WhatsApp'}), 400

        items_text = "%0A".join([f"- {it['componente']} ({it.get('cantidad')} {it['unidad']})" for it in items])
        msg = f"Hola {prov_data.get('razon_social')}, le enviamos de DURTRON:%0AProyecto: {req.get('equipo_nombre')}%0A%0A{items_text}%0A%0ANotas: {req.get('notas','')}"
        
        return jsonify({'success': True, 'url': f"https://wa.me/{tel}?text={msg}"})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== ETIQUETA DESDE REQUISICION ====================
@app.route('/api/requisiciones/<int:rid>/etiqueta', methods=['POST'])
def generar_etiqueta_requisicion(rid):
    """Genera etiqueta PNG con datos enviados en el body (o leidos de la req)"""
    try:
        d = request.json or {}

        # Datos de la etiqueta vienen del formulario del usuario
        equipo = d.get('equipo', '')
        modelo = d.get('modelo', '')
        capacidad = d.get('capacidad', '')
        potencia = d.get('potencia', '')
        apertura = d.get('apertura', '')
        tamano_alimentacion = d.get('tamano_alimentacion', '')
        peso = d.get('peso', '')
        fecha_fabricacion = d.get('fecha_fabricacion', '')
        numero_serie = d.get('numero_serie', '')

        # Crear imagen de etiqueta 800x420
        W, H = 800, 420
        img = Image.new('RGB', (W, H), '#FFFFFF')
        draw = ImageDraw.Draw(img)

        try:
            font_title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
            font_subtitle = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
            font_label = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
            font_value = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
            font_footer = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
            font_badge = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
        except Exception:
            font_title = ImageFont.load_default()
            font_subtitle = font_title
            font_label = font_title
            font_value = font_title
            font_footer = font_title
            font_badge = font_title

        # Header: DURTRON
        draw.text((30, 20), 'DURTRON', fill='#000000', font=font_title)
        draw.text((30, 52), 'INNOVACION INDUSTRIAL', fill='#555555', font=font_subtitle)

        # Badge: Calidad Industrial
        draw.text((550, 20), 'Calidad Industrial', fill='#333333', font=font_badge)
        draw.text((550, 38), 'Durtron Planta 1 Durango', fill='#555555', font=font_badge)

        # Linea separadora
        draw.line([(25, 72), (W-25, 72)], fill='#000000', width=2)

        # Grid de datos - 3 columnas x 3 filas
        campos = [
            ('Equipo', equipo or '-'),
            ('Apertura', apertura or '-'),
            ('Peso del Equipo', peso or '-'),
            ('Modelo', modelo or '-'),
            ('Tamano de Alimentacion', tamano_alimentacion or '-'),
            ('Fecha de Fabricacion', fecha_fabricacion or '-'),
            ('Capacidad', capacidad or '-'),
            ('Potencia', potencia or '-'),
            ('Numero de Serie', numero_serie or '-'),
        ]

        col_w = (W - 60) // 3
        start_y = 85
        row_h = 65

        for idx, (label, value) in enumerate(campos):
            col = idx % 3
            row = idx // 3
            x = 30 + col * col_w
            y = start_y + row * row_h

            draw.text((x, y), label, fill='#666666', font=font_label)
            box_y = y + 16
            draw.rectangle([(x, box_y), (x + col_w - 15, box_y + 28)], outline='#000000', width=1)
            val_str = str(value)[:25]
            draw.text((x + 6, box_y + 6), val_str, fill='#000000', font=font_value)

        # Footer
        footer_y = start_y + 3 * row_h + 15
        draw.line([(25, footer_y), (W-25, footer_y)], fill='#000000', width=1)
        footer_y += 10
        draw.text((30, footer_y), '6181341056', fill='#333333', font=font_footer)
        draw.text((280, footer_y), 'contacto@durtron.com', fill='#333333', font=font_footer)
        draw.text((560, footer_y), 'www.durtron.com', fill='#333333', font=font_footer)

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)

        serie = (numero_serie or equipo or 'etiqueta').replace(' ', '_')
        return Response(
            buf.getvalue(),
            mimetype='image/png',
            headers={'Content-Disposition': f'attachment; filename=etiqueta_{serie}.png'}
        )
    except Exception as e:
        print(f'Error generando etiqueta req: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/requisiciones/<int:rid>/enviar-etiqueta', methods=['POST'])
def enviar_etiqueta_email(rid):
    """Genera la etiqueta PNG y la envia como adjunto al email via Resend API"""
    try:
        import base64

        d = request.json or {}
        dest_email = d.get('email', '')
        if not dest_email:
            return jsonify({'error': 'Debe indicar un correo destino'}), 400

        resend_key = os.environ.get('RESEND_API_KEY', '')
        from_email = os.environ.get('RESEND_FROM', 'Durtron <onboarding@resend.dev>')

        if not resend_key:
            return jsonify({'error': 'Configure RESEND_API_KEY en variables de entorno. Regístrese gratis en resend.com'}), 400

        # Get req info
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT * FROM requisiciones WHERE id=%s', (rid,))
        req = cur.fetchone()
        cur.close()
        conn.close()
        if not req:
            return jsonify({'error': 'Requisicion no encontrada'}), 404

        # Generate label image
        equipo = d.get('equipo', req.get('equipo_nombre', ''))
        W, H = 800, 420
        img = Image.new('RGB', (W, H), '#FFFFFF')
        draw = ImageDraw.Draw(img)

        try:
            font_title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
            font_subtitle = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
            font_label = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
            font_value = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
            font_footer = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
            font_badge = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
        except Exception:
            font_title = ImageFont.load_default()
            font_subtitle = font_title
            font_label = font_title
            font_value = font_title
            font_footer = font_title
            font_badge = font_title

        draw.text((30, 20), 'DURTRON', fill='#000000', font=font_title)
        draw.text((30, 52), 'INNOVACION INDUSTRIAL', fill='#555555', font=font_subtitle)
        draw.text((550, 20), 'Calidad Industrial', fill='#333333', font=font_badge)
        draw.text((550, 38), 'Durtron Planta 1 Durango', fill='#555555', font=font_badge)
        draw.line([(25, 72), (W-25, 72)], fill='#000000', width=2)

        campos = [
            ('Equipo', equipo or '-'),
            ('Apertura', d.get('apertura', '') or '-'),
            ('Peso del Equipo', d.get('peso', '') or '-'),
            ('Modelo', d.get('modelo', '') or '-'),
            ('Tamano de Alimentacion', d.get('tamano_alimentacion', '') or '-'),
            ('Fecha de Fabricacion', d.get('fecha_fabricacion', '') or '-'),
            ('Capacidad', d.get('capacidad', '') or '-'),
            ('Potencia', d.get('potencia', '') or '-'),
            ('Numero de Serie', d.get('numero_serie', '') or '-'),
        ]

        col_w = (W - 60) // 3
        start_y = 85
        row_h = 65

        for idx, (label, value) in enumerate(campos):
            col = idx % 3
            row = idx // 3
            x = 30 + col * col_w
            y = start_y + row * row_h
            draw.text((x, y), label, fill='#666666', font=font_label)
            box_y = y + 16
            draw.rectangle([(x, box_y), (x + col_w - 15, box_y + 28)], outline='#000000', width=1)
            draw.text((x + 6, box_y + 6), str(value)[:25], fill='#000000', font=font_value)

        footer_y = start_y + 3 * row_h + 15
        draw.line([(25, footer_y), (W-25, footer_y)], fill='#000000', width=1)
        footer_y += 10
        draw.text((30, footer_y), '6181341056', fill='#333333', font=font_footer)
        draw.text((280, footer_y), 'contacto@durtron.com', fill='#333333', font=font_footer)
        draw.text((560, footer_y), 'www.durtron.com', fill='#333333', font=font_footer)

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        img_bytes = buf.getvalue()

        subject = f"Etiqueta de Equipo - {equipo} - DURTRON"
        body_text = f"""Adjuntamos la etiqueta de identificación del equipo:

Equipo: {equipo}
Proyecto/Requisición: {req.get('folio', '')} - {req.get('equipo_nombre', '')}

Saludos,
DURTRON - Innovacion Industrial
Tel: 618 134 1056
"""
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        filename = f'etiqueta_{equipo.replace(" ", "_")}.png'

        def _send_etiqueta_resend():
            try:
                import urllib.request
                payload = json.dumps({
                    "from": from_email,
                    "to": [dest_email],
                    "subject": subject,
                    "text": body_text,
                    "attachments": [{
                        "filename": filename,
                        "content": img_b64
                    }]
                }).encode('utf-8')
                rq = urllib.request.Request(
                    'https://api.resend.com/emails',
                    data=payload,
                    headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'}
                )
                print(f'[EMAIL-ETQ] Sending via Resend API to {dest_email}...')
                resp = urllib.request.urlopen(rq, timeout=15)
                result = json.loads(resp.read())
                print(f'[EMAIL-ETQ] Sent OK - id: {result.get("id")}')
            except urllib.request.HTTPError as he:
                err_body = he.read().decode('utf-8', errors='replace')
                print(f'[EMAIL-ETQ ERROR] HTTP {he.code}: {err_body}')
            except Exception as e:
                print(f'[EMAIL-ETQ ERROR] {e}')
                traceback.print_exc()

        t = threading.Thread(target=_send_etiqueta_resend, daemon=True)
        t.start()

        return jsonify({'success': True, 'message': f'Etiqueta en proceso de envío a {dest_email}'})
    except Exception as e:
        print(f'[EMAIL-ETQ ERROR] {e}')
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==================== PLANTILLAS COMPONENTES ====================
@app.route('/api/plantillas', methods=['GET'])
def get_plantillas():
    try:
        categoria = request.args.get('categoria', '')
        conn = get_db()
        cur = conn.cursor()
        if categoria:
            cur.execute('SELECT * FROM plantillas_componentes WHERE categoria=%s ORDER BY componente', (categoria,))
        else:
            cur.execute('SELECT * FROM plantillas_componentes ORDER BY categoria, componente')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return Response(json.dumps(rows, default=decimal_default), mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/plantillas', methods=['POST'])
def create_plantilla():
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO plantillas_componentes (categoria, componente, cantidad_default, unidad)
            VALUES (%s,%s,%s,%s) RETURNING id
        ''', (d['categoria'], d['componente'], d.get('cantidad_default',1), d.get('unidad','pza')))
        pid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': pid})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/plantillas/<int:pid>', methods=['DELETE'])
def delete_plantilla(pid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM plantillas_componentes WHERE id=%s', (pid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Plantilla eliminada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ADMIN ====================
@app.route('/api/init-db', methods=['POST'])
def init_database():
    try:
        import init_db
        init_db.init_db()
        return jsonify({'success': True, 'message': 'Base de datos inicializada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

# Auto-migrate on import (works with gunicorn)
try:
    _conn = get_db()
    _cur = _conn.cursor()
    _cur.execute("ALTER TABLE equipos ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0'")
    _cur.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cuenta_bancaria TEXT")
    _cur.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS entregado BOOLEAN DEFAULT FALSE")
    _cur.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado_venta VARCHAR(50) DEFAULT 'Anticipo'")
    _cur.execute('''
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
    _cur.execute('''
        CREATE TABLE IF NOT EXISTS vendedores_catalogo (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL UNIQUE,
            telefono VARCHAR(50),
            email VARCHAR(100),
            activo BOOLEAN DEFAULT TRUE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    _cur.execute("ALTER TABLE requisiciones ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100)")
    _cur.execute('''
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
    _conn.commit()
    _cur.close()
    _conn.close()
    print("Migration OK: version, cuenta_bancaria, entregado, estado_venta, anticipos, vendedores_catalogo, req numero_serie, requisicion_envios")
except Exception as _e:
    print(f"Migration warning: {_e}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
