from flask import Flask, request, jsonify, send_from_directory, session, redirect
from flask_cors import CORS
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from decimal import Decimal
import os
import json

app = Flask(__name__, static_folder='frontend')
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
            'Disponible', 'En Fabricacion', 'En Planta 1', 'En Planta 2',
            'No Disponible', 'Anticipo', 'En Cotizacion', 'Apartada'
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
        year = request.args.get('year', datetime.now().year, type=int)
        conn = get_db()
        cur = conn.cursor()

        cur.execute('SELECT COUNT(*) as total FROM equipos')
        total_catalogo = cur.fetchone()['total']

        cur.execute('SELECT COUNT(*) as total FROM inventario')
        total_inventario = cur.fetchone()['total']

        cur.execute("SELECT COUNT(*) as total FROM inventario WHERE estado = 'Disponible'")
        inv_disponible = cur.fetchone()['total']

        # Ventas del anio: separar facturadas y no facturadas
        cur.execute('''
            SELECT COUNT(*) as cnt,
                   COALESCE(SUM(precio_venta),0) as neto,
                   COALESCE(SUM(CASE WHEN facturado=true THEN precio_venta ELSE 0 END),0) as neto_fact,
                   COALESCE(SUM(CASE WHEN facturado=false THEN precio_venta ELSE 0 END),0) as neto_no_fact
            FROM ventas WHERE EXTRACT(YEAR FROM fecha_venta)=%s
        ''', (year,))
        row = cur.fetchone()
        ventas_anio_cnt = row['cnt']
        ventas_anio_neto = float(row['neto'])
        # IVA solo se aplica a las facturadas
        ventas_anio_iva = round(float(row['neto_fact']) * 1.16 + float(row['neto_no_fact']), 2)

        # Mensual: con desglose facturado/no facturado
        cur.execute('''
            SELECT EXTRACT(MONTH FROM fecha_venta)::int as mes,
                   COUNT(*) as cnt,
                   COALESCE(SUM(precio_venta),0) as neto,
                   COALESCE(SUM(CASE WHEN facturado=true THEN precio_venta ELSE 0 END),0) as neto_fact,
                   COALESCE(SUM(CASE WHEN facturado=false THEN precio_venta ELSE 0 END),0) as neto_no_fact
            FROM ventas
            WHERE EXTRACT(YEAR FROM fecha_venta)=%s
            GROUP BY mes ORDER BY mes
        ''', (year,))
        rows = cur.fetchall()
        monthly = {}
        for r in rows:
            neto = float(r['neto'])
            neto_fact = float(r['neto_fact'])
            neto_no_fact = float(r['neto_no_fact'])
            monthly[r['mes']] = {
                'total_ventas': r['cnt'],
                'ingreso_neto': neto,
                'ingreso_iva': round(neto_fact * 1.16 + neto_no_fact, 2)
            }

        meses_data = []
        for m in range(1, 13):
            d = monthly.get(m, {'total_ventas': 0, 'ingreso_neto': 0.0, 'ingreso_iva': 0.0})
            meses_data.append({
                'mes': m,
                'nombre': MESES[m-1],
                'total_ventas': d['total_ventas'],
                'ingreso_neto': d['ingreso_neto'],
                'ingreso_iva': d['ingreso_iva']
            })

        # Trimestral
        trimestres = []
        for q in range(4):
            start = q * 3
            t = {'trimestre': q+1, 'total_ventas': 0, 'ingreso_neto': 0.0, 'ingreso_iva': 0.0}
            for i in range(3):
                t['total_ventas'] += meses_data[start+i]['total_ventas']
                t['ingreso_neto'] += meses_data[start+i]['ingreso_neto']
                t['ingreso_iva'] += meses_data[start+i]['ingreso_iva']
            t['ingreso_neto'] = round(t['ingreso_neto'], 2)
            t['ingreso_iva'] = round(t['ingreso_iva'], 2)
            trimestres.append(t)

        cur.close()
        conn.close()

        return jsonify({
            'total_catalogo': total_catalogo,
            'total_inventario': total_inventario,
            'inv_disponible': inv_disponible,
            'ventas_anio': ventas_anio_cnt,
            'ingreso_neto_anio': ventas_anio_neto,
            'ingreso_iva_anio': ventas_anio_iva,
            'mensual': meses_data,
            'trimestral': trimestres,
            'year': year
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
        codigo = (d.get('codigo') or '').strip()
        nombre = (d.get('nombre') or '').strip()
        if not codigo or not nombre:
            return jsonify({'error': 'Codigo y Nombre son obligatorios'}), 400

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
                precio_lista, precio_minimo, precio_costo,
                potencia_motor, capacidad, dimensiones, peso, especificaciones)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (
            codigo, nombre, d.get('marca') or '', d.get('modelo') or '',
            d.get('descripcion') or '', d.get('categoria') or '',
            to_float(d.get('precio_lista')), to_float(d.get('precio_minimo')), to_float(d.get('precio_costo')),
            d.get('potencia_motor') or '', d.get('capacidad') or '', d.get('dimensiones') or '',
            d.get('peso') or '', d.get('especificaciones') or ''
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

# ==================== INVENTARIO ====================
@app.route('/api/inventario')
def get_inventario():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('''
            SELECT i.*, e.codigo as equipo_codigo, e.nombre as equipo_nombre,
                   e.marca, e.modelo, e.categoria, e.precio_lista, e.precio_minimo, e.precio_costo
            FROM inventario i
            JOIN equipos e ON i.equipo_id = e.id
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
        cur.execute('''
            INSERT INTO inventario (equipo_id, numero_serie, estado, observaciones)
            VALUES (%s,%s,%s,%s) RETURNING id
        ''', (
            d.get('equipo_id'), d.get('numero_serie',''),
            d.get('estado','Disponible'), d.get('observaciones','')
        ))
        iid = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'id': iid, 'message': 'Agregado al inventario'})
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

@app.route('/api/inventario/<int:iid>/vender', methods=['POST'])
def vender_item(iid):
    try:
        d = request.json
        conn = get_db()
        cur = conn.cursor()

        # Obtener info del inventario
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

        cur.execute('''
            INSERT INTO ventas (inventario_id, equipo_id, vendedor, cliente_nombre,
                cliente_contacto, cliente_rfc, cliente_direccion, precio_venta,
                descuento_monto, descuento_porcentaje, motivo_descuento,
                forma_pago, facturado, numero_factura, autorizado_por, notas)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        ''', (
            iid, inv['equipo_id'], d.get('vendedor',''),
            d.get('cliente_nombre',''), d.get('cliente_contacto',''),
            d.get('cliente_rfc',''), d.get('cliente_direccion',''),
            precio_venta, descuento_monto, round(descuento_pct, 2),
            d.get('motivo_descuento',''), d.get('forma_pago',''),
            d.get('facturado', False), d.get('numero_factura',''),
            d.get('autorizado_por',''), d.get('notas','')
        ))
        vid = cur.fetchone()['id']

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
        data = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(data, default=decimal_default), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ventas/<int:vid>', methods=['DELETE'])
def delete_venta(vid):
    try:
        conn = get_db()
        cur = conn.cursor()
        # Obtener el inventario_id antes de borrar
        cur.execute('SELECT inventario_id FROM ventas WHERE id=%s', (vid,))
        venta = cur.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404
        # Restaurar inventario a Disponible
        cur.execute("UPDATE inventario SET estado='Disponible' WHERE id=%s", (venta['inventario_id'],))
        # Eliminar la venta
        cur.execute('DELETE FROM ventas WHERE id=%s', (vid,))
        conn.commit()
        cur.close()
        conn.close()
