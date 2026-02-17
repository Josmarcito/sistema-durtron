// ===== CONFIGURACION =====
const API = window.location.origin;
let equiposCatalogo = [];
let inventarioItems = [];
let ventasData = [];
let configData = {};
let dashboardData = {};
let periodoActual = 'mensual';
let ingresosChart = null;

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
const sectionTitles = {
    dashboard: 'Dashboard',
    catalogo: 'Catalogo de Equipos',
    inventario: 'Inventario',
    ventas: 'Registro de Ventas',
    vendedores: 'Vendedores',
    cotizaciones: 'Cotizaciones',
    proveedores: 'Proveedores',
    requisiciones: 'Requisiciones'
};

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function setupNav() {
    document.querySelectorAll('.nav-btn[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = btn.dataset.section;
            if (!s) return;
            document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(s).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Update topbar title
            const titleEl = document.getElementById('topbar-section-title');
            if (titleEl) titleEl.textContent = sectionTitles[s] || s;
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
            if (s === 'vendedores') loadVendedores();
            if (s === 'ventas') loadVentas();
            if (s === 'dashboard') loadDashboard();
            if (s === 'cotizaciones') { loadCotizaciones(); populateCotEquipoSelects(); }
            if (s === 'proveedores') loadProveedores();
            if (s === 'requisiciones') { loadRequisiciones(); populateReqProveedorSelect(); populateReqEquipoSelect(); }
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
        document.getElementById('stat-utilidad').textContent = money(d.utilidad_bruta_anio);
        document.getElementById('stat-anticipos').textContent = money(d.anticipos_anio);
        document.getElementById('stat-saldo').textContent = money(d.saldo_pendiente_anio);
        document.getElementById('stat-total-ventas').textContent = d.ventas_anio || 0;

        renderPieChart(d);
        renderPeriodo();
    } catch (e) {
        console.error('Error dashboard:', e);
        // Fail silently for dashboard to avoid annoying alerts on connection issues
        // notify('Error al cargar dashboard: ' + e.message, 'error');
        document.getElementById('stat-catalogo').textContent = '-';
        document.getElementById('stat-inventario').textContent = '-';
        document.getElementById('stat-ingreso-neto').textContent = '$0.00';
        document.getElementById('stat-ingreso-iva').textContent = '$0.00';
        document.getElementById('stat-utilidad').textContent = '$0.00';
        document.getElementById('stat-anticipos').textContent = '$0.00';
        document.getElementById('stat-saldo').textContent = '$0.00';
        document.getElementById('stat-total-ventas').textContent = '0';
    }
}

function renderPieChart(d) {
    const ctx = document.getElementById('chart-ingresos');
    if (!ctx) return;

    if (ingresosChart) {
        ingresosChart.destroy();
    }

    const neto = d.ingreso_neto_anio || 0;
    const iva = (d.ingreso_iva_anio || 0) - neto;  // Solo la parte del IVA
    const utilidad = d.utilidad_bruta_anio || 0;

    ingresosChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingreso Neto', 'IVA (16%)', 'Utilidad Bruta'],
            datasets: [{
                data: [neto, iva, utilidad],
                backgroundColor: [
                    'rgba(231, 76, 60, 0.85)',
                    'rgba(52, 152, 219, 0.85)',
                    'rgba(46, 204, 113, 0.85)'
                ],
                borderColor: [
                    'rgba(231, 76, 60, 1)',
                    'rgba(52, 152, 219, 1)',
                    'rgba(46, 204, 113, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                        font: { size: 13, family: 'Inter' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ctx.label + ': ' + money(ctx.raw);
                        }
                    }
                }
            },
            cutout: '55%'
        }
    });
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
        '</th><th class="text-right">Ventas</th><th class="text-right">Ingreso Neto</th><th class="text-right">Ingreso + IVA</th><th class="text-right">Utilidad Bruta</th></tr>';

    const data = periodoActual === 'mensual' ? dashboardData.mensual : dashboardData.trimestral;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Sin ventas registradas</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(d => {
        const label = periodoActual === 'mensual' ? d.nombre : `Q${d.trimestre}`;
        return `<tr>
            <td><strong>${label}</strong></td>
            <td class="text-right">${d.total_ventas}</td>
            <td class="text-right font-bold">${money(d.ingreso_neto)}</td>
            <td class="text-right">${money(d.ingreso_iva)}</td>
            <td class="text-right" style="color:#27ae60;font-weight:600;">${money(d.utilidad_bruta)}</td>
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
        populateReqEquipoSelect();
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
                <button class="btn btn-sm btn-primary" onclick="editarEquipo(${eq.id})">Editar</button>
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

// ===== EDITAR EQUIPO Y PARTES TECNICAS =====
let editingEquipoId = null;

async function editarEquipo(eid) {
    editingEquipoId = eid;
    try {
        const res = await fetch(`${API}/api/equipos/${eid}`);
        const eq = await res.json();
        if (eq.error) { notify(eq.error, 'error'); return; }

        document.getElementById('edit-eq-id').value = eq.id;
        document.getElementById('edit-eq-codigo').value = eq.codigo || '';
        document.getElementById('edit-eq-nombre').value = eq.nombre || '';
        document.getElementById('edit-eq-marca').value = eq.marca || '';
        document.getElementById('edit-eq-modelo').value = eq.modelo || '';
        document.getElementById('edit-eq-precio-lista').value = eq.precio_lista || 0;
        document.getElementById('edit-eq-precio-minimo').value = eq.precio_minimo || 0;
        document.getElementById('edit-eq-precio-costo').value = eq.precio_costo || 0;
        document.getElementById('edit-eq-potencia').value = eq.potencia_motor || '';
        document.getElementById('edit-eq-capacidad').value = eq.capacidad || '';
        document.getElementById('edit-eq-dimensiones').value = eq.dimensiones || '';
        document.getElementById('edit-eq-peso').value = eq.peso || '';
        document.getElementById('edit-eq-especificaciones').value = eq.especificaciones || '';
        document.getElementById('edit-eq-descripcion').value = eq.descripcion || '';

        // Set categoria
        const catSel = document.getElementById('edit-eq-categoria');
        catSel.innerHTML = '<option value="">Seleccionar...</option>';
        const cats = [...new Set(equiposCatalogo.map(e => e.categoria).filter(Boolean))];
        cats.forEach(c => {
            catSel.innerHTML += `<option value="${c}" ${c === eq.categoria ? 'selected' : ''}>${c}</option>`;
        });

        // Populate provider dropdown for parts
        await populateParteProveedorSelect();

        // Load partes
        await cargarPartesEquipo(eid);
        openModal('modal-editar-equipo');
    } catch (e) {
        notify('Error cargando equipo: ' + e.message, 'error');
    }
}

async function populateParteProveedorSelect() {
    const sel = document.getElementById('nueva-parte-proveedor');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Sin asignar --</option>';
    try {
        const res = await fetch(`${API}/api/proveedores`);
        const provs = await res.json();
        (Array.isArray(provs) ? provs : []).forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.razon_social}</option>`;
        });
    } catch (e) {
        console.error('Error cargando proveedores para partes:', e);
    }
}

