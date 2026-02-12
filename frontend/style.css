// ===== CONFIGURACION =====
const API = window.location.origin;
let equiposCatalogo = [];
let inventarioItems = [];
let ventasData = [];
let configData = {};
let dashboardData = {};
let periodoActual = 'mensual';

// ===== AUTH =====
async function cerrarSesion() {
    if (!confirm('Cerrar sesion?')) return;
    await fetch(`${API}/api/logout`, { method: 'POST' });
    window.location.href = '/login';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    setupForms();
    loadConfig().then(() => {
        loadDashboard();
        loadCatalogo();
        loadInventario();
        loadVentas();
        loadVendedores();
        loadCotizaciones();
    });
});

// ===== NAVEGACION =====
function setupNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = btn.dataset.section;
            document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(s).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (s === 'vendedores') loadVendedores();
            if (s === 'ventas') loadVentas();
            if (s === 'dashboard') loadDashboard();
            if (s === 'cotizaciones') { loadCotizaciones(); populateCotEquipoSelects(); }
        });
    });
}

// ===== CONFIGURACION =====
async function loadConfig() {
    try {
        const r = await fetch(`${API}/api/config`);
        configData = await r.json();
        fillSelect('cat-categoria', configData.categorias);
        fillSelect('inv-estado', configData.estados_inventario);
        fillSelect('inv-filter-estado', configData.estados_inventario, true);
        fillSelect('venta-forma-pago', configData.formas_pago);
    } catch (e) {
        console.error('Error config:', e);
    }
}

function fillSelect(id, options, addAll) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.querySelector('option');
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    if (addAll) {
        const all = document.createElement('option');
        all.value = '';
        all.textContent = 'Todos';
        if (!first) sel.appendChild(all);
    }
    (options || []).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        sel.appendChild(opt);
    });
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const r = await fetch(`${API}/api/dashboard`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        dashboardData = await r.json();
        const d = dashboardData;

        document.getElementById('stat-catalogo').textContent = d.total_catalogo || 0;
        document.getElementById('stat-inventario').textContent = d.total_inventario || 0;
        document.getElementById('stat-ingreso-neto').textContent = money(d.ingreso_neto_anio);
        document.getElementById('stat-ingreso-iva').textContent = money(d.ingreso_iva_anio);
        document.getElementById('stat-total-ventas').textContent = d.ventas_anio || 0;

        renderPeriodo();
    } catch (e) {
        console.error('Error dashboard:', e);
        notify('Error al cargar dashboard: ' + e.message, 'error');
    }
}

function showPeriodo(tipo) {
    periodoActual = tipo;
    document.getElementById('btn-mensual').classList.toggle('active', tipo === 'mensual');
    document.getElementById('btn-trimestral').classList.toggle('active', tipo === 'trimestral');
    renderPeriodo();
}

function renderPeriodo() {
    const thead = document.getElementById('periodo-thead');
    const tbody = document.getElementById('periodo-tbody');
    if (!dashboardData.mensual) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">Sin datos</td></tr>';
        return;
    }

    thead.innerHTML = '<tr><th>' + (periodoActual === 'mensual' ? 'Mes' : 'Trimestre') +
        '</th><th class="text-right">Ventas</th><th class="text-right">Ingreso Neto</th><th class="text-right">Ingreso + IVA</th></tr>';

    const data = periodoActual === 'mensual' ? dashboardData.mensual : dashboardData.trimestral;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">Sin ventas registradas</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(d => {
        const label = periodoActual === 'mensual' ? d.nombre : `Q${d.trimestre}`;
        return `<tr>
            <td><strong>${label}</strong></td>
            <td class="text-right">${d.total_ventas}</td>
            <td class="text-right font-bold">${money(d.ingreso_neto)}</td>
            <td class="text-right">${money(d.ingreso_iva)}</td>
        </tr>`;
    }).join('');
}

