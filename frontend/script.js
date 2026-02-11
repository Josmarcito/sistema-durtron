// ===== CONFIGURACION =====
const API = window.location.origin;
let equiposCatalogo = [];
let inventarioItems = [];
let ventasData = [];
let configData = {};
let dashboardData = {};
let periodoActual = 'mensual';

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
            </div>
        </td>
    </tr>`).join('');
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