async function cargarPartesEquipo(eid) {
    try {
        const res = await fetch(`${API}/api/equipos/${eid}/partes`);
        const partes = await res.json();
        renderPartesLista(partes);
    } catch (e) {
        document.getElementById('edit-eq-partes-list').innerHTML = '<p style="color:#888;">Error cargando partes.</p>';
    }
}

function renderPartesLista(partes) {
    const container = document.getElementById('edit-eq-partes-list');
    if (!partes || partes.length === 0) {
        container.innerHTML = '<p style="color:#888; font-style:italic;">No hay partes registradas para este equipo.</p>';
        return;
    }
    container.innerHTML = `
        <table style="width:100%; font-size:0.9rem;">
            <thead><tr>
                <th style="text-align:left;">Parte</th>
                <th style="text-align:left;">Descripcion</th>
                <th>Cant</th>
                <th>Unidad</th>
                <th style="text-align:left;">Proveedor</th>
                <th>Accion</th>
            </tr></thead>
            <tbody>
                ${partes.map(p => `<tr>
                    <td>${p.nombre_parte}</td>
                    <td>${p.descripcion || '-'}</td>
                    <td style="text-align:center;">${p.cantidad}</td>
                    <td style="text-align:center;">${p.unidad}</td>
                    <td>${p.proveedor_nombre || '<span style="color:#888;">Sin asignar</span>'}</td>
                    <td style="text-align:center;"><button class="btn btn-sm btn-danger" onclick="eliminarParteEquipo(${p.id})">X</button></td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
}