// ===== CATALOGO =====
async function loadCatalogo() {
    try {
        const r = await fetch(`${API}/api/equipos`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        equiposCatalogo = Array.isArray(data) ? data : [];
        renderCatalogo();
        updateEquipoSelect();
    } catch (e) {
        console.error('Error catalogo:', e);
        document.getElementById('catalogo-tbody').innerHTML =
            `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`;
    }
}

function renderCatalogo() {
    const tbody = document.getElementById('catalogo-tbody');
    if (equiposCatalogo.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No hay equipos en el catalogo</td></tr>';
        return;
    }
    tbody.innerHTML = equiposCatalogo.map(eq => `<tr>
        <td><strong>${eq.codigo}</strong></td>
        <td>${eq.nombre}</td>
        <td>${eq.marca || '-'}</td>
        <td>${eq.modelo || '-'}</td>
        <td>${eq.categoria || '-'}</td>
        <td class="text-right">${money(eq.precio_lista)}</td>
        <td class="text-right">${money(eq.precio_minimo)}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-sm btn-danger" onclick="deleteCatalogo(${eq.id})">Eliminar</button>
            </div>
        </td>
    </tr>`).join('');
}

function updateEquipoSelect() {
    const sel = document.getElementById('inv-equipo');
    sel.innerHTML = '<option value="">Seleccionar equipo...</option>';
    equiposCatalogo.forEach(eq => {
        const opt = document.createElement('option');
        opt.value = eq.id;
        opt.textContent = `${eq.codigo} - ${eq.nombre}`;
        sel.appendChild(opt);
    });
}

async function deleteCatalogo(id) {
    if (!confirm('Eliminar este equipo del catalogo?')) return;
    try {
        const r = await fetch(`${API}/api/equipos/${id}`, { method: 'DELETE' });
        const data = await r.json();
        if (data.success) {
            notify('Equipo eliminado del catalogo', 'success');
            loadCatalogo();
        } else {
            notify(data.error || 'Error al eliminar', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ===== INVENTARIO =====
async function loadInventario() {
    try {
        const r = await fetch(`${API}/api/inventario`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        inventarioItems = Array.isArray(data) ? data : [];
        renderInventario(inventarioItems);
        setupInvFilters();
    } catch (e) {
        console.error('Error inventario:', e);
        document.getElementById('inventario-tbody').innerHTML =
            `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`;
    }
}

function renderInventario(items) {
    const tbody = document.getElementById('inventario-tbody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No hay items en inventario</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(it => `<tr>
        <td>${it.id}</td>
        <td><strong>${it.equipo_codigo}</strong></td>
        <td>${it.equipo_nombre}</td>
        <td>${it.numero_serie || '-'}</td>
        <td>${badgeEstado(it.estado)}</td>
        <td class="text-right">${money(it.precio_lista)}</td>
        <td>${formatDate(it.fecha_ingreso)}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick="verDetalle(${it.id})">Ver</button>
                ${canSell(it.estado) ? `<button class="btn btn-sm btn-success" onclick="openVenta(${it.id})">Vender</button>` : ''}
                ${it.estado !== 'Vendida' ? `<button class="btn btn-sm btn-danger" onclick="deleteInventario(${it.id})">Eliminar</button>` : ''}
            </div>
        </td>
    </tr>`).join('');
}

async function deleteInventario(id) {
    if (!confirm('Eliminar este item del inventario?')) return;
    try {
        const r = await fetch(`${API}/api/inventario/${id}`, { method: 'DELETE' });
        const data = await r.json();
        if (data.success) {
            notify('Item eliminado del inventario', 'success');
            loadInventario();
            loadDashboard();
        } else {
            notify(data.error || 'Error al eliminar', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

function setupInvFilters() {
    const search = document.getElementById('inv-search');
    const estado = document.getElementById('inv-filter-estado');
    const filter = () => {
        let items = [...inventarioItems];
        const term = search.value.toLowerCase();
        if (term) {
            items = items.filter(i =>
                (i.equipo_codigo || '').toLowerCase().includes(term) ||
                (i.equipo_nombre || '').toLowerCase().includes(term) ||
                (i.numero_serie || '').toLowerCase().includes(term)
            );
        }
        if (estado.value) items = items.filter(i => i.estado === estado.value);
        renderInventario(items);
    };
    search.addEventListener('input', filter);
    estado.addEventListener('change', filter);
}

function canSell(estado) {
    return ['Disponible', 'En Planta 1', 'En Planta 2', 'Apartada', 'Anticipo'].includes(estado);
}

// ===== VER DETALLE =====
async function verDetalle(id) {
    try {
        const r = await fetch(`${API}/api/inventario/${id}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const it = await r.json();
        document.getElementById('modal-detalle-body').innerHTML = `
            <div class="equipo-preview">
                <div class="info-row"><span>Codigo:</span> <strong>${it.equipo_codigo}</strong></div>
                <div class="info-row"><span>Nombre:</span> <strong>${it.equipo_nombre}</strong></div>
                <div class="info-row"><span>Marca:</span> <strong>${it.marca || '-'}</strong> | <span>Modelo:</span> <strong>${it.modelo || '-'}</strong></div>
                <div class="info-row"><span>Categoria:</span> <strong>${it.categoria || '-'}</strong></div>
                <div class="info-row"><span>N/Serie:</span> <strong>${it.numero_serie || '-'}</strong></div>
                <div class="info-row"><span>Estado:</span> ${badgeEstado(it.estado)}</div>
            </div>
            <div class="equipo-preview" style="margin-top:1rem;">
                <h4 style="margin-bottom:0.5rem;">Precios</h4>
                <div class="info-row"><span>Lista:</span> <strong class="text-success">${money(it.precio_lista)}</strong></div>
                <div class="info-row"><span>Minimo:</span> <strong class="text-warning">${money(it.precio_minimo)}</strong></div>
                ${it.precio_costo ? `<div class="info-row"><span>Costo:</span> <strong>${money(it.precio_costo)}</strong></div>` : ''}
            </div>
            ${it.potencia_motor || it.capacidad || it.dimensiones || it.peso ? `
            <div class="equipo-preview" style="margin-top:1rem;">
                <h4 style="margin-bottom:0.5rem;">Especificaciones</h4>
                ${it.potencia_motor ? `<div class="info-row"><span>Potencia:</span> <strong>${it.potencia_motor}</strong></div>` : ''}
                ${it.capacidad ? `<div class="info-row"><span>Capacidad:</span> <strong>${it.capacidad}</strong></div>` : ''}
                ${it.dimensiones ? `<div class="info-row"><span>Dimensiones:</span> <strong>${it.dimensiones}</strong></div>` : ''}
                ${it.peso ? `<div class="info-row"><span>Peso:</span> <strong>${it.peso}</strong></div>` : ''}
            </div>` : ''}
            ${it.especificaciones ? `<div class="equipo-preview" style="margin-top:1rem;"><p>${it.especificaciones}</p></div>` : ''}
            ${it.observaciones ? `<div class="equipo-preview" style="margin-top:1rem;"><h4>Observaciones</h4><p>${it.observaciones}</p></div>` : ''}
        `;
        openModal('modal-detalle');
    } catch (e) {
        notify('Error al cargar detalle: ' + e.message, 'error');
    }
}

// ===== VENTA =====
async function openVenta(id) {
    try {
        const r = await fetch(`${API}/api/inventario/${id}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const it = await r.json();

        document.getElementById('venta-inv-id').value = id;
        document.getElementById('venta-equipo-info').innerHTML = `
            <div class="info-row"><strong>${it.equipo_codigo}</strong> - ${it.equipo_nombre}</div>
            <div class="info-row"><span>Precio Lista:</span> <strong class="text-success">${money(it.precio_lista)}</strong> |
                <span>Precio Min:</span> <strong class="text-warning">${money(it.precio_minimo)}</strong></div>
        `;
        document.getElementById('venta-precio').value = it.precio_lista || 0;
        document.getElementById('form-venta').reset();
        document.getElementById('venta-inv-id').value = id;
        document.getElementById('venta-precio').value = it.precio_lista || 0;
        openModal('modal-venta');
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ===== VENTAS =====
async function loadVentas() {
    try {
        const r = await fetch(`${API}/api/ventas`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        ventasData = Array.isArray(data) ? data : [];
        renderVentas();
    } catch (e) {
        document.getElementById('ventas-tbody').innerHTML =
            `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`;
    }
}

function renderVentas() {
    const tbody = document.getElementById('ventas-tbody');
    if (ventasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No hay ventas registradas</td></tr>';
        return;
    }
    tbody.innerHTML = ventasData.map(v => `<tr>
        <td>${formatDate(v.fecha_venta)}</td>
        <td><strong>${v.equipo_codigo || ''}</strong> ${v.equipo_nombre || ''}</td>
        <td>${v.cliente_nombre}</td>
        <td>${v.vendedor}</td>
        <td class="text-right font-bold">${money(v.precio_venta)}</td>
        <td>${v.forma_pago || '-'}</td>
        <td>${v.facturado ? '<span class="badge badge-si">Si</span>' : '<span class="badge badge-no">No</span>'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteVenta(${v.id})">Eliminar</button></td>
    </tr>`).join('');
}

async function deleteVenta(id) {
    if (!confirm('Eliminar esta venta? El equipo se restaurara al inventario como Disponible.')) return;
    try {
        const r = await fetch(`${API}/api/ventas/${id}`, { method: 'DELETE' });
        const data = await r.json();
        if (data.success) {
            notify('Venta eliminada', 'success');
            loadVentas();
            loadInventario();
            loadDashboard();
            loadVendedores();
        } else {
            notify(data.error || 'Error al eliminar', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ===== VENDEDORES =====
async function loadVendedores() {
    try {
        const r = await fetch(`${API}/api/vendedores`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const tbody = document.getElementById('vendedores-tbody');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Sin datos aun - registra ventas para ver el tablero</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(v => {
            let medal = '';
            if (v.posicion === 1) medal = '<span class="medal">&#129351;</span> ';
            else if (v.posicion === 2) medal = '<span class="medal">&#129352;</span> ';
            else if (v.posicion === 3) medal = '<span class="medal">&#129353;</span> ';
            return `<tr>
                <td><strong>${v.posicion}</strong></td>
                <td>${medal}${v.vendedor}</td>
                <td class="text-right">${v.total_ventas}</td>
                <td class="text-right font-bold">${money(v.ingreso_total)}</td>
                <td class="text-right">${money(v.ingreso_iva)}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        document.getElementById('vendedores-tbody').innerHTML =
            `<tr><td colspan="5" class="loading">Error: ${e.message}</td></tr>`;
    }
}

// ===== FORMS =====
function setupForms() {
    // Catalogo form
    document.getElementById('form-catalogo').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const body = {
                codigo: document.getElementById('cat-codigo').value,
                nombre: document.getElementById('cat-nombre').value,
                marca: document.getElementById('cat-marca').value,
                modelo: document.getElementById('cat-modelo').value,
                categoria: document.getElementById('cat-categoria').value,
                precio_lista: parseFloat(document.getElementById('cat-precio-lista').value) || 0,
                precio_minimo: parseFloat(document.getElementById('cat-precio-minimo').value) || 0,
                precio_costo: parseFloat(document.getElementById('cat-precio-costo').value) || 0,
                potencia_motor: document.getElementById('cat-potencia').value,
                capacidad: document.getElementById('cat-capacidad').value,
                dimensiones: document.getElementById('cat-dimensiones').value,
                peso: document.getElementById('cat-peso').value,
                especificaciones: document.getElementById('cat-especificaciones').value,
                descripcion: document.getElementById('cat-descripcion').value
            };
            const r = await fetch(`${API}/api/equipos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const res = await r.json();
            if (res.success) {
                notify('Equipo agregado al catalogo', 'success');
                document.getElementById('form-catalogo').reset();
                loadCatalogo();
            } else {
                notify(res.error || 'Error', 'error');
            }
        } catch (err) {
            notify('Error: ' + err.message, 'error');
        }
    });

    // Inventario form
    document.getElementById('inv-equipo').addEventListener('change', (e) => {
        const id = parseInt(e.target.value);
        const preview = document.getElementById('inv-equipo-info');
        if (!id) { preview.style.display = 'none'; return; }
        const eq = equiposCatalogo.find(x => x.id === id);
        if (eq) {
            preview.style.display = 'block';
            preview.innerHTML = `
                <div class="info-row"><strong>${eq.codigo}</strong> - ${eq.nombre}</div>
                <div class="info-row"><span>Marca:</span> <strong>${eq.marca || '-'}</strong> | <span>Modelo:</span> <strong>${eq.modelo || '-'}</strong></div>
                <div class="info-row"><span>Precio Lista:</span> <strong>${money(eq.precio_lista)}</strong> | <span>Categoria:</span> <strong>${eq.categoria || '-'}</strong></div>
            `;
        }
    });

    document.getElementById('form-inventario').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const body = {
                equipo_id: parseInt(document.getElementById('inv-equipo').value),
                numero_serie: document.getElementById('inv-serie').value,
                estado: document.getElementById('inv-estado').value,
                observaciones: document.getElementById('inv-obs').value
            };
            if (!body.equipo_id) { notify('Selecciona un equipo', 'error'); return; }
            const r = await fetch(`${API}/api/inventario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const res = await r.json();
            if (res.success) {
                notify('Agregado al inventario', 'success');
                document.getElementById('form-inventario').reset();
                document.getElementById('inv-equipo-info').style.display = 'none';
                loadInventario();
                loadDashboard();
            } else {
                notify(res.error || 'Error', 'error');
            }
        } catch (err) {
            notify('Error: ' + err.message, 'error');
        }
    });

    // Venta form
    document.getElementById('venta-facturado').addEventListener('change', (e) => {
        document.getElementById('factura-num-group').style.display = e.target.value === 'true' ? 'block' : 'none';
    });

    document.getElementById('form-venta').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const invId = document.getElementById('venta-inv-id').value;
            const body = {
                vendedor: document.getElementById('venta-vendedor').value,
                cliente_nombre: document.getElementById('venta-cliente').value,
                cliente_contacto: document.getElementById('venta-contacto').value,
                cliente_rfc: document.getElementById('venta-rfc').value,
                cliente_direccion: document.getElementById('venta-direccion').value,
                precio_venta: parseFloat(document.getElementById('venta-precio').value) || 0,
                forma_pago: document.getElementById('venta-forma-pago').value,
                facturado: document.getElementById('venta-facturado').value === 'true',
                numero_factura: document.getElementById('venta-num-factura').value,
                notas: document.getElementById('venta-notas').value
            };
            const r = await fetch(`${API}/api/inventario/${invId}/vender`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const res = await r.json();
            if (res.success) {
                notify('Venta registrada exitosamente', 'success');
                closeModal('modal-venta');
                loadInventario();
                loadVentas();
                loadDashboard();
                loadVendedores();
            } else {
                notify(res.error || 'Error', 'error');
            }
        } catch (err) {
            notify('Error: ' + err.message, 'error');
        }
    });
}

// ===== MODALS =====
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ===== UTILS =====
function money(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function badgeEstado(estado) {
    const map = {
        'Disponible': 'badge-disponible',
        'Vendida': 'badge-vendida',
        'En Fabricacion': 'badge-fabricacion',
        'En Planta 1': 'badge-planta1',
        'En Planta 2': 'badge-planta2',
        'No Disponible': 'badge-no-disponible',
        'Anticipo': 'badge-anticipo',
        'En Cotizacion': 'badge-cotizacion',
        'Apartada': 'badge-apartada'
    };
    return `<span class="badge ${map[estado] || 'badge-disponible'}">${estado}</span>`;
}

function notify(msg, type) {
    const el = document.createElement('div');
    el.className = `notification ${type || 'info'}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

// ===== COTIZACIONES =====
let cotizacionesData = [];

async function loadCotizaciones() {
    try {
        const r = await fetch(`${API}/api/cotizaciones`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        cotizacionesData = Array.isArray(data) ? data : [];
        renderCotizaciones();
    } catch (e) {
        document.getElementById('cotizaciones-tbody').innerHTML =
            `<tr><td colspan="7" class="loading">Error: ${e.message}</td></tr>`;
    }
}

function renderCotizaciones() {
    const tbody = document.getElementById('cotizaciones-tbody');
    if (cotizacionesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No hay cotizaciones</td></tr>';
        return;
    }
    tbody.innerHTML = cotizacionesData.map(c => `<tr>
        <td><strong>${c.folio}</strong></td>
        <td>${formatDate(c.fecha_cotizacion)}</td>
        <td>${c.cliente_nombre}${c.cliente_empresa ? ' - ' + c.cliente_empresa : ''}</td>
        <td>${c.vendedor}</td>
        <td class="text-right font-bold">${money(c.total)}</td>
        <td>${c.incluye_iva ? '<span class="badge badge-si">Si</span>' : '<span class="badge badge-no">No</span>'}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick="verCotizacion(${c.id})">Ver</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCotizacion(${c.id})">Eliminar</button>
            </div>
        </td>
    </tr>`).join('');
}

function populateCotEquipoSelects() {
    document.querySelectorAll('.cot-equipo-select').forEach(sel => {
        const val = sel.value;
        sel.innerHTML = '<option value="">Seleccionar equipo...</option>';
        equiposCatalogo.forEach(eq => {
            const opt = document.createElement('option');
            opt.value = eq.id;
            opt.textContent = `${eq.codigo} - ${eq.nombre} (${money(eq.precio_lista)})`;
            sel.appendChild(opt);
        });
        sel.value = val;
    });
}

function onEquipoSelect(selectEl) {
    const row = selectEl.closest('.cot-item-row');
    const eqId = selectEl.value;
    if (!eqId) return;
    const eq = equiposCatalogo.find(e => e.id == eqId);
    if (eq) {
        row.querySelector('.cot-precio').value = eq.precio_lista || 0;
        row.querySelector('.cot-desc').value = `${eq.nombre}${eq.marca ? ' - ' + eq.marca : ''}${eq.modelo ? ' ' + eq.modelo : ''}`;
    }
}

function addCotItem() {
    const container = document.getElementById('cot-items-container');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'cot-item-row';
    div.dataset.index = idx;
    div.innerHTML = `
        <select class="cot-equipo-select" onchange="onEquipoSelect(this)">
            <option value="">Seleccionar equipo...</option>
        </select>
        <input type="number" class="cot-cantidad" value="1" min="1" placeholder="Cant" style="width:70px">
        <input type="number" class="cot-precio" step="0.01" min="0" placeholder="Precio unitario" style="width:150px">
        <input type="text" class="cot-desc" placeholder="Descripcion" style="flex:1">
        <button type="button" class="btn btn-sm btn-danger" onclick="removeCotItem(this)">X</button>
    `;
    container.appendChild(div);
    populateCotEquipoSelects();
}

function removeCotItem(btn) {
    const container = document.getElementById('cot-items-container');
    if (container.children.length <= 1) {
        notify('Debe haber al menos un equipo', 'error');
        return;
    }
    btn.closest('.cot-item-row').remove();
}

// Setup cotizacion form
document.addEventListener('DOMContentLoaded', () => {
    const formCot = document.getElementById('form-cotizacion');
    if (formCot) {
        formCot.addEventListener('submit', async (e) => {
            e.preventDefault();
            const items = [];
            document.querySelectorAll('.cot-item-row').forEach(row => {
                const eqId = row.querySelector('.cot-equipo-select').value;
                const cant = row.querySelector('.cot-cantidad').value || 1;
                const precio = row.querySelector('.cot-precio').value;
                const desc = row.querySelector('.cot-desc').value;
                if (precio && desc) {
                    items.push({
                        equipo_id: eqId || null,
                        cantidad: parseInt(cant),
                        precio_unitario: parseFloat(precio),
                        descripcion: desc
                    });
                }
            });
            if (items.length === 0) {
                notify('Agrega al menos un equipo con precio y descripcion', 'error');
                return;
            }
            try {
                const r = await fetch(`${API}/api/cotizaciones`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vendedor: document.getElementById('cot-vendedor').value,
                        cliente_nombre: document.getElementById('cot-cliente').value,
                        cliente_empresa: document.getElementById('cot-empresa').value,
                        cliente_telefono: document.getElementById('cot-telefono').value,
                        cliente_email: document.getElementById('cot-email').value,
                        cliente_direccion: document.getElementById('cot-direccion').value,
                        incluye_iva: document.getElementById('cot-iva').value === 'true',
                        notas: document.getElementById('cot-notas').value,
                        items: items
                    })
                });
                const data = await r.json();
                if (data.success) {
                    notify(`Cotizacion ${data.folio} creada`, 'success');
                    formCot.reset();
                    loadCotizaciones();
                    verCotizacion(data.id);
                } else {
                    notify(data.error || 'Error al crear cotizacion', 'error');
                }
            } catch (err) {
                notify('Error: ' + err.message, 'error');
            }
        });
    }
});

async function verCotizacion(id) {
    try {
        const r = await fetch(`${API}/api/cotizaciones/${id}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const cot = await r.json();

        const fechaCot = formatDate(cot.fecha_cotizacion);
        const vigencia = new Date(cot.fecha_cotizacion);
        vigencia.setDate(vigencia.getDate() + (cot.vigencia_dias || 30));
        const fechaVig = formatDate(vigencia.toISOString());

        let itemsHtml = cot.items.map((it, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${it.descripcion}</td>
                <td style="text-align:center">${it.cantidad}</td>
                <td style="text-align:right">${money(it.precio_unitario)}</td>
                <td style="text-align:right">${money(it.total_linea)}</td>
            </tr>
        `).join('');

        document.getElementById('cotizacion-print-area').innerHTML = `
            <div class="cot-pdf" id="cot-pdf-content">
                <div class="cot-pdf-header">
                    <div class="cot-pdf-logo">
                        <h1>DURTRON</h1>
                        <span>Innovacion Industrial</span>
                    </div>
                    <div class="cot-pdf-folio">
                        <div class="folio-number">${cot.folio}</div>
                        <div>Fecha: ${fechaCot}</div>
                        <div>Vigencia: ${fechaVig}</div>
                    </div>
                </div>

                <div class="cot-pdf-divider"></div>

                <div class="cot-pdf-info-grid">
                    <div class="cot-pdf-info-block">
                        <h4>Datos del Cliente</h4>
                        <p><strong>${cot.cliente_nombre}</strong></p>
                        ${cot.cliente_empresa ? `<p>${cot.cliente_empresa}</p>` : ''}
                        ${cot.cliente_telefono ? `<p>Tel: ${cot.cliente_telefono}</p>` : ''}
                        ${cot.cliente_email ? `<p>${cot.cliente_email}</p>` : ''}
                        ${cot.cliente_direccion ? `<p>${cot.cliente_direccion}</p>` : ''}
                    </div>
                    <div class="cot-pdf-info-block">
                        <h4>Datos de DURTRON</h4>
                        <p><strong>DURTRON - Innovacion Industrial</strong></p>
                        <p>Av. del Sol #329, Durango, Dgo.</p>
                        <p>Tel: 618 134 1056</p>
                        <p>Atencion: ${cot.vendedor}</p>
                    </div>
                </div>

                <table class="cot-pdf-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Descripcion</th>
                            <th style="width:70px">Cant.</th>
                            <th style="width:130px">P. Unitario</th>
                            <th style="width:130px">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <div class="cot-pdf-totals">
                    <div class="cot-total-row">
                        <span>Subtotal:</span>
                        <strong>${money(cot.subtotal)}</strong>
                    </div>
                    ${cot.incluye_iva ? `
                    <div class="cot-total-row">
                        <span>IVA (16%):</span>
                        <strong>${money(cot.iva)}</strong>
                    </div>` : ''}
                    <div class="cot-total-row cot-total-final">
                        <span>TOTAL:</span>
                        <strong>${money(cot.total)}</strong>
                    </div>
                </div>

                ${cot.notas ? `<div class="cot-pdf-notas"><h4>Notas</h4><p>${cot.notas}</p></div>` : ''}

                <div class="cot-pdf-terminos">
                    <h4>TERMINOS Y CONDICIONES DE VENTA, GARANTIA Y SERVICIO</h4>
                    <p style="margin-bottom:0.5rem;font-size:0.72rem"><strong>Durtron Fabricacion Industrial</strong> — El cliente reconoce y acepta que al realizar cualquier anticipo, firma de pedido, cotizacion aceptada, comprobante de pago o aprobacion electronica, acepta totalmente los presentes terminos y condiciones.</p>
                    <ul>
                        <li><strong>Precios y Validez:</strong> Los precios estan sujetos a cambio sin previo aviso. Esta cotizacion tiene una validez de ${cot.vigencia_dias || 7} dias naturales a partir de su emision.</li>
                        <li><strong>Anticipo:</strong> La fabricacion inicia con el anticipo del 60% del valor total del pedido. El tiempo de entrega se cuenta a partir de la confirmacion de recepcion del anticipo.</li>
                        <li><strong>No Devoluciones:</strong> No se realizan devoluciones de anticipos ni cancelaciones del pedido, bajo ninguna circunstancia.</li>
                        <li><strong>Liquidacion:</strong> Una vez concluida la fabricacion, el cliente tiene 10 dias naturales para liquidar. Despues se aplica cargo de $300 MXN diarios por almacenamiento.</li>
                        <li><strong>Abandono:</strong> Si despues de 90 dias habiles el cliente no liquida ni retira el equipo, se considerara abandonado y DURTRON podra disponer del mismo.</li>
                        <li><strong>Tiempos de Entrega:</strong> Las fechas son estimadas, sujetas a disponibilidad de materiales, logistica y causas de fuerza mayor.</li>
                        <li><strong>Garantia:</strong> 30 dias naturales desde la fecha de entrega, cubriendo defectos de fabricacion y materiales. No cubre: mal uso, golpes, falta de mantenimiento, intervenciones no autorizadas o desgaste normal.</li>
                        <li><strong>Transporte:</strong> El transporte y sus costos son responsabilidad del cliente. El riesgo se transfiere al entregar al transportista.</li>
                        <li><strong>Propiedad Intelectual:</strong> Todos los disenos y planos son propiedad exclusiva de DURTRON. Queda prohibida su reproduccion o ingenieria inversa.</li>
                        <li><strong>Aceptacion:</strong> El pago de anticipo, firma de pedido o aceptacion electronica implica la aceptacion total de estos terminos.</li>
                    </ul>
                </div>

                <div class="cot-pdf-footer">
                    <p>DURTRON - Innovacion Industrial | Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056</p>
                </div>
            </div>
        `;

        openModal('modal-cotizacion');
    } catch (e) {
        notify('Error al cargar cotizacion: ' + e.message, 'error');
    }
}

function imprimirCotizacion() {
    const content = document.getElementById('cot-pdf-content');
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head>
        <title>Cotizacion DURTRON</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Inter', sans-serif; padding: 0; color: #333; }
            .cot-pdf { max-width: 800px; margin: 0 auto; padding: 2rem; }
            .cot-pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
            .cot-pdf-logo h1 { font-size: 2.2rem; font-weight: 800; color: #D2152B; letter-spacing: 2px; }
            .cot-pdf-logo span { color: #F47427; font-size: 0.85rem; font-weight: 600; }
            .cot-pdf-folio { text-align: right; font-size: 0.85rem; color: #555; }
            .folio-number { font-size: 1.2rem; font-weight: 700; color: #1a1a2e; margin-bottom: 0.3rem; }
            .cot-pdf-divider { height: 4px; background: linear-gradient(90deg, #D2152B, #F47427); border-radius: 2px; margin-bottom: 1.5rem; }
            .cot-pdf-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1.5rem; }
            .cot-pdf-info-block h4 { color: #D2152B; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
            .cot-pdf-info-block p { font-size: 0.85rem; line-height: 1.6; }
            .cot-pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
            .cot-pdf-table th { background: #1a1a2e; color: white; padding: 0.6rem 0.8rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
            .cot-pdf-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #eee; font-size: 0.85rem; }
            .cot-pdf-table tr:nth-child(even) { background: #f8f9fa; }
            .cot-pdf-totals { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 1.5rem; }
            .cot-total-row { display: flex; justify-content: space-between; width: 280px; padding: 0.4rem 0; font-size: 0.9rem; border-bottom: 1px solid #eee; }
            .cot-total-final { border-top: 2px solid #1a1a2e; border-bottom: none; padding-top: 0.6rem; font-size: 1.1rem; color: #D2152B; }
            .cot-pdf-notas { background: #fffbeb; border-left: 3px solid #F47427; padding: 0.8rem 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; border-radius: 0 6px 6px 0; }
            .cot-pdf-notas h4 { color: #F47427; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.3rem; }
            .cot-pdf-terminos { background: #f8f9fa; border-radius: 8px; padding: 1rem 1.2rem; margin-bottom: 1.5rem; font-size: 0.78rem; color: #555; }
            .cot-pdf-terminos h4 { color: #333; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
            .cot-pdf-terminos ul { padding-left: 1.2rem; }
            .cot-pdf-terminos li { margin-bottom: 0.3rem; line-height: 1.5; }
            .cot-pdf-footer { text-align: center; font-size: 0.75rem; color: #888; padding-top: 1rem; border-top: 1px solid #eee; }
            @media print { body { padding: 0; } .cot-pdf { padding: 1rem; } }
        </style>
        </head><body>
        ${content.outerHTML}
        <script>setTimeout(()=>{window.print();},500)<\/script>
        </body></html>
    `);
    win.document.close();
}

async function deleteCotizacion(id) {
    if (!confirm('Eliminar esta cotizacion?')) return;
    try {
        const r = await fetch(`${API}/api/cotizaciones/${id}`, { method: 'DELETE' });
        const data = await r.json();
        if (data.success) {
            notify('Cotizacion eliminada', 'success');
            loadCotizaciones();
        } else {
            notify(data.error || 'Error al eliminar', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}