async function agregarParteEquipo() {
    const nombre = document.getElementById('nueva-parte-nombre').value.trim();
    if (!nombre) { notify('Ingresa el nombre de la parte', 'error'); return; }
    const provSel = document.getElementById('nueva-parte-proveedor');
    const data = {
        nombre_parte: nombre,
        descripcion: document.getElementById('nueva-parte-desc').value.trim(),
        cantidad: parseInt(document.getElementById('nueva-parte-cant').value) || 1,
        unidad: document.getElementById('nueva-parte-unidad').value.trim() || 'pza',
        proveedor_id: provSel ? (provSel.value || null) : null
    };
    try {
        const res = await fetch(`${API}/api/equipos/${editingEquipoId}/partes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            notify('Parte agregada', 'success');
            document.getElementById('nueva-parte-nombre').value = '';
            document.getElementById('nueva-parte-desc').value = '';
            document.getElementById('nueva-parte-cant').value = '1';
            document.getElementById('nueva-parte-unidad').value = 'pza';
            if (provSel) provSel.value = '';
            await cargarPartesEquipo(editingEquipoId);
        } else {
            notify(result.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function eliminarParteEquipo(pid) {
    if (!confirm('Eliminar esta parte?')) return;
    try {
        const res = await fetch(`${API}/api/equipos/partes/${pid}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            notify('Parte eliminada', 'success');
            await cargarPartesEquipo(editingEquipoId);
        } else {
            notify(result.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function guardarEdicionEquipo() {
    const eid = document.getElementById('edit-eq-id').value;
    const body = {
        codigo: document.getElementById('edit-eq-codigo').value.trim(),
        nombre: document.getElementById('edit-eq-nombre').value.trim(),
        marca: document.getElementById('edit-eq-marca').value.trim(),
        modelo: document.getElementById('edit-eq-modelo').value.trim(),
        categoria: document.getElementById('edit-eq-categoria').value,
        precio_lista: parseFloat(document.getElementById('edit-eq-precio-lista').value) || 0,
        precio_minimo: parseFloat(document.getElementById('edit-eq-precio-minimo').value) || 0,
        precio_costo: parseFloat(document.getElementById('edit-eq-precio-costo').value) || 0,
        potencia_motor: document.getElementById('edit-eq-potencia').value.trim(),
        capacidad: document.getElementById('edit-eq-capacidad').value.trim(),
        dimensiones: document.getElementById('edit-eq-dimensiones').value.trim(),
        peso: document.getElementById('edit-eq-peso').value.trim(),
        especificaciones: document.getElementById('edit-eq-especificaciones').value.trim(),
        descripcion: document.getElementById('edit-eq-descripcion').value.trim()
    };
    if (!body.codigo || !body.nombre) {
        notify('Codigo y Nombre son obligatorios', 'error'); return;
    }
    try {
        const res = await fetch(`${API}/api/equipos/${eid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        if (result.success) {
            notify('Equipo actualizado', 'success');
            closeModal('modal-editar-equipo');
            loadCatalogo();
        } else {
            notify(result.error || 'Error', 'error');
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

async function descargarEtiqueta(id) {
    try {
        notify('Generando etiqueta...', 'success');
        const r = await fetch(`${API}/api/inventario/${id}/etiqueta`);
        if (!r.ok) throw new Error(`Error ${r.status}`);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiqueta_${id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('Etiqueta descargada', 'success');
    } catch (e) {
        notify('Error generando etiqueta: ' + e.message, 'error');
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
        // Detalle del equipo
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
            <div style="margin-top:1rem;text-align:center;">
                <button class="btn btn-primary" onclick="descargarEtiqueta(${id})">Generar Etiqueta PNG</button>
            </div>
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
        tbody.innerHTML = '<tr><td colspan="9" class="loading">No hay ventas registradas</td></tr>';
        return;
    }
    tbody.innerHTML = ventasData.map(v => {
        const anticipo = v.tiene_anticipo
            ? `<span class="badge badge-si">${money(v.anticipo_monto)}</span>`
            : '<span class="badge badge-no">No</span>';
        const saldo = v.tiene_anticipo ? money(v.precio_venta - (v.anticipo_monto || 0)) : '-';
        return `<tr>
        <td>${formatDate(v.fecha_venta)}</td>
        <td><strong>${v.equipo_codigo || ''}</strong> ${v.equipo_nombre || ''}</td>
        <td>${v.cliente_nombre}</td>
        <td>${v.vendedor}</td>
        <td class="text-right font-bold">${money(v.precio_venta)}</td>
        <td>${v.forma_pago || '-'}</td>
        <td>${v.facturado ? '<span class="badge badge-si">Si</span>' : '<span class="badge badge-no">No</span>'}</td>
        <td>${anticipo}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteVenta(${v.id})">Eliminar</button></td>
    </tr>`;
    }).join('');
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

    // Venta form: facturado toggle
    document.getElementById('venta-facturado').addEventListener('change', (e) => {
        document.getElementById('factura-num-group').style.display = e.target.value === 'true' ? 'block' : 'none';
    });

    // Venta form: anticipo toggle
    document.getElementById('venta-anticipo').addEventListener('change', (e) => {
        const show = e.target.value === 'true';
        const fields = document.getElementById('anticipo-fields');
        fields.style.display = show ? 'flex' : 'none';
        if (!show) {
            document.getElementById('venta-anticipo-monto').value = '';
            document.getElementById('venta-anticipo-fecha').value = '';
        }
    });

    document.getElementById('form-venta').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const invId = document.getElementById('venta-inv-id').value;
            const precioVenta = parseFloat(document.getElementById('venta-precio').value) || 0;
            const tieneAnticipo = document.getElementById('venta-anticipo').value === 'true';
            let anticipoMonto = 0;
            let anticipoFecha = '';

            if (tieneAnticipo) {
                anticipoMonto = parseFloat(document.getElementById('venta-anticipo-monto').value) || 0;
                if (anticipoMonto <= 0) {
                    notify('Ingresa el monto del anticipo', 'error');
                    return;
                }
                if (anticipoMonto > precioVenta) {
                    notify('El anticipo no puede ser mayor al precio de venta', 'error');
                    return;
                }
                anticipoFecha = document.getElementById('venta-anticipo-fecha').value || '';
            }

            const body = {
                vendedor: document.getElementById('venta-vendedor').value,
                cliente_nombre: document.getElementById('venta-cliente').value,
                cliente_contacto: document.getElementById('venta-contacto').value,
                cliente_rfc: document.getElementById('venta-rfc').value,
                cliente_direccion: document.getElementById('venta-direccion').value,
                precio_venta: precioVenta,
                forma_pago: document.getElementById('venta-forma-pago').value,
                facturado: document.getElementById('venta-facturado').value === 'true',
                numero_factura: document.getElementById('venta-num-factura').value,
                tiene_anticipo: tieneAnticipo,
                anticipo_monto: anticipoMonto,
                anticipo_fecha: anticipoFecha || null,
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

// ==================== PROVEEDORES ====================
let proveedoresData = [];

async function loadProveedores() {
    try {
        const res = await fetch(`${API}/api/proveedores`);
        proveedoresData = await res.json();
        renderProveedores();
    } catch (e) {
        notify('Error al cargar proveedores: ' + e.message, 'error');
    }
}

function renderProveedores() {
    const tbody = document.getElementById('tabla-proveedores');
    if (!proveedoresData.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No hay proveedores registrados</td></tr>';
        return;
    }
    tbody.innerHTML = proveedoresData.map(p => `
        <tr>
            <td><strong>${p.razon_social}</strong></td>
            <td>${p.contacto_nombre || '-'}</td>
            <td>${p.correo || '-'}</td>
            <td>${p.telefono || '-'}</td>
            <td>${p.whatsapp || '-'}</td>
            <td><span class="badge badge-${p.medio_preferido === 'WhatsApp' ? 'si' : 'cotizacion'}">${p.medio_preferido}</span></td>
            <td class="action-buttons">
                <button class="btn btn-danger btn-sm" onclick="deleteProveedor(${p.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

// Setup form: Proveedor
document.addEventListener('DOMContentLoaded', () => {
    const formProv = document.getElementById('form-proveedor');
    if (formProv) {
        formProv.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                razon_social: document.getElementById('prov-razon').value.trim(),
                contacto_nombre: document.getElementById('prov-contacto').value.trim(),
                correo: document.getElementById('prov-correo').value.trim(),
                telefono: document.getElementById('prov-telefono').value.trim(),
                whatsapp: document.getElementById('prov-whatsapp').value.trim(),
                medio_preferido: document.getElementById('prov-medio').value,
                notas: document.getElementById('prov-notas').value.trim()
            };
            if (!body.razon_social) { notify('Razon social es obligatoria', 'error'); return; }
            try {
                const res = await fetch(`${API}/api/proveedores`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) {
                    notify('Proveedor registrado', 'success');
                    formProv.reset();
                    loadProveedores();
                } else {
                    notify(data.error || 'Error', 'error');
                }
            } catch (e) {
                notify('Error: ' + e.message, 'error');
            }
        });
    }

});


async function deleteProveedor(pid) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
        const res = await fetch(`${API}/api/proveedores/${pid}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            notify('Proveedor eliminado', 'success');
            loadProveedores();
        } else {
            notify(data.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ==================== REQUISICIONES ====================
let requisicionesData = [];
let AVAILABLE_PROVIDERS = []; // Store providers for dropdowns

async function loadProveedores() {
    try {
        const res = await fetch(`${API}/api/proveedores`);
        const data = await res.json();
        AVAILABLE_PROVIDERS = data; // Update global
        proveedoresData = data;
        renderProveedores();
        populateReqProveedorSelect(); // Populate main select
        populateReqEquipoSelect(); // Populate equipo select
    } catch (e) {
        notify('Error al cargar proveedores: ' + e.message, 'error');
    }
}

async function loadRequisiciones() {
    try {
        const res = await fetch(`${API}/api/requisiciones`);
        requisicionesData = await res.json();
        renderRequisiciones();
    } catch (e) {
        notify('Error al cargar requisiciones: ' + e.message, 'error');
    }
}

function renderRequisiciones() {
    const tbody = document.getElementById('tabla-requisiciones');
    if (!requisicionesData.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay requisiciones</td></tr>';
        return;
    }
    const estadoBadge = {
        'Pendiente': 'badge-planta1',
        'Enviada': 'badge-cotizacion',
        'Recibida': 'badge-si',
        'Recibida Parcial': 'badge-warning',
        'Cancelada': 'badge-no'
    };
    tbody.innerHTML = requisicionesData.map(r => {
        const fecha = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleDateString('es-MX') : '-';
        return `
        <tr>
            <td><strong>${r.folio}</strong></td>
            <td>${r.no_control || '-'}</td>
            <td>${r.equipo_nombre || '-'}</td>
            <td><span class="badge ${estadoBadge[r.estado] || 'badge-planta1'}">${r.estado}</span></td>
            <td>${fecha}</td>
            <td class="action-buttons">
                <button class="btn btn-primary btn-sm" onclick="verRequisicion(${r.id})">Ver / Gestionar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteRequisicion(${r.id})">&#10006;</button>
            </td>
        </tr>`;
    }).join('');
}

let reqItemCounter = 0;
function addReqItem() {
    reqItemCounter++;
    const container = document.getElementById('req-items-container');
    const row = document.createElement('div');
    row.className = 'req-item-row';
    row.style.cssText = "display:grid; grid-template-columns: 0.3fr 2fr 1.2fr 1.5fr 0.5fr 1fr 0.3fr 1fr 1fr 40px; gap:5px; margin-bottom:5px; align-items:center;";

    row.innerHTML = `
        <span style="text-align:center;font-weight:bold;color:#aaa;">${reqItemCounter}</span>
        <input type="text" placeholder="Componente" class="req-comp" style="width:100%" oninput="checkAutoProvider(this)">
        <input type="text" list="prov-list-${Date.now()}" placeholder="Proveedor" class="req-prov">
        <datalist id="prov-list-${Date.now()}">
             ${AVAILABLE_PROVIDERS.map(p => `<option value="${p.razon_social}">`).join('')}
        </datalist>
        <input type="text" placeholder="Comentarios" class="req-coment">
        <input type="number" placeholder="#" class="req-cant" value="1" min="0" step="0.1" oninput="updateReqRowTotal(this)">
        <!-- Unidad removed as requested -->
        <input type="number" placeholder="$" class="req-precio" value="0" min="0" step="0.01" oninput="updateReqRowTotal(this)">
        <div style="text-align:center"><input type="checkbox" class="req-iva" onchange="updateReqRowTotal(this)"></div>
        <input type="text" class="req-subtotal" readonly value="$0.00" style="background:#eee; color:#333; text-align:right;">
        <input type="text" class="req-total" readonly value="$0.00" style="background:#eee; color:#333; font-weight:bold; text-align:right;">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); updateReqGrandTotal()">&#10006;</button>
    `;
    container.appendChild(row);
    // Inherit Main Provider if selected
    const mainProv = document.getElementById('req-proveedor');
    if (mainProv && mainProv.value) {
        const provName = mainProv.options[mainProv.selectedIndex].text;
        if (provName && provName !== '-- Varios / Sin definir --') {
            row.querySelector('.req-prov').value = provName;
        }
    }
}

function checkAutoProvider(input) {
    const row = input.closest('.req-item-row');
    const provInput = row.querySelector('.req-prov');
    // Once user manually sets provider, maybe don't overwrite? 
    // But user asked for "siempre se piden con...". Let's overwrite if empty or if matching rule found.
    // For now, only if empty to avoid annoying overrides.
    if (provInput.value.trim() !== '') return;

    const val = input.value.toLowerCase();

    // Rules
    if (val.includes('acero') || val.includes('4140') || val.includes('1045') || val.includes('estirad') || val.includes('lamina')) {
        provInput.value = 'Levinson'; // Assuming exact name
    } else if (val.includes('polea') || val.includes('banda')) {
        provInput.value = 'Maposa';
    } else if (val.includes('chumacera') || val.includes('rodamiento')) {
        provInput.value = 'Herver';
    } else if (val.includes('motor')) {
        provInput.value = 'HAB';
    }
}

function updateReqRowTotal(el) {
    const row = el.closest('.req-item-row');
    const cant = parseFloat(row.querySelector('.req-cant').value) || 0;
    const precio = parseFloat(row.querySelector('.req-precio').value) || 0;
    const hasIva = row.querySelector('.req-iva').checked;

    const subtotal = cant * precio;
    const total = hasIva ? subtotal * 1.16 : subtotal;

    row.querySelector('.req-subtotal').value = `$${subtotal.toFixed(2)}`;
    row.querySelector('.req-total').value = `$${total.toFixed(2)}`;
    updateReqGrandTotal();
}

function updateReqGrandTotal() {
    let grandTotal = 0;
    document.querySelectorAll('#req-items-container .req-item-row').forEach(row => {
        const cant = parseFloat(row.querySelector('.req-cant').value) || 0;
        const precio = parseFloat(row.querySelector('.req-precio').value) || 0;
        const hasIva = row.querySelector('.req-iva').checked;
        grandTotal += (cant * precio) * (hasIva ? 1.16 : 1.0);
    });
    const el = document.getElementById('req-total-general');
    if (el) el.textContent = `$${grandTotal.toFixed(2)}`;
}

formReq.addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('.req-item-row').forEach(row => {
        const comp = row.querySelector('.req-comp').value.trim();
        if (comp) {
            items.push({
                componente: comp,
                proveedor_nombre: row.querySelector('.req-prov').value.trim(),
                comentario: row.querySelector('.req-coment').value.trim(),
                cantidad: parseFloat(row.querySelector('.req-cant').value) || 0,
                unidad: 'pza', // Default since column removed
                precio_unitario: parseFloat(row.querySelector('.req-precio').value) || 0,
                tiene_iva: row.querySelector('.req-iva').checked
            });
        }
    });

    if (items.length === 0) { notify('Agrega al menos un componente', 'error'); return; }

    const mainProvId = document.getElementById('req-proveedor').value;

    const body = {
        inventario_id: null,
        equipo_nombre: document.getElementById('req-equipo').selectedOptions[0]?.text || '',
        no_control: document.getElementById('req-no-control').value.trim(),
        area: document.getElementById('req-area').value.trim(),
        proveedor_id: mainProvId || null,
        notas: document.getElementById('req-notas').value.trim(),
        emitido_por: document.getElementById('req-emitido').value.trim(),
        aprobado_por: document.getElementById('req-aprobado').value.trim(),
        revisado_por: document.getElementById('req-revisado').value.trim(),
        requerido_por: document.getElementById('req-requerido').value.trim(),
        items
    };

    try {
        const res = await fetch(`${API}/api/requisiciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            notify(`Requisicion ${data.folio} creada`, 'success');
            closeModal('modal-requisicion');
            formReq.reset();
            document.getElementById('req-items-container').innerHTML = '';
            reqItemCounter = 0;
            loadRequisiciones();
        } else {
            notify(data.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
});


function populateReqProveedorSelect() {
    const sel = document.getElementById('req-proveedor');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Varios / Sin definir --</option>';
    AVAILABLE_PROVIDERS.forEach(p => {
        sel.innerHTML += `<option value="${p.id}">${p.razon_social}</option>`;
    });
}

function populateReqEquipoSelect() {
    const sel = document.getElementById('req-equipo');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Seleccionar equipo del catalogo --</option>';
    equiposCatalogo.forEach(eq => {
        sel.innerHTML += `<option value="${eq.id}">${eq.codigo} - ${eq.nombre}</option>`;
    });
}

async function cargarPartesRequisicion(equipoId) {
    if (!equipoId) return;
    try {
        const res = await fetch(`${API}/api/equipos/${equipoId}/partes`);
        const partes = await res.json();
        if (!partes || partes.length === 0) return;

        // Clear existing items
        document.getElementById('req-items-container').innerHTML = '';
        reqItemCounter = 0;

        // Add each part as a requisition item row
        partes.forEach(parte => {
            addReqItem();
            const rows = document.querySelectorAll('.req-item-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                const compInput = lastRow.querySelector('.req-comp');
                const cantInput = lastRow.querySelector('.req-cant');
                // const unidadInput = lastRow.querySelector('.req-unidad'); // Removed
                const comentInput = lastRow.querySelector('.req-coment');
                const provSelect = lastRow.querySelector('.req-prov');

                if (compInput) {
                    compInput.value = parte.nombre_parte;
                    // Trigger auto-provider logic
                    checkAutoProvider(compInput);
                }
                if (cantInput) cantInput.value = parte.cantidad || 1;
                // if (unidadInput) unidadInput.value = parte.unidad || 'pza';

                // User requested NOT to pre-fill comments from description
                // keeping it empty
                if (comentInput) comentInput.value = '';

                // Auto-fill provider if available (overrides auto-logic if explicit)
                if (provSelect && parte.proveedor_id) {
                    // ... existing logic ...
                    const opts = Array.from(provSelect.list.options); // Input is text with list, options are in list
                    // Actually, req-prov is input text, not select. The list is dynamic.
                    // But we can just set the value if we have the name
                    if (parte.proveedor_nombre) {
                        provSelect.value = parte.proveedor_nombre;
                    }
                } else if (provSelect && parte.proveedor_nombre) {
                    provSelect.value = parte.proveedor_nombre;
                }
            }
        });
        updateReqGrandTotal();
        notify(`${partes.length} partes cargadas del catalogo`, 'success');
    } catch (e) {
        console.error('Error cargando partes:', e);
    }
}

async function verRequisicion(rid) {
    openModal('modal-req-detalle');
    const body = document.getElementById('req-detalle-body');
    body.innerHTML = '<p class="loading">Cargando...</p>';
    try {
        const res = await fetch(`${API}/api/requisiciones/${rid}`);
        const r = await res.json();
        document.getElementById('req-detalle-titulo').textContent = `Requisicion ${r.folio}`;

        // Calculate totals
        let totalGeneral = 0;
        const itemsByProv = {};

        (r.items || []).forEach(it => {
            const sub = (parseFloat(it.precio_unitario) || 0) * (parseFloat(it.cantidad) || 0);
            const rowTotal = it.tiene_iva ? sub * 1.16 : sub;
            totalGeneral += rowTotal;

            const pName = it.proveedor_nombre || 'Sin Asignar';
            if (!itemsByProv[pName]) itemsByProv[pName] = [];
            itemsByProv[pName].push({ ...it, subtotal: sub, rowTotal });
        });

        // Header
        const headerInfo = `
            <div style="margin-bottom:1rem; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; background:rgba(255,255,255,0.03); padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
                <div>
                    <p><strong>Folio:</strong> ${r.folio}</p>
                    <p><strong>No. Control:</strong> ${r.no_control || '-'}</p>
                    <p><strong>Proyecto:</strong> ${r.equipo_nombre || '-'}</p>
                </div>
                <div>
                    <p><strong>Área:</strong> ${r.area || '-'}</p>
                    <p><strong>Emitido por:</strong> ${r.emitido_por || '-'}</p>
                    <p><strong>Aprobado por:</strong> ${r.aprobado_por || '-'}</p>
                </div>
                <div>
                    <p><strong>Revisado por:</strong> ${r.revisado_por || '-'}</p>
                    <p><strong>Requerido por:</strong> ${r.requerido_por || '-'}</p>
                    <p><strong>Fecha:</strong> ${new Date(r.fecha_creacion).toLocaleDateString('es-MX')}</p>
                    <p><strong>Estado:</strong> <span class="badge badge-info">${r.estado}</span></p>
                </div>
                <div style="grid-column: span 3;">
                     <p><strong>Notas:</strong> ${r.notas || '-'}</p>
                     <p style="font-size:1.1rem;"><strong>Total General:</strong> <span style="color:var(--accent); font-weight:bold;">$${totalGeneral.toFixed(2)}</span></p>
                </div>
            </div>
        `;

        // Items Table
        let itemsHtml = `
            <div class="table-wrapper" style="margin-bottom:1rem;">
                <table>
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Componente</th>
                            <th>Proveedor</th>
                            <th>Comentario</th>
                            <th>Cant</th>
                            <th>Unidad</th>
                            <th>P.Unit</th>
                            <th>IVA</th>
                            <th>Subtotal</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        (r.items || []).forEach((it, idx) => {
            const sub = (it.cantidad * it.precio_unitario);
            const tot = it.tiene_iva ? sub * 1.16 : sub;
            itemsHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${it.componente}</td>
                    <td>${it.proveedor_nombre || '-'}</td>
                    <td><small>${it.comentario || ''}</small></td>
                    <td>${it.cantidad}</td>
                    <td>${it.unidad}</td>
                    <td>$${Number(it.precio_unitario).toFixed(2)}</td>
                    <td>${it.tiene_iva ? 'Sí' : 'No'}</td>
                    <td>$${sub.toFixed(2)}</td>
                    <td><strong>$${tot.toFixed(2)}</strong></td>
                </tr>
            `;
        });

        itemsHtml += `</tbody></table></div>`;

        // Send Actions
        let sendActionsHtml = '<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-top:10px;"><h4>Enviar Pedidos por Proveedor</h4>';

        Object.keys(itemsByProv).forEach(pName => {
            if (pName === 'Sin Asignar') return;
            const provTotal = itemsByProv[pName].reduce((s, i) => s + i.rowTotal, 0);
            const eqName = (r.equipo_nombre || '').replace(/'/g, "\\'");
            sendActionsHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:8px; margin-bottom:5px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
                    <span><strong>${pName}</strong> (${itemsByProv[pName].length} partidas - $${provTotal.toFixed(2)})</span>
                    <div style="gap:5px; display:flex;">
                         <button class="btn btn-success btn-sm" onclick="enviarReqWhatsApp(${r.id}, '${pName.replace(/'/g, "\\'")}', '${eqName}')">WhatsApp + PDF</button>
                         <button class="btn btn-primary btn-sm" onclick="enviarReqEmail(${r.id}, '${pName.replace(/'/g, "\\'")}')">Email</button>
                    </div>
                </div>
            `;
        });

        if (Object.keys(itemsByProv).length === 0 || (Object.keys(itemsByProv).length === 1 && itemsByProv['Sin Asignar'])) {
            sendActionsHtml += '<p style="color:#888; font-style:italic;">Asigne proveedores a las partidas para ver opciones de envío.</p>';
        }
        sendActionsHtml += '</div>';

        // Etiqueta Section
        const etiquetaHtml = `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-top:15px; border:1px solid rgba(255,255,255,0.1);">
                <h4>Generar Etiqueta de Equipo</h4>
                <p style="color:#888; font-size:0.85rem; margin-bottom:10px;">Llena los datos del equipo para generar la etiqueta PNG. Puedes descargarla o enviarla por email.</p>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <div class="form-group">
                        <label>Equipo</label>
                        <input type="text" id="etq-equipo" value="${r.equipo_nombre || ''}" placeholder="Nombre del equipo">
                    </div>
                    <div class="form-group">
                        <label>Modelo</label>
                        <input type="text" id="etq-modelo" placeholder="Modelo">
                    </div>
                    <div class="form-group">
                        <label>Capacidad</label>
                        <input type="text" id="etq-capacidad" placeholder="Ej: 500 Kg/hr">
                    </div>
                    <div class="form-group">
                        <label>Potencia Motor</label>
                        <input type="text" id="etq-potencia" placeholder="Ej: 15 HP">
                    </div>
                    <div class="form-group">
                        <label>Apertura</label>
                        <input type="text" id="etq-apertura" placeholder="Ej: 3/8\"">
                    </div>
                    <div class="form-group">
                        <label>Tamaño Alimentación</label>
                        <input type="text" id="etq-tamano" placeholder="Ej: 4\"">
                    </div>
                    <div class="form-group">
                        <label>Peso del Equipo</label>
                        <input type="text" id="etq-peso" placeholder="Ej: 1200 Kg">
                    </div>
                    <div class="form-group">
                        <label>Fecha de Fabricación</label>
                        <input type="date" id="etq-fecha-fab">
                    </div>
                    <div class="form-group">
                        <label>Número de Serie</label>
                        <input type="text" id="etq-serie" placeholder="Ej: SHT-D01-001">
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-top:15px; align-items:flex-end; flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="descargarEtiquetaReq(${r.id})">Descargar Etiqueta PNG</button>
                    <div class="form-group" style="flex:1; margin:0;">
                        <label>Email destino</label>
                        <input type="email" id="etq-email" placeholder="correo@ejemplo.com" style="margin:0;">
                    </div>
                    <button class="btn btn-success" onclick="enviarEtiquetaEmail(${r.id})">Enviar Etiqueta</button>
                </div>
            </div>
        `;

        // General Actions
        const generalActions = `
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap; justify-content: flex-end; align-items:center;">
                 <label>Estado General: </label>
                 <select onchange="cambiarEstadoReq(${r.id}, this.value)" style="padding:0.3rem; border-radius:4px;">
                    <option value="Pendiente" ${r.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Enviada" ${r.estado === 'Enviada' ? 'selected' : ''}>Enviada</option>
                    <option value="Recibida" ${r.estado === 'Recibida' ? 'selected' : ''}>Recibida</option>
                    <option value="Cancelada" ${r.estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                </select>
            </div>
        `;

        body.innerHTML = headerInfo + itemsHtml + sendActionsHtml + etiquetaHtml + generalActions;

    } catch (e) {
        body.innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`;
        console.error(e);
    }
}

async function enviarReqWhatsApp(rid, provName, equipoNombre) {
    try {
        // 1. Find equipo_id from catalog
        const equipo = equiposCatalogo.find(e =>
            e.nombre === equipoNombre ||
            `${e.codigo} - ${e.nombre}` === equipoNombre ||
            e.codigo === equipoNombre
        );

        // 2. Find proveedor from the API  
        const provRes = await fetch(`${API}/api/proveedores`);
        const proveedores = await provRes.json();
        const prov = (Array.isArray(proveedores) ? proveedores : []).find(p => p.razon_social === provName);

        if (!prov) {
            notify(`No se encontro el proveedor "${provName}" en la base de datos`, 'error');
            return;
        }

        // 3. Download the PDF/order image if equipo found
        if (equipo) {
            try {
                const pdfUrl = `${API}/api/equipos/${equipo.id}/orden-proveedor/${prov.id}`;
                const pdfRes = await fetch(pdfUrl);
                if (pdfRes.ok) {
                    const blob = await pdfRes.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `orden_${equipo.codigo}_${provName.replace(/ /g, '_')}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    notify('Documento de orden descargado. Adjuntalo en WhatsApp.', 'success');
                }
            } catch (pdfErr) {
                console.warn('No se pudo descargar PDF:', pdfErr);
            }
        }

        // 4. Open WhatsApp with pre-filled message template
        const whatsapp = prov.whatsapp || prov.telefono || '';
        if (!whatsapp) {
            notify(`El proveedor "${provName}" no tiene WhatsApp registrado`, 'error');
            return;
        }
        const contacto = prov.contacto_nombre || provName;
        const proyecto = equipoNombre || 'proyecto en curso';
        const mensaje = `Hola ${contacto}, somos *DURTRON - Innovacion Industrial*.\n\nSolicitamos cotizacion de materiales para el proyecto: *${proyecto}*.\n\nSe adjunta documento con el detalle de las partes requeridas.\n\nQuedamos atentos a su respuesta con precios y tiempos de entrega.\n\nGracias.`;

        const tel = whatsapp.replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;

        // Small delay so download completes first
        setTimeout(() => {
            window.open(waUrl, '_blank');
        }, 800);

    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function enviarReqEmail(rid, provName) {
    if (!confirm(`¿Enviar correo con las partidas correspondientes a ${provName}?`)) return;
    try {
        let url = `${API}/api/requisiciones/${rid}/enviar-email`;
        if (provName) url += `?proveedor=${encodeURIComponent(provName)}`;

        const res = await fetch(url, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            notify(data.message, 'success');
        } else {
            notify(data.error || 'Error al enviar email', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function cambiarEstadoReq(rid, estado) {
    try {
        const res = await fetch(`${API}/api/requisiciones/${rid}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        const data = await res.json();
        if (data.success) {
            notify(`Estado cambiado a ${estado}`, 'success');
            loadRequisiciones();
        } else {
            notify(data.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function deleteRequisicion(rid) {
    if (!confirm('¿Eliminar esta requisicion?')) return;
    try {
        const res = await fetch(`${API}/api/requisiciones/${rid}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            notify('Requisicion eliminada', 'success');
            loadRequisiciones();
        } else {
            notify(data.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ==================== ETIQUETA DESDE REQUISICION ====================
function getEtiquetaData() {
    return {
        equipo: document.getElementById('etq-equipo')?.value || '',
        modelo: document.getElementById('etq-modelo')?.value || '',
        capacidad: document.getElementById('etq-capacidad')?.value || '',
        potencia: document.getElementById('etq-potencia')?.value || '',
        apertura: document.getElementById('etq-apertura')?.value || '',
        tamano_alimentacion: document.getElementById('etq-tamano')?.value || '',
        peso: document.getElementById('etq-peso')?.value || '',
        fecha_fabricacion: document.getElementById('etq-fecha-fab')?.value || '',
        numero_serie: document.getElementById('etq-serie')?.value || ''
    };
}

async function descargarEtiquetaReq(rid) {
    try {
        const data = getEtiquetaData();
        if (!data.equipo) {
            notify('Ingresa al menos el nombre del equipo', 'error');
            return;
        }

        const res = await fetch(`${API}/api/requisiciones/${rid}/etiqueta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json();
            notify(err.error || 'Error al generar etiqueta', 'error');
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiqueta_${data.equipo.replace(/\s/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('Etiqueta descargada', 'success');
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function enviarEtiquetaEmail(rid) {
    const email = document.getElementById('etq-email')?.value || '';
    if (!email) {
        notify('Ingresa un correo destino', 'error');
        return;
    }
    const data = getEtiquetaData();
    data.email = email;

    if (!data.equipo) {
        notify('Ingresa al menos el nombre del equipo', 'error');
        return;
    }

    if (!confirm(`¿Enviar etiqueta de "${data.equipo}" a ${email}?`)) return;

    try {
        const res = await fetch(`${API}/api/requisiciones/${rid}/enviar-etiqueta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            notify(result.message, 'success');
        } else {
            notify(result.error || 'Error al enviar etiqueta', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}
