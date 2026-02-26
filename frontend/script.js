// ===== CONFIGURACION =====
window.onerror = function (msg, url, line, col, error) {
    alert("Error de Sistema (JS): " + msg + "\nLinea: " + line);
    return false;
};
const API = window.location.origin;
let equiposCatalogo = [];
let inventarioItems = [];
let ventasData = [];
let configData = {};
let dashboardData = {};
let AVAILABLE_PROVIDERS = []; // Global providers list
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
        loadVendedoresCatalogo();
        loadCotizaciones();
        loadProveedores(); // Ensure providers are loaded for Requisitions
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
    requisiciones: 'Requisiciones',
    etiquetas: 'Generar Etiquetas'
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
            if (s === 'vendedores') { loadVendedores(); loadVendedoresCatalogo(); }
            if (s === 'ventas') loadVentas();
            if (s === 'dashboard') loadDashboard();
            if (s === 'cotizaciones') { loadCotizaciones(); populateCotEquipoSelects(); }
            if (s === 'etiquetas') populateEtiquetaStandaloneDropdown();
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

        document.getElementById('stat-no-facturado').textContent = money(d.ingreso_no_facturado);
        document.getElementById('stat-facturado').textContent = money(d.ingreso_facturado);
        document.getElementById('stat-total').textContent = money(d.ingreso_total);
        document.getElementById('stat-utilidad').textContent = money(d.utilidad_bruta);

        renderPieChart(d);
        renderTopEquiposChart(d);
        renderTopEquiposTable(d);
        renderHistorialAnual(d);
    } catch (e) {
        console.error('Error dashboard:', e);
        document.getElementById('stat-no-facturado').textContent = '$0.00';
        document.getElementById('stat-facturado').textContent = '$0.00';
        document.getElementById('stat-total').textContent = '$0.00';
        document.getElementById('stat-utilidad').textContent = '$0.00';
    }
}

function renderPieChart(d) {
    const ctx = document.getElementById('chart-ingresos');
    if (!ctx) return;

    if (ingresosChart) {
        ingresosChart.destroy();
    }

    const noFact = d.ingreso_no_facturado || 0;
    const fact = d.ingreso_facturado || 0;
    const utilidad = d.utilidad_bruta || 0;
    const total = noFact + fact + utilidad;

    ingresosChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['No Facturado', 'Facturado', 'Utilidad Bruta'],
            datasets: [{
                data: [noFact, fact, utilidad],
                backgroundColor: [
                    'rgba(231, 76, 60, 0.85)',
                    'rgba(52, 152, 219, 0.85)',
                    'rgba(243, 156, 18, 0.85)'
                ],
                borderColor: [
                    'rgba(231, 76, 60, 1)',
                    'rgba(52, 152, 219, 1)',
                    'rgba(243, 156, 18, 1)'
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
                            const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + money(ctx.raw) + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

let topEquiposChart = null;

function renderTopEquiposChart(d) {
    const ctx = document.getElementById('chart-top-equipos');
    if (!ctx) return;

    if (topEquiposChart) {
        topEquiposChart.destroy();
    }

    const equipos = (d.top_equipos || []);
    if (equipos.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align:center; color:#888; padding:2rem;">No hay ventas registradas aún</p>';
        return;
    }

    const labels = equipos.map(e => e.nombre.length > 20 ? e.nombre.substring(0, 18) + '...' : e.nombre);
    const dataVentas = equipos.map(e => e.total_vendidos);

    const colors = [
        'rgba(210, 21, 43, 0.85)',
        'rgba(244, 116, 39, 0.85)',
        'rgba(52, 152, 219, 0.85)',
        'rgba(46, 204, 113, 0.85)',
        'rgba(155, 89, 182, 0.85)',
        'rgba(241, 196, 15, 0.85)',
        'rgba(26, 188, 156, 0.85)',
        'rgba(231, 76, 60, 0.85)',
        'rgba(142, 68, 173, 0.85)',
        'rgba(230, 126, 34, 0.85)'
    ];

    const totalUnidades = dataVentas.reduce((a, b) => a + b, 0);

    topEquiposChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataVentas,
                backgroundColor: colors.slice(0, equipos.length),
                borderColor: colors.slice(0, equipos.length).map(c => c.replace('0.85', '1')),
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
                        padding: 15,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                        font: { size: 11, family: 'Inter' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const pct = totalUnidades > 0 ? (ctx.raw / totalUnidades * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + ctx.raw + ' uds (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

function renderTopEquiposTable(d) {
    const tbody = document.getElementById('top-equipos-tbody');
    if (!tbody) return;

    const equipos = (d.top_equipos || []);
    if (equipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay ventas registradas</td></tr>';
        return;
    }

    tbody.innerHTML = equipos.map((e, i) => `
        <tr>
            <td style="text-align:center; font-size:1.1rem;">${i + 1}.</td>
            <td><strong>${e.nombre}</strong></td>
            <td style="color:#F47427;">${e.codigo}</td>
            <td style="text-align:center;"><span style="background:rgba(210,21,43,0.2); color:#D2152B; padding:3px 12px; border-radius:12px; font-weight:700;">${e.total_vendidos}</span></td>
            <td style="text-align:right; font-weight:600;">${money(e.ingreso_total)}</td>
            <td style="text-align:right; color:#888;">${e.porcentaje}%</td>
        </tr>
    `).join('');
}

function renderHistorialAnual(d) {
    const tbody = document.getElementById('historial-anual-tbody');
    if (!tbody) return;

    const historial = d.historial_anual || [];
    if (historial.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Sin datos</td></tr>';
        return;
    }

    let html = '';
    historial.forEach(h => {
        html += `
        <tr class="historial-year-row" style="cursor:pointer;" onclick="toggleMeses(${h.anio})">
            <td><strong>&#9654; ${h.anio}</strong></td>
            <td style="text-align:center;">${h.ventas}</td>
            <td style="text-align:right;">${money(h.no_facturado)}</td>
            <td style="text-align:right;">${money(h.facturado)}</td>
            <td style="text-align:right; font-weight:700; color:#27ae60;">${money(h.total)}</td>
        </tr>`;
        if (h.meses) {
            h.meses.forEach(m => {
                html += `
                <tr class="meses-${h.anio}" style="display:none; background:rgba(255,255,255,0.02);">
                    <td style="padding-left:2rem; color:var(--text-muted); font-size:0.82rem;">${m.nombre}</td>
                    <td style="text-align:center; font-size:0.82rem;">${m.ventas}</td>
                    <td style="text-align:right; font-size:0.82rem;">${money(m.no_facturado)}</td>
                    <td style="text-align:right; font-size:0.82rem;">${money(m.facturado)}</td>
                    <td style="text-align:right; font-size:0.82rem;">${money(m.total)}</td>
                </tr>`;
            });
        }
    });
    tbody.innerHTML = html;
}

function toggleMeses(anio) {
    const rows = document.querySelectorAll(`.meses-${anio}`);
    const visible = rows.length > 0 && rows[0].style.display !== 'none';
    rows.forEach(r => r.style.display = visible ? 'none' : '');
    // Toggle arrow
    const yearRows = document.querySelectorAll('.historial-year-row');
    yearRows.forEach(yr => {
        const strong = yr.querySelector('strong');
        if (strong && strong.textContent.includes(anio)) {
            strong.innerHTML = (visible ? '&#9654; ' : '&#9660; ') + anio;
        }
    });
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
        <td><strong>${eq.nombre}</strong></td>
        <td>${eq.marca || '-'}</td>
        <td>${eq.modelo || '-'}</td>
        <td>${eq.version || '1.0'}</td>
        <td>${eq.categoria || '-'}</td>
        <td class="text-right">${money(eq.precio_lista)}</td>
        <td class="text-right">${money(eq.precio_costo)}</td>
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
        document.getElementById('edit-eq-nombre').value = eq.nombre || '';
        document.getElementById('edit-eq-marca').value = eq.marca || '';
        document.getElementById('edit-eq-modelo').value = eq.modelo || '';
        document.getElementById('edit-eq-precio-lista').value = eq.precio_lista || 0;
        document.getElementById('edit-eq-precio-costo').value = eq.precio_costo || 0;
        document.getElementById('edit-eq-potencia').value = eq.potencia_motor || '';
        document.getElementById('edit-eq-capacidad').value = eq.capacidad || '';
        document.getElementById('edit-eq-dimensiones').value = eq.dimensiones || '';
        document.getElementById('edit-eq-peso').value = eq.peso || '';
        document.getElementById('edit-eq-especificaciones').value = eq.especificaciones || '';
        document.getElementById('edit-eq-descripcion').value = eq.descripcion || '';
        document.getElementById('edit-eq-apertura').value = eq.apertura || '';
        document.getElementById('edit-eq-tamano-alimentacion').value = eq.tamano_alimentacion || '';

        // Set version dropdown
        const verSel = document.getElementById('edit-eq-version');
        const currentVer = eq.version || '1.0';
        const verNum = parseFloat(currentVer) || 1.0;
        let verOptions = '';
        for (let v = 1.0; v <= Math.max(verNum + 1, 5.0); v = Math.round((v + 0.1) * 10) / 10) {
            verOptions += `<option value="${v.toFixed(1)}" ${v.toFixed(1) === currentVer ? 'selected' : ''}>${v.toFixed(1)}</option>`;
        }
        verSel.innerHTML = verOptions;

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
        nombre: document.getElementById('edit-eq-nombre').value.trim(),
        marca: document.getElementById('edit-eq-marca').value.trim(),
        modelo: document.getElementById('edit-eq-modelo').value.trim(),
        version: document.getElementById('edit-eq-version').value,
        categoria: document.getElementById('edit-eq-categoria').value,
        precio_lista: parseFloat(document.getElementById('edit-eq-precio-lista').value) || 0,
        precio_costo: parseFloat(document.getElementById('edit-eq-precio-costo').value) || 0,
        potencia_motor: document.getElementById('edit-eq-potencia').value.trim(),
        capacidad: document.getElementById('edit-eq-capacidad').value.trim(),
        dimensiones: document.getElementById('edit-eq-dimensiones').value.trim(),
        peso: document.getElementById('edit-eq-peso').value.trim(),
        especificaciones: document.getElementById('edit-eq-especificaciones').value.trim(),
        descripcion: document.getElementById('edit-eq-descripcion').value.trim(),
        apertura: document.getElementById('edit-eq-apertura').value.trim(),
        tamano_alimentacion: document.getElementById('edit-eq-tamano-alimentacion').value.trim()
    };
    if (!body.nombre) {
        notify('Nombre es obligatorio', 'error'); return;
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
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay items en inventario</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(it => `<tr>
        <td>${it.id}</td>
        <td><strong>${it.equipo_nombre}</strong></td>
        <td>${badgeEstado(it.estado)}${it.estado === 'Disponible - Faltan Piezas' && it.observaciones ? `<br><small style="color:#e67e22;">${it.observaciones}</small>` : ''}</td>
        <td class="text-right">${money(it.precio_lista)}</td>
        <td>${formatDate(it.fecha_ingreso)}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick="verDetalle(${it.id})">Ver</button>
                <button class="btn btn-sm" style="background:#8e44ad;color:#fff;" onclick="abrirCambiarEstado(${it.id},'${it.estado.replace(/'/g, "\\'")}')" title="Cambiar estado">Estado</button>
                ${canSell(it.estado) ? `<button class="btn btn-sm btn-success" onclick="openVenta(${it.id})">Vender</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteInventario(${it.id})">Eliminar</button>
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
    return ['Disponible', 'Disponible - Faltan Piezas'].includes(estado);
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
            <div class="info-row"><strong>${it.equipo_nombre}</strong></div>
            <div class="info-row"><span>Precio Lista:</span> <strong class="text-success">${money(it.precio_lista)}</strong></div>
        `;
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
        const estado = v.estado_venta || 'Anticipo';
        const estadoBadge = estado === 'Liquidado'
            ? '<span class="badge badge-disponible">Liquidado</span>'
            : `<span class="badge badge-anticipo">Anticipo</span>`;
        const entregado = v.entregado
            ? '<span class="badge badge-si">Si</span>'
            : '<span class="badge badge-no">No</span>';
        return `<tr>
        <td>${formatDate(v.fecha_venta)}</td>
        <td><strong>${v.equipo_nombre || ''}</strong></td>
        <td>${v.cliente_nombre}</td>
        <td>${v.vendedor}</td>
        <td class="text-right font-bold">${money(v.precio_venta)}</td>
        <td>${estadoBadge}</td>
        <td>${entregado}</td>
        <td>${v.facturado ? '<span class="badge badge-si">Si</span>' : '<span class="badge badge-no">No</span>'}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick="editarVenta(${v.id})">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteVenta(${v.id})">Eliminar</button>
            </div>
        </td>
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

let editingVentaData = null;

function editarVenta(vid) {
    const v = ventasData.find(x => x.id === vid);
    if (!v) { notify('Venta no encontrada', 'error'); return; }
    editingVentaData = v;

    document.getElementById('edit-venta-id').value = v.id;
    document.getElementById('edit-venta-vendedor').value = v.vendedor || '';
    document.getElementById('edit-venta-cliente').value = v.cliente_nombre || '';
    document.getElementById('edit-venta-contacto').value = v.cliente_contacto || '';
    document.getElementById('edit-venta-rfc').value = v.cliente_rfc || '';
    document.getElementById('edit-venta-direccion').value = v.cliente_direccion || '';
    document.getElementById('edit-venta-precio').value = v.precio_venta || 0;
    document.getElementById('edit-venta-forma-pago').value = v.forma_pago || '';
    document.getElementById('edit-venta-facturado').value = v.facturado ? 'true' : 'false';
    document.getElementById('edit-venta-num-factura').value = v.numero_factura || '';
    document.getElementById('edit-venta-cuenta').value = v.cuenta_bancaria || '';
    document.getElementById('edit-venta-entregado').value = v.entregado ? 'true' : 'false';
    document.getElementById('edit-venta-estado').value = v.estado_venta || 'Anticipo';
    document.getElementById('edit-venta-notas').value = v.notas || '';

    renderAnticiposList(v.anticipos || [], v.precio_venta);
    openModal('modal-editar-venta');
}

function renderAnticiposList(anticipos, precioVenta) {
    const container = document.getElementById('edit-venta-anticipos-list');
    if (!anticipos || anticipos.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:0.85rem;">Sin anticipos registrados</p>';
        return;
    }
    const total = anticipos.reduce((s, a) => s + parseFloat(a.monto), 0);
    const pct = precioVenta > 0 ? (total / precioVenta * 100).toFixed(1) : 0;
    let html = `<div style="margin-bottom:0.5rem;font-size:0.9rem;"><strong>Total: ${money(total)}</strong> de ${money(precioVenta)} (${pct}%)</div>`;
    html += '<table style="width:100%;font-size:0.85rem;"><thead><tr><th>Fecha</th><th>Monto</th><th>Notas</th><th>Comp.</th><th></th></tr></thead><tbody>';
    anticipos.forEach(a => {
        const comp = a.comprobante_url
            ? `<a href="${API}${a.comprobante_url}" target="_blank" style="color:#3498db;">Ver</a>`
            : '-';
        html += `<tr>
            <td>${formatDate(a.fecha)}</td>
            <td>${money(a.monto)}</td>
            <td>${a.notas || '-'}</td>
            <td>${comp}</td>
            <td><button class="btn btn-sm btn-danger" onclick="eliminarAnticipo(${a.id})" style="padding:2px 6px;font-size:0.7rem;">X</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function abrirAgregarAnticipo() {
    const vid = document.getElementById('edit-venta-id').value;
    document.getElementById('anticipo-venta-id').value = vid;
    document.getElementById('anticipo-monto').value = '';
    document.getElementById('anticipo-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('anticipo-notas').value = '';
    document.getElementById('anticipo-comprobante').value = '';
    openModal('modal-agregar-anticipo');
}

async function guardarAnticipo() {
    const vid = document.getElementById('anticipo-venta-id').value;
    const monto = parseFloat(document.getElementById('anticipo-monto').value) || 0;
    if (monto <= 0) { notify('Ingresa un monto', 'error'); return; }

    const fd = new FormData();
    fd.append('monto', monto);
    fd.append('fecha', document.getElementById('anticipo-fecha').value || '');
    fd.append('notas', document.getElementById('anticipo-notas').value || '');
    const fileInput = document.getElementById('anticipo-comprobante');
    if (fileInput.files.length > 0) {
        fd.append('comprobante', fileInput.files[0]);
    }

    try {
        const r = await fetch(`${API}/api/ventas/${vid}/anticipos`, {
            method: 'POST',
            body: fd
        });
        const res = await r.json();
        if (res.success) {
            notify(`Anticipo registrado. Total: ${money(res.total_anticipos)}. Estado: ${res.estado}`, 'success');
            closeModal('modal-agregar-anticipo');
            // Reload ventas and refresh edit modal
            await loadVentas();
            const updatedV = ventasData.find(x => x.id === parseInt(vid));
            if (updatedV) {
                editingVentaData = updatedV;
                document.getElementById('edit-venta-estado').value = updatedV.estado_venta || 'Anticipo';
                renderAnticiposList(updatedV.anticipos || [], updatedV.precio_venta);
            }
        } else {
            notify(res.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function eliminarAnticipo(aid) {
    if (!confirm('Eliminar este anticipo?')) return;
    try {
        const r = await fetch(`${API}/api/anticipos/${aid}`, { method: 'DELETE' });
        const res = await r.json();
        if (res.success) {
            notify('Anticipo eliminado', 'success');
            const vid = document.getElementById('edit-venta-id').value;
            await loadVentas();
            const updatedV = ventasData.find(x => x.id === parseInt(vid));
            if (updatedV) {
                editingVentaData = updatedV;
                document.getElementById('edit-venta-estado').value = updatedV.estado_venta || 'Anticipo';
                renderAnticiposList(updatedV.anticipos || [], updatedV.precio_venta);
            }
        } else {
            notify(res.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ===== VENDEDORES CATALOGO =====
let vendedoresCatalogoData = [];

async function loadVendedoresCatalogo() {
    try {
        const r = await fetch(`${API}/api/vendedores/catalogo`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        vendedoresCatalogoData = await r.json();
        renderVendedoresCatalogo();
        populateVendedorDropdowns();
    } catch (e) {
        console.error('Error loading vendedores catalogo:', e);
    }
}

function renderVendedoresCatalogo() {
    const tbody = document.getElementById('vendedores-catalogo-tbody');
    if (!tbody) return;
    if (vendedoresCatalogoData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No hay vendedores registrados</td></tr>';
        return;
    }
    tbody.innerHTML = vendedoresCatalogoData.map(v => `<tr>
        <td>${v.id}</td>
        <td><strong>${v.nombre}</strong></td>
        <td>${v.telefono || '-'}</td>
        <td>${v.email || '-'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteVendedorCatalogo(${v.id})">Eliminar</button></td>
    </tr>`).join('');
}

function populateVendedorDropdowns() {
    const selects = [
        document.getElementById('venta-vendedor'),
        document.getElementById('edit-venta-vendedor')
    ];
    selects.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Seleccionar vendedor...</option>';
        vendedoresCatalogoData.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.nombre;
            opt.textContent = v.nombre;
            sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
    });
}

async function deleteVendedorCatalogo(vid) {
    if (!confirm('Eliminar este vendedor del directorio?')) return;
    try {
        const r = await fetch(`${API}/api/vendedores/catalogo/${vid}`, { method: 'DELETE' });
        const res = await r.json();
        if (res.success) {
            notify('Vendedor eliminado', 'success');
            loadVendedoresCatalogo();
        } else {
            notify(res.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ===== VENDEDORES STATS =====
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
            if (v.posicion === 1) medal = '<span class="medal" style="color:#FFD700;">1o</span> ';
            else if (v.posicion === 2) medal = '<span class="medal" style="color:#C0C0C0;">2o</span> ';
            else if (v.posicion === 3) medal = '<span class="medal" style="color:#CD7F32;">3o</span> ';
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
                nombre: document.getElementById('cat-nombre').value,
                marca: document.getElementById('cat-marca').value,
                modelo: document.getElementById('cat-modelo').value,
                version: document.getElementById('cat-version').value || '1.0',
                categoria: document.getElementById('cat-categoria').value,
                precio_lista: parseFloat(document.getElementById('cat-precio-lista').value) || 0,
                precio_costo: parseFloat(document.getElementById('cat-precio-costo').value) || 0,
                potencia_motor: document.getElementById('cat-potencia').value,
                capacidad: document.getElementById('cat-capacidad').value,
                dimensiones: document.getElementById('cat-dimensiones').value,
                peso: document.getElementById('cat-peso').value,
                especificaciones: document.getElementById('cat-especificaciones').value,
                descripcion: document.getElementById('cat-descripcion').value,
                apertura: document.getElementById('cat-apertura').value,
                tamano_alimentacion: document.getElementById('cat-tamano-alimentacion').value
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

    document.getElementById('form-venta').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const invId = document.getElementById('venta-inv-id').value;
            const precioVenta = parseFloat(document.getElementById('venta-precio').value) || 0;
            const anticipoMonto = parseFloat(document.getElementById('venta-anticipo-monto').value) || 0;
            const anticipoFecha = document.getElementById('venta-anticipo-fecha').value || null;

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
                cuenta_bancaria: document.getElementById('venta-cuenta').value,
                anticipo_monto: anticipoMonto,
                anticipo_fecha: anticipoFecha,
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

    // Editar venta form
    document.getElementById('form-editar-venta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const vid = document.getElementById('edit-venta-id').value;
        const body = {
            vendedor: document.getElementById('edit-venta-vendedor').value,
            cliente_nombre: document.getElementById('edit-venta-cliente').value,
            cliente_contacto: document.getElementById('edit-venta-contacto').value,
            cliente_rfc: document.getElementById('edit-venta-rfc').value,
            cliente_direccion: document.getElementById('edit-venta-direccion').value,
            precio_venta: parseFloat(document.getElementById('edit-venta-precio').value) || 0,
            forma_pago: document.getElementById('edit-venta-forma-pago').value,
            facturado: document.getElementById('edit-venta-facturado').value === 'true',
            numero_factura: document.getElementById('edit-venta-num-factura').value,
            cuenta_bancaria: document.getElementById('edit-venta-cuenta').value,
            entregado: document.getElementById('edit-venta-entregado').value === 'true',
            estado_venta: document.getElementById('edit-venta-estado').value,
            notas: document.getElementById('edit-venta-notas').value
        };
        try {
            const r = await fetch(`${API}/api/ventas/${vid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const res = await r.json();
            if (res.success) {
                notify('Venta actualizada', 'success');
                closeModal('modal-editar-venta');
                loadVentas();
                loadDashboard();
            } else {
                notify(res.error || 'Error', 'error');
            }
        } catch (err) {
            notify('Error: ' + err.message, 'error');
        }
    });

    // Vendedor catalogo form
    document.getElementById('form-vendedor-catalogo').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const body = {
                nombre: document.getElementById('vendedor-nombre').value,
                telefono: document.getElementById('vendedor-telefono').value,
                email: document.getElementById('vendedor-email').value
            };
            const r = await fetch(`${API}/api/vendedores/catalogo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const res = await r.json();
            if (res.success) {
                notify('Vendedor agregado al directorio', 'success');
                document.getElementById('form-vendedor-catalogo').reset();
                loadVendedoresCatalogo();
            } else {
                notify(res.error || 'Error', 'error');
            }
        } catch (err) {
            notify('Error: ' + err.message, 'error');
        }
    });

    // Proveedor form
    document.getElementById('form-proveedor').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const body = {
                razon_social: document.getElementById('prov-razon').value,
                contacto_nombre: document.getElementById('prov-contacto').value,
                correo: document.getElementById('prov-correo').value,
                telefono: document.getElementById('prov-telefono').value,
                whatsapp: document.getElementById('prov-whatsapp').value,
                medio_preferido: document.getElementById('prov-medio').value,
                notas: document.getElementById('prov-notas').value
            };
            const r = await fetch(`${API}/api/proveedores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const res = await r.json();
            if (res.success) {
                notify('Proveedor registrado', 'success');
                document.getElementById('form-proveedor').reset();
                loadProveedores();
            } else {
                notify(res.error || 'Error', 'error');
            }
        } catch (err) {
            notify('Error: ' + err.message, 'error');
        }
    });

    // Requisicion form
    document.getElementById('form-requisicion').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const items = [];
            document.querySelectorAll('.req-item-row').forEach(row => {
                const comp = row.querySelector('.req-comp').value.trim();
                const provVal = row.querySelector('.req-prov').value.trim();
                if (comp) {
                    items.push({
                        componente: comp,
                        proveedor_nombre: provVal,
                        comentario: row.querySelector('.req-coment').value.trim(),
                        cantidad: parseFloat(row.querySelector('.req-cant').value) || 0,
                        unidad: 'pza',
                        precio_unitario: 0,
                        tiene_iva: false
                    });
                }
            });

            if (items.length === 0) { notify('Agrega al menos un componente', 'error'); return; }

            const body = {
                inventario_id: null,
                equipo_nombre: document.getElementById('req-equipo').selectedOptions[0]?.text || '',
                no_control: '',
                numero_serie: document.getElementById('req-numero-serie').value.trim(),
                area: document.getElementById('req-area').value.trim(),
                proveedor_id: null,
                notas: document.getElementById('req-notas').value.trim(),
                emitido_por: document.getElementById('req-emitido').value.trim(),
                aprobado_por: document.getElementById('req-aprobado').value.trim(),
                revisado_por: document.getElementById('req-revisado').value.trim(),
                requerido_por: document.getElementById('req-requerido').value.trim(),
                items
            };

            const res = await fetch(`${API}/api/requisiciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                notify(`Requisicion ${data.folio} creada`, 'success');
                closeModal('modal-requisicion');
                document.getElementById('form-requisicion').reset();
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
        'En Fabricacion': 'badge-fabricacion',
        'Disponible - Faltan Piezas': 'badge-anticipo',
        'Vendida': 'badge-vendida'
    };
    return `<span class="badge ${map[estado] || 'badge-disponible'}">${estado}</span>`;
}

function toggleNotaPiezas() {
    const estado = document.getElementById('inv-estado').value;
    document.getElementById('nota-piezas-group').style.display = estado === 'Disponible - Faltan Piezas' ? '' : 'none';
}

function toggleNotaPiezasModal() {
    const estado = document.getElementById('cambiar-estado-select').value;
    document.getElementById('nota-piezas-modal-group').style.display = estado === 'Disponible - Faltan Piezas' ? '' : 'none';
}

function abrirCambiarEstado(iid, estadoActual) {
    document.getElementById('cambiar-estado-id').value = iid;
    document.getElementById('cambiar-estado-select').value = estadoActual;
    document.getElementById('cambiar-estado-nota').value = '';
    toggleNotaPiezasModal();
    openModal('modal-cambiar-estado');
}

async function guardarCambioEstado() {
    const iid = document.getElementById('cambiar-estado-id').value;
    const estado = document.getElementById('cambiar-estado-select').value;
    const nota = document.getElementById('cambiar-estado-nota').value;
    try {
        const res = await fetch(`${API}/api/inventario/${iid}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado, nota_piezas: nota })
        });
        const result = await res.json();
        if (result.success) {
            notify('Estado actualizado', 'success');
            closeModal('modal-cambiar-estado');
            loadInventario();
        } else {
            notify(result.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
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
        // Store modelo in a hidden data attr
        row.dataset.modelo = eq.modelo || eq.codigo || '';
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

function addCustomCotItem() {
    const container = document.getElementById('cot-items-container');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'cot-item-row';
    div.dataset.index = idx;
    div.dataset.custom = 'true';
    div.innerHTML = `
        <input type="text" class="cot-desc" placeholder="Descripcion del servicio o producto" style="flex:2; border-color:#F47427;">
        <input type="text" class="cot-modelo-custom" placeholder="Modelo (opcional)" style="width:120px; border-color:#F47427;">
        <input type="number" class="cot-cantidad" value="1" min="1" placeholder="Cant" style="width:70px">
        <input type="number" class="cot-precio" step="0.01" min="0" placeholder="Precio unitario" style="width:150px">
        <button type="button" class="btn btn-sm btn-danger" onclick="removeCotItem(this)">X</button>
    `;
    container.appendChild(div);
}

function removeCotItem(btn) {
    const container = document.getElementById('cot-items-container');
    if (container.children.length <= 1) {
        notify('Debe haber al menos un elemento', 'error');
        return;
    }
    btn.closest('.cot-item-row').remove();
}

function toggleDescuento() {
    const sel = document.getElementById('cot-descuento');
    const customGrp = document.getElementById('cot-descuento-custom-group');
    customGrp.style.display = sel.value === 'custom' ? '' : 'none';
}

function toggleAnticipo() {
    const sel = document.getElementById('cot-anticipo');
    const customGrp = document.getElementById('cot-anticipo-custom-group');
    customGrp.style.display = sel.value === 'custom' ? '' : 'none';
}

function getDescuentoPct() {
    const sel = document.getElementById('cot-descuento');
    if (sel.value === '0') return 0;
    if (sel.value === 'custom') return parseFloat(document.getElementById('cot-descuento-custom').value) || 0;
    return parseFloat(sel.value);
}

function getAnticipoPct() {
    const sel = document.getElementById('cot-anticipo');
    if (sel.value === '0') return 0;
    if (sel.value === 'custom') return parseFloat(document.getElementById('cot-anticipo-custom').value) || 0;
    return parseFloat(sel.value);
}

// Setup cotizacion form
document.addEventListener('DOMContentLoaded', () => {
    const formCot = document.getElementById('form-cotizacion');
    if (formCot) {
        formCot.addEventListener('submit', async (e) => {
            e.preventDefault();
            const items = [];
            document.querySelectorAll('.cot-item-row').forEach(row => {
                const isCustom = row.dataset.custom === 'true';
                const cant = row.querySelector('.cot-cantidad')?.value || 1;
                const precio = row.querySelector('.cot-precio')?.value;
                const desc = row.querySelector('.cot-desc')?.value;

                let eqId = null;
                let modelo = '';

                if (isCustom) {
                    modelo = row.querySelector('.cot-modelo-custom')?.value || '';
                } else {
                    eqId = row.querySelector('.cot-equipo-select')?.value || null;
                    modelo = row.dataset.modelo || '';
                }

                if (precio && desc) {
                    items.push({
                        equipo_id: eqId || null,
                        cantidad: parseInt(cant),
                        precio_unitario: parseFloat(precio),
                        descripcion: desc,
                        modelo: modelo
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
                        descuento_porcentaje: getDescuentoPct(),
                        anticipo_porcentaje: getAnticipoPct(),
                        notas: document.getElementById('cot-notas').value,
                        sobre_pedido: document.getElementById('cot-sobre-pedido')?.value || '',
                        items: items
                    })
                });
                const data = await r.json();
                if (data.success) {
                    notify(`Cotizacion ${data.folio} creada`, 'success');
                    formCot.reset();
                    document.getElementById('cot-descuento-custom-group').style.display = 'none';
                    document.getElementById('cot-anticipo-custom-group').style.display = 'none';
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

        const descPct = parseFloat(cot.descuento_porcentaje) || 0;
        const descMonto = parseFloat(cot.descuento_monto) || 0;
        const anticPct = parseFloat(cot.anticipo_porcentaje) || 0;
        const anticMonto = parseFloat(cot.anticipo_monto) || 0;

        let itemsHtml = cot.items.map((it, i) => `
            <tr>
                <td>${it.descripcion}</td>
                <td style="text-align:center">${it.modelo || '-'}</td>
                <td style="text-align:center">${it.cantidad}</td>
                <td style="text-align:right">${money(it.precio_unitario)}</td>
                <td style="text-align:right">${money(it.total_linea)}</td>
            </tr>
        `).join('');

        let totalsHtml = `
            <tr class="cot-summary-row">
                <td colspan="3"></td>
                <td style="text-align:right; background:#F47427; color:#fff; font-weight:700; padding:6px 10px;">SUBTOTAL</td>
                <td style="text-align:right; font-weight:600; padding:6px 10px;">${money(cot.subtotal)}</td>
            </tr>`;

        if (descPct > 0) {
            totalsHtml += `
            <tr class="cot-summary-row">
                <td colspan="3"></td>
                <td style="text-align:right; background:#F47427; color:#fff; font-weight:700; padding:6px 10px;">DESCUENTO ${descPct}%</td>
                <td style="text-align:right; font-weight:600; padding:6px 10px; color:#D2152B;">- ${money(descMonto)}</td>
            </tr>`;
        }

        if (cot.incluye_iva) {
            totalsHtml += `
            <tr class="cot-summary-row">
                <td colspan="3"></td>
                <td style="text-align:right; background:#F47427; color:#fff; font-weight:700; padding:6px 10px;">IVA 16%</td>
                <td style="text-align:right; font-weight:600; padding:6px 10px;">${money(cot.iva)}</td>
            </tr>`;
        }

        if (anticPct > 0) {
            totalsHtml += `
            <tr class="cot-summary-row">
                <td colspan="3"></td>
                <td style="text-align:right; background:#F47427; color:#fff; font-weight:700; padding:6px 10px;">Anticipo ${anticPct}%</td>
                <td style="text-align:right; font-weight:600; padding:6px 10px;">${money(anticMonto)}</td>
            </tr>`;
        }

        totalsHtml += `
            <tr class="cot-summary-row">
                <td colspan="3"></td>
                <td style="text-align:right; background:#D2152B; color:#fff; font-weight:800; padding:8px 10px; font-size:1.05rem;">TOTAL</td>
                <td style="text-align:right; font-weight:800; padding:8px 10px; font-size:1.05rem;">${money(cot.total)}</td>
            </tr>`;

        let infoFooter = '';
        if (cot.notas) {
            infoFooter += `<div style="margin-bottom:4px;"><strong>Sobre pedido:</strong> ${cot.notas}</div>`;
        }
        infoFooter += `<div><strong>Valido hasta:</strong> ${fechaVig}</div>`;

        document.getElementById('cotizacion-print-area').innerHTML = `
            <div class="cot-pdf" id="cot-pdf-content">

                <!-- PAGE 1: COVER -->
                <div class="cot-cover">
                    <div class="cot-cover-bg">
                        <div class="cot-cover-dark">
                            <div class="cot-cover-logo">
                                <img src="${typeof DURTRON_LOGO_B64 !== 'undefined' ? DURTRON_LOGO_B64 : ''}" alt="DURTRON" style="max-width:320px; height:auto;">
                            </div>
                        </div>
                        <div class="cot-cover-diagonal"></div>
                        <div class="cot-cover-orange">
                            <div class="cot-cover-title">COTIZACI&Oacute;N</div>
                        </div>
                    </div>
                </div>

                <!-- PAGE 2: QUOTE -->
                <div class="cot-page cot-page-content">
                    <div class="cot-pdf-header">
                        <div class="cot-pdf-logo">
                            <img src="${typeof DURTRON_LOGO_B64 !== 'undefined' ? DURTRON_LOGO_B64 : ''}" alt="DURTRON" style="max-width:200px; height:auto;">
                        </div>
                        <div class="cot-pdf-folio">
                            <div class="folio-number">${cot.folio}</div>
                            <div>Fecha: ${fechaCot}</div>
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
                                <th>PRODUCTO</th>
                                <th style="width:110px">MODELO</th>
                                <th style="width:80px">CANTIDAD</th>
                                <th style="width:120px">PRECIO</th>
                                <th style="width:120px">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                            ${totalsHtml}
                        </tbody>
                    </table>

                    <div class="cot-pdf-info-footer">
                        ${infoFooter}
                    </div>

                    <div class="cot-pdf-terminos">
                        <h4>Terminos y Condiciones de Venta</h4>
                        <ol>
                            <li><strong>Plazo de Liquidacion y Cargos por Almacenamiento</strong><br>
                            Una vez finalizado el proceso de fabricacion de su(s) producto(s), el cliente contara con un plazo maximo de 10 (diez) dias naturales para realizar la liquidacion total del pago correspondiente. En caso de exceder dicho plazo, se aplicara un cargo adicional de $300.00 (trescientos pesos 00/100 M.N.) por cada equipo y por cada dia de retraso, por concepto de almacenamiento y resguardo del equipo.</li>
                            <li><strong>No Devoluciones</strong><br>
                            No se realizan devoluciones de anticipos ni de equipos adquiridos, bajo ninguna circunstancia.</li>
                            <li><strong>Plazo Maximo de Retiro y Abandono del Equipo</strong><br>
                            Si el cliente no liquida el pago total y retira el equipo en un plazo de 90 (noventa) dias habiles posteriores a la notificacion formal de la finalizacion del mismo, se considerara que el producto ha sido abandonado. En este caso, DURTRON podra disponer del equipo para su venta a un nuevo cliente, sin obligacion de devolucion de anticipos ni posibilidad de reclamacion alguna sobre el producto.</li>
                            <li><strong>Notificacion de Finalizacion</strong><br>
                            La notificacion de que el producto ha finalizado su fabricacion se realizara unicamente por escrito, a traves de correo electronico o WhatsApp a los datos de contacto proporcionados por el cliente al momento de realizar su pedido.</li>
                            <li><strong>Liberacion de Responsabilidad</strong><br>
                            Una vez cumplido el plazo maximo de 90 dias habiles sin liquidacion y retiro del equipo, DURTRON queda libre de toda responsabilidad sobre la custodia, resguardo o entrega posterior del mismo. El cliente renuncia expresamente a cualquier derecho de reclamacion, indemnizacion o devolucion de anticipos.</li>
                            <li><strong>Especificaciones y Cambios en el Pedido</strong><br>
                            Una vez autorizado el pedido y recibido el anticipo, cualquier cambio en especificaciones, medidas, materiales o caracteristicas solicitadas por el cliente podra generar costos adicionales y modificar el tiempo de entrega.</li>
                            <li><strong>Tiempos de Entrega</strong><br>
                            Las fechas de entrega son estimadas y pueden variar por causas de fuerza mayor, disponibilidad de materiales, transporte o cualquier otra circunstancia ajena a DURTRON. Dichos retrasos no dan lugar a cancelacion ni devolucion de anticipos.</li>
                            <li><strong>Condiciones de Fabricacion y Anticipo</strong><br>
                            La fabricacion del equipo dara inicio <u>unicamente</u> una vez recibido el <strong>anticipo completo equivalente al 60% (sesenta por ciento) del costo total del pedido</strong>, sin excepcion alguna. El tiempo de entrega establecido se contara a partir de la fecha de confirmacion de recepcion del anticipo. Cualquier retraso en el pago del anticipo por parte del cliente modificara el plazo de fabricacion y la fecha estimada de entrega, sin que ello de lugar a cancelaciones ni devoluciones de anticipos.</li>
                        </ol>
                    </div>
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
            @page { margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { font-family: 'Inter', sans-serif; padding: 0; color: #333; margin: 0; }
            .cot-pdf { margin: 0; padding: 0; }

            /* Cover page */
            .cot-cover { width: 100%; height: 100vh; position: relative; overflow: hidden; page-break-after: always; }
            .cot-cover-bg { width: 100%; height: 100%; display: flex; flex-direction: column; }
            .cot-cover-dark { background: #ffffff !important; flex: 1; display: flex; align-items: flex-start; padding: 60px; position: relative; }
            .cot-cover-logo img { max-width: 320px; height: auto; }
            .cot-cover-diagonal { width: 100%; height: 80px; background: linear-gradient(165deg, #ffffff 48%, #C87533 48%) !important; }
            .cot-cover-orange { background: #C87533 !important; padding: 40px 60px; display: flex; justify-content: flex-end; align-items: flex-end; min-height: 180px; }
            .cot-cover-title { font-size: 3.5rem; font-weight: 900; color: #fff; letter-spacing: 3px; }

            /* Content page */
            .cot-page-content { max-width: 800px; margin: 0 auto; padding: 1.5rem 2rem; }
            .cot-pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
            .cot-pdf-logo img { max-width: 200px; height: auto; }
            .cot-pdf-folio { text-align: right; font-size: 0.8rem; color: #555; }
            .folio-number { font-size: 1.1rem; font-weight: 700; color: #1a1a2e; margin-bottom: 0.2rem; }
            .cot-pdf-divider { height: 3px; background: linear-gradient(90deg, #D2152B, #F47427); border-radius: 2px; margin-bottom: 1rem; }

            .cot-pdf-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1rem; }
            .cot-pdf-info-block h4 { color: #D2152B; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.3rem; border-bottom: 1px solid #eee; padding-bottom: 0.2rem; }
            .cot-pdf-info-block p { font-size: 0.78rem; line-height: 1.5; }

            .cot-pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
            .cot-pdf-table th { background: #F47427; color: white; padding: 0.45rem 0.6rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; }
            .cot-pdf-table td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; font-size: 0.78rem; }
            .cot-pdf-table tr:nth-child(even):not(.cot-summary-row) { background: #f8f9fa; }
            .cot-summary-row td { border-bottom: 1px solid #ddd; }

            .cot-pdf-info-footer { margin-top: 0.8rem; font-size: 0.78rem; color: #555; }

            .cot-pdf-terminos { background: #f8f9fa; border-radius: 6px; padding: 0.7rem 0.9rem; margin-top: 1rem; margin-bottom: 1rem; font-size: 0.6rem; color: #444; line-height: 1.45; }
            .cot-pdf-terminos h4 { color: #333; font-size: 0.72rem; font-weight: 800; text-align: center; margin-bottom: 0.5rem; }
            .cot-pdf-terminos ol { padding-left: 1rem; }
            .cot-pdf-terminos li { margin-bottom: 0.25rem; }

            @media print {
                body { padding: 0; margin: 0; }
                .cot-cover { height: 100vh; page-break-after: always; }
                .cot-page-content { padding: 0.8rem 1.5rem; }
            }
        </style>
        </head><body>
        ${content.outerHTML}
        <script>setTimeout(()=>{window.print();},600)<\/script>
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

// loadProveedores moved to consolidated section

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

// ==================== REQUISICIONES ====================

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
                <button class="btn btn-danger btn-sm" onclick="deleteRequisicion(${r.id})">Eliminar</button>
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
    row.style.cssText = "display:grid; grid-template-columns: 0.3fr 2fr 1.2fr 1.5fr 0.5fr 40px; gap:5px; margin-bottom:5px; align-items:center;";

    row.innerHTML = `
        <span style="text-align:center;font-weight:bold;color:#aaa;">${reqItemCounter}</span>
        <input type="text" placeholder="Componente" class="req-comp" style="width:100%" oninput="checkAutoProvider(this)">
        <input type="text" list="prov-list-${Date.now()}" placeholder="Proveedor" class="req-prov">
        <datalist id="prov-list-${Date.now()}">
             ${AVAILABLE_PROVIDERS.map(p => `<option value="${p.razon_social}">`).join('')}
        </datalist>
        <input type="text" placeholder="Comentarios" class="req-coment">
        <input type="number" placeholder="#" class="req-cant" value="1" min="0" step="0.1">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(row);
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
                    ${r.numero_serie ? `<p><strong>N/Serie:</strong> <span style="background:linear-gradient(135deg,#F47427,#e65100); color:#fff; padding:2px 10px; border-radius:4px; font-weight:700; letter-spacing:1px;">${r.numero_serie}</span></p>` : ''}
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
        let sendActionsHtml = '<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-top:10px;"><h4>Proveedores - Envíos y Rastreo</h4>';

        const enviosMap = {};
        (r.envios || []).forEach(e => { enviosMap[e.proveedor_nombre] = e; });

        Object.keys(itemsByProv).forEach(pName => {
            if (pName === 'Sin Asignar') return;
            const provTotal = itemsByProv[pName].reduce((s, i) => s + i.rowTotal, 0);
            const eqName = (r.equipo_nombre || '').replace(/'/g, "\\'");
            const envio = enviosMap[pName] || {};
            const est = envio.estado || 'Pendiente';
            const estColor = est === 'Recibido' ? '#28a745' : est === 'Enviado' ? '#F47427' : '#888';
            const pNameSafe = pName.replace(/'/g, "\\'");
            const pNameId = pName.replace(/[^a-zA-Z0-9]/g, '_');

            sendActionsHtml += `
                <div style="background:rgba(0,0,0,0.2); padding:10px; margin-bottom:8px; border-radius:6px; border-left:4px solid ${estColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="document.getElementById('envio-panel-${pNameId}').style.display = document.getElementById('envio-panel-${pNameId}').style.display === 'none' ? 'block' : 'none'">
                        <div>
                            <strong>${pName}</strong> (${itemsByProv[pName].length} partidas)
                            <span style="background:${estColor}; color:#fff; padding:2px 8px; border-radius:3px; font-size:0.7rem; font-weight:700; margin-left:8px;">${est}</span>
                            ${envio.guia_rastreo ? `<small style="color:#F47427; margin-left:8px;">📦 Guía: ${envio.guia_rastreo}</small>` : ''}
                        </div>
                        <div style="gap:5px; display:flex;">
                             <button class="btn btn-sm" style="background:#D2152B;color:#fff;" onclick="event.stopPropagation(); imprimirReqProveedor(${r.id}, '${pNameSafe}')" title="Generar PDF">PDF</button>
                             <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); enviarReqWhatsApp(${r.id}, '${pNameSafe}', '${eqName}')">WhatsApp</button>
                             <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); enviarReqEmail(${r.id}, '${pNameSafe}')">Email</button>
                        </div>
                    </div>
                    <div id="envio-panel-${pNameId}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Estado</label>
                                <select id="envio-estado-${pNameId}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:#fff;">
                                    <option value="Pendiente" ${est === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                    <option value="Enviado" ${est === 'Enviado' ? 'selected' : ''}>Enviado</option>
                                    <option value="Recibido" ${est === 'Recibido' ? 'selected' : ''}>Recibido</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Paquetería</label>
                                <input type="text" id="envio-paqueteria-${pNameId}" value="${envio.paqueteria || ''}" placeholder="Ej: Tres Guerras" style="padding:6px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;"># Guía de Rastreo</label>
                                <input type="text" id="envio-guia-${pNameId}" value="${envio.guia_rastreo || ''}" placeholder="Número de guía" style="padding:6px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Nombre de quien recoge</label>
                                <input type="text" id="envio-recoge-${pNameId}" value="${envio.nombre_recoge || ''}" placeholder="Nombre" style="padding:6px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Teléfono</label>
                                <input type="text" id="envio-tel-${pNameId}" value="${envio.telefono_recoge || ''}" placeholder="Teléfono" style="padding:6px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Notas</label>
                                <input type="text" id="envio-notas-${pNameId}" value="${envio.notas || ''}" placeholder="Observaciones" style="padding:6px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Fecha envío</label>
                                <input type="date" id="envio-fecha-envio-${pNameId}" value="${envio.fecha_envio || ''}" style="padding:6px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label style="font-size:0.75rem;">Fecha recibido</label>
                                <input type="date" id="envio-fecha-recibido-${pNameId}" value="${envio.fecha_recibido || ''}" style="padding:6px;">
                            </div>
                            <div style="display:flex; align-items:flex-end;">
                                <button class="btn btn-primary btn-sm" style="width:100%; padding:6px;" onclick="guardarEnvioProveedor(${r.id}, '${pNameSafe}', '${pNameId}')">💾 Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (Object.keys(itemsByProv).length === 0 || (Object.keys(itemsByProv).length === 1 && itemsByProv['Sin Asignar'])) {
            sendActionsHtml += '<p style="color:#888; font-style:italic;">Asigne proveedores a las partidas para ver opciones de envío.</p>';
        }
        sendActionsHtml += '</div>';

        // Consolidated PDF button
        const consolidatedPdfHtml = `
            <div style="background:rgba(210,21,43,0.1); padding:12px; border-radius:8px; margin-top:10px; border:1px solid rgba(210,21,43,0.3); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#D2152B;">PDF Consolidado</strong>
                    <small style="color:#888; display:block;">Todas las partidas con columnas P.Unit / IVA / Total para llenar a mano</small>
                </div>
                <button class="btn" style="background:#D2152B; color:#fff;" onclick="imprimirReqConsolidado(${r.id})">Generar PDF Consolidado</button>
            </div>
            <div style="background:rgba(244,116,39,0.1); padding:12px; border-radius:8px; margin-top:8px; border:1px solid rgba(244,116,39,0.3); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#F47427;">📦 Guía de Recogida</strong>
                    <small style="color:#888; display:block;">PDF con todas las guías de rastreo para enviar a quien recoge</small>
                </div>
                <button class="btn" style="background:#F47427; color:#fff;" onclick="generarPdfGuiasRecogida(${r.id})">Generar Guía</button>
            </div>
        `;

        // General Actions — estado is now auto-calculated but keep for manual override
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

        body.innerHTML = headerInfo + itemsHtml + sendActionsHtml + consolidatedPdfHtml + generalActions;

    } catch (e) {
        body.innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`;
        console.error(e);
    }
}

async function enviarReqWhatsApp(rid, provName, equipoNombre) {
    try {
        // 1. Fetch requisition detail to get items for this provider
        const reqRes = await fetch(`${API}/api/requisiciones/${rid}`);
        const reqData = await reqRes.json();
        const provItems = (reqData.items || []).filter(it =>
            (it.proveedor_nombre || '').toLowerCase() === provName.toLowerCase()
        );

        // 2. Find proveedor in API to get WhatsApp number
        const provRes = await fetch(`${API}/api/proveedores`);
        const proveedores = await provRes.json();
        const prov = (Array.isArray(proveedores) ? proveedores : []).find(p => p.razon_social === provName);

        if (!prov) {
            notify(`No se encontro el proveedor "${provName}" en la base de datos`, 'error');
            return;
        }

        // 3. Compose WhatsApp message with itemized list for THIS provider only
        const whatsapp = prov.whatsapp || prov.telefono || '';
        if (!whatsapp) {
            notify(`El proveedor "${provName}" no tiene WhatsApp registrado`, 'error');
            return;
        }
        const contacto = prov.contacto_nombre || provName;
        const proyecto = equipoNombre || 'proyecto en curso';
        const folio = reqData.folio || '';

        // Build material list
        let materialList = '';
        let totalProv = 0;
        provItems.forEach((it, idx) => {
            const cant = parseFloat(it.cantidad) || 0;
            const precio = parseFloat(it.precio_unitario) || 0;
            const sub = cant * precio;
            totalProv += it.tiene_iva ? sub * 1.16 : sub;
            materialList += `${idx + 1}. ${it.componente} — Cant: ${cant}${precio > 0 ? ` — P.U.: $${precio.toFixed(2)}` : ''}\n`;
        });

        const mensaje = `Hola ${contacto}, somos *DURTRON - Innovacion Industrial*.\n\nSolicitamos cotizacion de materiales para: *${proyecto}*\nRequisicion: *${folio}*\n\n*Material solicitado:*\n${materialList}\n${totalProv > 0 ? `_Total estimado: $${totalProv.toFixed(2)}_\n\n` : ''}Se adjunta documento con el detalle.\n\nFavor de responder con precios y tiempos de entrega.\n\nGracias.`;

        const tel = whatsapp.replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
        window.open(waUrl, '_blank');

    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ==================== PDF POR PROVEEDOR (REQUISICION) ====================
async function imprimirReqProveedor(rid, provName) {
    try {
        const reqRes = await fetch(`${API}/api/requisiciones/${rid}`);
        const reqData = await reqRes.json();
        const provItems = (reqData.items || []).filter(it =>
            (it.proveedor_nombre || '').toLowerCase() === provName.toLowerCase()
        );

        if (provItems.length === 0) {
            notify('No hay items para este proveedor', 'error');
            return;
        }

        const folio = reqData.folio || '-';
        const fecha = new Date(reqData.fecha_creacion).toLocaleDateString('es-MX');
        const proyecto = reqData.equipo_nombre || '-';
        const area = reqData.area || 'Departamento de Ingeniería';
        const noControl = reqData.no_control || '-';
        const numSerie = reqData.numero_serie || '-';
        const emitido = reqData.emitido_por || '-';
        const aprobado = reqData.aprobado_por || '-';
        const revisado = reqData.revisado_por || '-';
        const notas = reqData.notas || '';

        const itemsHtml = provItems.map((it, i) => {
            return `
                <tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${it.componente || ''}</td>
                    <td><small>${it.comentario || ''}</small></td>
                    <td style="text-align:center">${parseFloat(it.cantidad) || 0}</td>
                    <td style="text-align:center">${it.unidad || 'pza'}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <html><head>
            <title>Solicitud ${folio} - ${provName}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; padding: 0; color: #333; }
                .req-pdf { max-width: 800px; margin: 0 auto; padding: 2rem; }
                .req-pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .req-pdf-logo h1 { font-size: 2.2rem; font-weight: 800; color: #D2152B; letter-spacing: 2px; }
                .req-pdf-logo span { color: #F47427; font-size: 0.85rem; font-weight: 600; }
                .req-pdf-folio { text-align: right; font-size: 0.85rem; color: #555; }
                .folio-number { font-size: 1.2rem; font-weight: 700; color: #1a1a2e; margin-bottom: 0.3rem; }
                .req-pdf-divider { height: 4px; background: linear-gradient(90deg, #D2152B, #F47427); border-radius: 2px; margin-bottom: 1.5rem; }
                .req-pdf-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1.5rem; }
                .req-pdf-info-block h4 { color: #D2152B; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
                .req-pdf-info-block p { font-size: 0.85rem; line-height: 1.6; }
                .req-pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
                .req-pdf-table th { background: #1a1a2e; color: white; padding: 0.6rem 0.8rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .req-pdf-table td { padding: 0.5rem 0.8rem; border-bottom: 1px solid #eee; font-size: 0.82rem; }
                .req-pdf-table tr:nth-child(even) { background: #f8f9fa; }
                .serie-badge { display: inline-block; background: linear-gradient(135deg, #F47427, #e65100); color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 0.85rem; letter-spacing: 1px; margin-top: 5px; }
                .req-pdf-notas { background: #fffbeb; border-left: 3px solid #F47427; padding: 0.8rem 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; border-radius: 0 6px 6px 0; }
                .req-pdf-notas h4 { color: #F47427; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.3rem; }
                .req-pdf-footer { text-align: center; font-size: 0.75rem; color: #888; padding-top: 1rem; border-top: 1px solid #eee; }
                .req-pdf-instrucciones { background: #f0f7ff; border-left: 3px solid #1a1a2e; padding: 0.8rem 1rem; margin-bottom: 1.5rem; font-size: 0.8rem; border-radius: 0 6px 6px 0; }
                .req-pdf-instrucciones h4 { color: #1a1a2e; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.3rem; }
                @media print { body { padding: 0; } .req-pdf { padding: 1rem; } }
            </style>
            </head><body>
            <div class="req-pdf">
                <div class="req-pdf-header">
                    <div class="req-pdf-logo">
                        <h1>DURTRON</h1>
                        <span>Innovacion Industrial</span>
                    </div>
                    <div class="req-pdf-folio">
                        <div class="folio-number">${folio}</div>
                        <div>SOLICITUD DE COTIZACIÓN</div>
                        <div>Fecha: ${fecha}</div>
                    </div>
                </div>

                <div class="req-pdf-divider"></div>

                <div class="req-pdf-info-grid">
                    <div class="req-pdf-info-block">
                        <h4>Proveedor</h4>
                        <p><strong>${provName}</strong></p>
                    </div>
                    <div class="req-pdf-info-block">
                        <h4>Datos del Proyecto</h4>
                        <p><strong>Proyecto:</strong> ${proyecto}</p>
                        <p><strong>Área:</strong> ${area}</p>
                        <p><strong>No. Control:</strong> ${noControl}</p>
                        ${numSerie !== '-' ? `<p><strong>N/Serie:</strong> <span class="serie-badge">${numSerie}</span></p>` : ''}
                    </div>
                    <div class="req-pdf-info-block">
                        <h4>Autorizaciones</h4>
                        <p><strong>Emitido por:</strong> ${emitido}</p>
                        <p><strong>Aprobado por:</strong> ${aprobado}</p>
                        <p><strong>Revisado por:</strong> ${revisado}</p>
                    </div>
                    <div class="req-pdf-info-block">
                        <h4>Datos de DURTRON</h4>
                        <p><strong>DURTRON - Innovacion Industrial</strong></p>
                        <p>Av. del Sol #329, Durango, Dgo.</p>
                        <p>Tel: 618 134 1056</p>
                    </div>
                </div>

                <table class="req-pdf-table">
                    <thead>
                        <tr>
                            <th style="width:35px">#</th>
                            <th>Componente</th>
                            <th>Comentarios</th>
                            <th style="width:55px">Cant.</th>
                            <th style="width:55px">Unidad</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                ${notas ? `<div class="req-pdf-notas"><h4>Notas</h4><p>${notas}</p></div>` : ''}

                <div class="req-pdf-instrucciones">
                    <h4>Instrucciones</h4>
                    <p>Favor de responder a la brevedad con <strong>precios</strong>, <strong>tiempos de entrega</strong> y <strong>disponibilidad</strong> de los materiales listados.</p>
                </div>

                <div class="req-pdf-footer">
                    <p><strong>DURTRON - Innovacion Industrial</strong></p>
                    <p>Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056</p>
                    <p style="margin-top:0.5rem; font-style:italic;">Este documento es una solicitud de cotizacion. No representa un compromiso de compra.</p>
                </div>
            </div>
            <script>setTimeout(()=>{window.print();},500)<\/script>
            </body></html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();

    } catch (e) {
        notify('Error al generar PDF: ' + e.message, 'error');
    }
}

// ==================== PDF CONSOLIDADO (TODAS LAS PARTIDAS) ====================
async function imprimirReqConsolidado(rid) {
    try {
        const reqRes = await fetch(`${API}/api/requisiciones/${rid}`);
        const reqData = await reqRes.json();
        const allItems = reqData.items || [];

        if (allItems.length === 0) {
            notify('No hay partidas en esta requisicion', 'error');
            return;
        }

        const folio = reqData.folio || '-';
        const fecha = new Date(reqData.fecha_creacion).toLocaleDateString('es-MX');
        const proyecto = reqData.equipo_nombre || '-';
        const area = reqData.area || 'Departamento de Ingeniería';
        const noControl = reqData.no_control || '-';
        const numSerie = reqData.numero_serie || '-';
        const emitido = reqData.emitido_por || '-';
        const aprobado = reqData.aprobado_por || '-';
        const revisado = reqData.revisado_por || '-';
        const notas = reqData.notas || '';

        const itemsHtml = allItems.map((it, i) => {
            return `
                <tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${it.componente || ''}</td>
                    <td><small>${it.proveedor_nombre || '-'}</small></td>
                    <td><small>${it.comentario || ''}</small></td>
                    <td style="text-align:center">${parseFloat(it.cantidad) || 0}</td>
                    <td style="text-align:center">${it.unidad || 'pza'}</td>
                    <td style="text-align:right"></td>
                    <td style="text-align:center"></td>
                    <td style="text-align:right"></td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <html><head>
            <title>Requisicion Consolidada ${folio}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; padding: 0; color: #333; }
                .req-pdf { max-width: 850px; margin: 0 auto; padding: 2rem; }
                .req-pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .req-pdf-logo h1 { font-size: 2.2rem; font-weight: 800; color: #D2152B; letter-spacing: 2px; }
                .req-pdf-logo span { color: #F47427; font-size: 0.85rem; font-weight: 600; }
                .req-pdf-folio { text-align: right; font-size: 0.85rem; color: #555; }
                .folio-number { font-size: 1.2rem; font-weight: 700; color: #1a1a2e; margin-bottom: 0.3rem; }
                .req-pdf-divider { height: 4px; background: linear-gradient(90deg, #D2152B, #F47427); border-radius: 2px; margin-bottom: 1.5rem; }
                .req-pdf-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1.5rem; }
                .req-pdf-info-block h4 { color: #D2152B; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
                .req-pdf-info-block p { font-size: 0.85rem; line-height: 1.6; }
                .req-pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
                .req-pdf-table th { background: #1a1a2e; color: white; padding: 0.6rem 0.8rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .req-pdf-table td { padding: 0.5rem 0.8rem; border-bottom: 1px solid #eee; font-size: 0.8rem; }
                .req-pdf-table tr:nth-child(even) { background: #f8f9fa; }
                .serie-badge { display: inline-block; background: linear-gradient(135deg, #F47427, #e65100); color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 0.85rem; letter-spacing: 1px; margin-top: 5px; }
                .req-pdf-totals { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 1.5rem; }
                .req-total-row { display: flex; justify-content: space-between; width: 280px; padding: 0.4rem 0; font-size: 0.9rem; border-bottom: 1px solid #eee; }
                .req-total-final { border-top: 2px solid #1a1a2e; border-bottom: none; padding-top: 0.6rem; font-size: 1.1rem; color: #D2152B; }
                .req-pdf-notas { background: #fffbeb; border-left: 3px solid #F47427; padding: 0.8rem 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; border-radius: 0 6px 6px 0; }
                .req-pdf-notas h4 { color: #F47427; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.3rem; }
                .req-pdf-footer { text-align: center; font-size: 0.75rem; color: #888; padding-top: 1rem; border-top: 1px solid #eee; }
                .label-consolidado { display: inline-block; background: #D2152B; color: #fff; padding: 2px 10px; border-radius: 3px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                @media print { body { padding: 0; } .req-pdf { padding: 1rem; } }
            </style>
            </head><body>
            <div class="req-pdf">
                <div class="req-pdf-header">
                    <div class="req-pdf-logo">
                        <h1>DURTRON</h1>
                        <span>Innovacion Industrial</span>
                    </div>
                    <div class="req-pdf-folio">
                        <div class="folio-number">${folio}</div>
                        <div><span class="label-consolidado">CONSOLIDADO</span></div>
                        <div>REQUISICION DE MATERIALES</div>
                        <div>Fecha: ${fecha}</div>
                    </div>
                </div>

                <div class="req-pdf-divider"></div>

                <div class="req-pdf-info-grid">
                    <div class="req-pdf-info-block">
                        <h4>Datos del Proyecto</h4>
                        <p><strong>Proyecto:</strong> ${proyecto}</p>
                        <p><strong>Área:</strong> ${area}</p>
                        <p><strong>No. Control:</strong> ${noControl}</p>
                        ${numSerie !== '-' ? `<p><strong>N/Serie:</strong> <span class="serie-badge">${numSerie}</span></p>` : ''}
                    </div>
                    <div class="req-pdf-info-block">
                        <h4>Autorizaciones</h4>
                        <p><strong>Emitido por:</strong> ${emitido}</p>
                        <p><strong>Aprobado por:</strong> ${aprobado}</p>
                        <p><strong>Revisado por:</strong> ${revisado}</p>
                    </div>
                    <div class="req-pdf-info-block">
                        <h4>Datos de DURTRON</h4>
                        <p><strong>DURTRON - Innovacion Industrial</strong></p>
                        <p>Av. del Sol #329, Durango, Dgo.</p>
                        <p>Tel: 618 134 1056</p>
                    </div>
                </div>

                <table class="req-pdf-table">
                    <thead>
                        <tr>
                            <th style="width:30px">#</th>
                            <th>Componente</th>
                            <th>Proveedor</th>
                            <th>Comentarios</th>
                            <th style="width:45px">Cant.</th>
                            <th style="width:50px">Unidad</th>
                            <th style="width:90px">P. Unit.</th>
                            <th style="width:45px">IVA</th>
                            <th style="width:100px">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <div class="req-pdf-totals">
                    <div class="req-total-row">
                        <span>Subtotal:</span>
                        <strong></strong>
                    </div>
                    <div class="req-total-row req-total-final">
                        <span>TOTAL:</span>
                        <strong></strong>
                    </div>
                </div>

                ${notas ? `<div class="req-pdf-notas"><h4>Notas</h4><p>${notas}</p></div>` : ''}

                <div class="req-pdf-footer">
                    <p><strong>DURTRON - Innovacion Industrial</strong></p>
                    <p>Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056</p>
                    <p style="margin-top:0.5rem; font-style:italic;">Documento interno. Llenar precios y totales segun cotizaciones recibidas.</p>
                </div>
            </div>
            <script>setTimeout(()=>{window.print();},500)<\/script>
            </body></html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();

    } catch (e) {
        notify('Error al generar PDF consolidado: ' + e.message, 'error');
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

async function guardarEnvioProveedor(rid, provName, pNameId) {
    try {
        const data = {
            proveedor_nombre: provName,
            estado: document.getElementById(`envio-estado-${pNameId}`).value,
            paqueteria: document.getElementById(`envio-paqueteria-${pNameId}`).value,
            guia_rastreo: document.getElementById(`envio-guia-${pNameId}`).value,
            nombre_recoge: document.getElementById(`envio-recoge-${pNameId}`).value,
            telefono_recoge: document.getElementById(`envio-tel-${pNameId}`).value,
            notas: document.getElementById(`envio-notas-${pNameId}`).value,
            fecha_envio: document.getElementById(`envio-fecha-envio-${pNameId}`).value,
            fecha_recibido: document.getElementById(`envio-fecha-recibido-${pNameId}`).value
        };
        const res = await fetch(`${API}/api/requisiciones/${rid}/envios`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            notify(`Envío de ${provName} actualizado`, 'success');
            verRequisicion(rid); // Refresh detail view
        } else {
            notify(result.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function generarPdfGuiasRecogida(rid) {
    try {
        const reqRes = await fetch(`${API}/api/requisiciones/${rid}`);
        const reqData = await reqRes.json();
        const envios = (reqData.envios || []).filter(e => e.guia_rastreo);

        if (envios.length === 0) {
            notify('No hay guías de rastreo registradas. Registre al menos una guía en un proveedor.', 'error');
            return;
        }

        const folio = reqData.folio || '-';
        const fecha = new Date().toLocaleDateString('es-MX');
        const proyecto = reqData.equipo_nombre || '-';
        const numSerie = reqData.numero_serie || '';

        // Group by who picks up
        const recogeMap = {};
        envios.forEach(e => {
            const key = e.nombre_recoge || 'Sin asignar';
            if (!recogeMap[key]) recogeMap[key] = { tel: e.telefono_recoge || '', guias: [] };
            recogeMap[key].guias.push(e);
        });

        let guiasHtml = '';
        Object.keys(recogeMap).forEach(nombre => {
            const info = recogeMap[nombre];
            guiasHtml += `
                <div style="margin-bottom:1.5rem;">
                    <div style="background:#1a1a2e; color:#fff; padding:8px 12px; border-radius:6px 6px 0 0; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:1rem;">👤 ${nombre}</strong>
                            ${info.tel ? `<span style="color:#F47427; margin-left:10px;">📱 ${info.tel}</span>` : ''}
                        </div>
                        <span style="background:#F47427; color:#fff; padding:2px 8px; border-radius:3px; font-size:0.75rem;">${info.guias.length} guía(s)</span>
                    </div>
                    <table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
                        <thead>
                            <tr style="background:#f0f0f0;">
                                <th style="padding:8px; text-align:left; font-size:0.8rem; border-bottom:2px solid #ddd;">Proveedor</th>
                                <th style="padding:8px; text-align:left; font-size:0.8rem; border-bottom:2px solid #ddd;">Paquetería</th>
                                <th style="padding:8px; text-align:left; font-size:0.8rem; border-bottom:2px solid #ddd;"># Guía de Rastreo</th>
                                <th style="padding:8px; text-align:center; font-size:0.8rem; border-bottom:2px solid #ddd;">Estado</th>
                                <th style="padding:8px; text-align:left; font-size:0.8rem; border-bottom:2px solid #ddd;">Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${info.guias.map(g => {
                const estColor = g.estado === 'Recibido' ? '#28a745' : g.estado === 'Enviado' ? '#F47427' : '#888';
                return `
                                    <tr style="border-bottom:1px solid #eee;">
                                        <td style="padding:8px; font-weight:600;">${g.proveedor_nombre}</td>
                                        <td style="padding:8px;">${g.paqueteria || '-'}</td>
                                        <td style="padding:8px;"><strong style="font-size:1.1rem; color:#D2152B; letter-spacing:1px;">${g.guia_rastreo}</strong></td>
                                        <td style="padding:8px; text-align:center;"><span style="background:${estColor}; color:#fff; padding:2px 8px; border-radius:3px; font-size:0.7rem;">${g.estado}</span></td>
                                        <td style="padding:8px; font-size:0.85rem; color:#666;">${g.notas || '-'}</td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        const htmlContent = `
            <html><head>
            <title>Guías de Recogida - ${folio}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; padding: 0; color: #333; }
                .guia-pdf { max-width: 800px; margin: 0 auto; padding: 2rem; }
                @media print { body { padding: 0; } .guia-pdf { padding: 1rem; } }
            </style>
            </head><body>
            <div class="guia-pdf">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
                    <div>
                        <h1 style="font-size:2rem; font-weight:800; color:#D2152B; letter-spacing:2px;">DURTRON</h1>
                        <span style="color:#F47427; font-size:0.85rem; font-weight:600;">Innovacion Industrial</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.2rem; font-weight:700; color:#1a1a2e;">${folio}</div>
                        <div style="font-size:0.85rem; color:#555;">GUÍAS DE RECOGIDA</div>
                        <div style="font-size:0.85rem; color:#555;">Fecha: ${fecha}</div>
                    </div>
                </div>

                <div style="height:4px; background:linear-gradient(90deg,#D2152B,#F47427); border-radius:2px; margin-bottom:1.5rem;"></div>

                <div style="background:#f8f9fa; padding:12px; border-radius:6px; margin-bottom:1.5rem; display:flex; justify-content:space-between;">
                    <div>
                        <strong>Proyecto:</strong> ${proyecto}
                        ${numSerie ? `<span style="background:linear-gradient(135deg,#F47427,#e65100); color:#fff; padding:2px 10px; border-radius:4px; font-weight:700; font-size:0.85rem; margin-left:8px;">${numSerie}</span>` : ''}
                    </div>
                    <div><strong>Total guías:</strong> ${envios.length}</div>
                </div>

                ${guiasHtml}

                <div style="margin-top:2rem; padding:15px; background:#fffbeb; border-left:3px solid #F47427; border-radius:0 6px 6px 0;">
                    <strong style="color:#F47427; font-size:0.8rem;">INSTRUCCIONES</strong>
                    <p style="font-size:0.85rem; margin-top:5px;">Recoger los paquetes de las paqueterías indicadas. Verificar el número de guía al momento de la recogida. Confirmar recepción con el área de compras.</p>
                </div>

                <div style="text-align:center; font-size:0.75rem; color:#888; padding-top:1.5rem; margin-top:1.5rem; border-top:1px solid #eee;">
                    <p><strong>DURTRON - Innovacion Industrial</strong></p>
                    <p>Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056</p>
                </div>
            </div>
            <script>setTimeout(()=>{window.print();},500)<\/script>
            </body></html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();

    } catch (e) {
        notify('Error al generar guía de recogida: ' + e.message, 'error');
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

// ==================== ETIQUETAS STANDALONE ====================
function populateEtiquetaStandaloneDropdown() {
    const sel = document.getElementById('etq-equipo-select-standalone');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Seleccionar equipo del catalogo --</option>';
    equiposCatalogo.forEach(eq => {
        sel.innerHTML += `<option value="${eq.id}">${eq.codigo || ''} - ${eq.nombre}</option>`;
    });
}

async function autoFillEtiquetaStandalone(equipoId) {
    if (!equipoId) return;
    try {
        const r = await fetch(`${API}/api/equipos/${equipoId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const eq = await r.json();
        document.getElementById('etq-equipo-s').value = eq.nombre || '';
        document.getElementById('etq-modelo-s').value = eq.modelo || '';
        document.getElementById('etq-capacidad-s').value = eq.capacidad || '';
        document.getElementById('etq-potencia-s').value = eq.potencia_motor || '';
        document.getElementById('etq-apertura-s').value = eq.apertura || '';
        document.getElementById('etq-tamano-s').value = eq.tamano_alimentacion || '';
        document.getElementById('etq-peso-s').value = eq.peso || '';
        document.getElementById('etq-fecha-fab-s').value = new Date().toISOString().split('T')[0];

        // Generate serial number
        const modelo = eq.modelo || eq.nombre || 'EQ';
        const prefix = modelo.replace(/\s+/g, '').toUpperCase();
        let counters = JSON.parse(localStorage.getItem('durtron_serial_counters') || '{}');
        counters[prefix] = (counters[prefix] || 0) + 1;
        localStorage.setItem('durtron_serial_counters', JSON.stringify(counters));
        const serial = `${prefix}-DT${counters[prefix]}`;
        document.getElementById('etq-serie-s').value = serial;
        dibujarEtiquetaPreview();
    } catch (e) {
        notify('Error al cargar equipo: ' + e.message, 'error');
    }
}

function getEtiquetaDataStandalone() {
    return {
        equipo: document.getElementById('etq-equipo-s').value || '',
        modelo: document.getElementById('etq-modelo-s').value || '',
        capacidad: document.getElementById('etq-capacidad-s').value || '',
        potencia: document.getElementById('etq-potencia-s').value || '',
        apertura: document.getElementById('etq-apertura-s').value || '',
        tamano_alim: document.getElementById('etq-tamano-s').value || '',
        peso: document.getElementById('etq-peso-s').value || '',
        fecha_fab: document.getElementById('etq-fecha-fab-s').value || '',
        numero_serie: document.getElementById('etq-serie-s').value || ''
    };
}
// ==================== ETIQUETA CANVAS SYSTEM (3000x1500px) ====================
let etiquetaLogoImg = null;
(function preloadLogo() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        // Convert to black/white for engraving - lower threshold to catch orange/red
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx2 = c.getContext('2d');
        ctx2.drawImage(img, 0, 0);
        const imgData = ctx2.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const alpha = d[i + 3];
            if (alpha < 30) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255; continue; }
            const gray = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
            const bw = gray < 200 ? 0 : 255;
            d[i] = bw; d[i + 1] = bw; d[i + 2] = bw; d[i + 3] = 255;
        }
        ctx2.putImageData(imgData, 0, 0);
        etiquetaLogoImg = c;
        dibujarEtiquetaPreview();
    };
    img.src = 'logo.png';
})();

function dibujarEtiquetaPreview() {
    const canvas = document.getElementById('etiqueta-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 3000, H = 1500;

    // Clear - white background, no border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Draw logo (top-left) - bigger
    if (etiquetaLogoImg) {
        const logoH = 300;
        const logoW = (etiquetaLogoImg.width / etiquetaLogoImg.height) * logoH;
        ctx.drawImage(etiquetaLogoImg, 80, 60, logoW, logoH);
    }

    // Quality badge (top-right) - draw checkmark circle
    const badgeX = 2100, badgeY = 80;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY + 30, 38, 0, Math.PI * 2);
    ctx.stroke();
    // Checkmark inside
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(badgeX - 15, badgeY + 30);
    ctx.lineTo(badgeX - 3, badgeY + 42);
    ctx.lineTo(badgeX + 18, badgeY + 14);
    ctx.stroke();
    // Scalloped edge (decorative dots)
    ctx.fillStyle = '#000';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath();
        ctx.arc(badgeX + Math.cos(a) * 48, badgeY + 30 + Math.sin(a) * 48, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText('Calidad Industrial', badgeX + 70, badgeY + 45);

    // Pin icon + location
    const locY = badgeY + 120;
    ctx.beginPath();
    ctx.arc(badgeX + 5, locY - 10, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(badgeX - 18, locY);
    ctx.lineTo(badgeX + 5, locY + 35);
    ctx.lineTo(badgeX + 28, locY);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(badgeX + 5, locY - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText('Durtron Planta 1 Durango', badgeX + 70, locY + 15);

    // Get form data
    const data = getEtiquetaDataStandalone();

    // Field layout - 3 columns x 3 rows matching reference
    const fields = [
        { label: 'Equipo', value: data.equipo, col: 0, row: 0 },
        { label: 'Apertura', value: data.apertura, col: 1, row: 0 },
        { label: 'Peso del Equipo', value: data.peso, col: 2, row: 0 },
        { label: 'Modelo', value: data.modelo, col: 0, row: 1 },
        { label: 'Tamaño de Alimentación', value: data.tamano_alim, col: 1, row: 1 },
        { label: 'Fecha de Fabricación', value: data.fecha_fab, col: 2, row: 1 },
        { label: 'Capacidad', value: data.capacidad, col: 0, row: 2 },
        { label: 'Potencia', value: data.potencia, col: 1, row: 2 },
        { label: 'Número de Serie', value: data.numero_serie, col: 2, row: 2 },
    ];

    const startX = 80, startY = 450;
    const colW = 940, rowH = 240;
    const boxW = 830, boxH = 80;

    fields.forEach(f => {
        const x = startX + f.col * colW;
        const y = startY + f.row * rowH;

        // Label (italic)
        ctx.fillStyle = '#000';
        ctx.font = 'italic 44px Inter, sans-serif';
        ctx.fillText(f.label, x, y);

        // Rounded rectangle box
        const bx = x, by = y + 18, br = 14;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + boxW - br, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + br);
        ctx.lineTo(bx + boxW, by + boxH - br);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - br, by + boxH);
        ctx.lineTo(bx + br, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - br);
        ctx.lineTo(bx, by + br);
        ctx.quadraticCurveTo(bx, by, bx + br, by);
        ctx.closePath();
        ctx.stroke();

        // Value text inside box
        ctx.font = 'bold 46px Inter, sans-serif';
        ctx.fillText(f.value || '', bx + 18, by + boxH - 20);
    });

    // Contact bar (bottom) - tight to content
    const contactY = startY + 3 * rowH + 60;
    ctx.fillStyle = '#000';

    // Divider line
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, contactY - 20);
    ctx.lineTo(W - 80, contactY - 20);
    ctx.stroke();

    // Phone icon
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(160, contactY + 25, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = '52px sans-serif';
    ctx.fillText('✆', 134, contactY + 44);
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText('6181341056', 230, contactY + 42);

    // Email icon
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(1100, contactY + 25, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '50px sans-serif';
    ctx.fillText('✉', 1075, contactY + 42);
    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.fillText('contacto@durtron.com', 1170, contactY + 42);

    // Web icon
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(2100, contactY + 25, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '52px sans-serif';
    ctx.fillText('⊕', 2076, contactY + 44);
    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.fillText('www.durtron.com', 2170, contactY + 42);
}

function descargarEtiquetaPNG() {
    const d = getEtiquetaDataStandalone();
    if (!d.equipo) { notify('Selecciona un equipo primero', 'error'); return; }
    dibujarEtiquetaPreview();
    const canvas = document.getElementById('etiqueta-canvas');
    const link = document.createElement('a');
    link.download = `Etiqueta_${(d.numero_serie || d.equipo || 'equipo').replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function descargarEtiquetaStandalone() {
    const d = getEtiquetaDataStandalone();
    if (!d.equipo) { notify('Selecciona un equipo primero', 'error'); return; }
    // Reuse the same PDF generation logic as descargarEtiquetaReq
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head>
        <title>Etiqueta ${d.equipo} - ${d.numero_serie || ''}</title>
        <style>
            body { margin:0; padding:20px; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f0f0; }
            .etiqueta {
                width:450px; background:#fff; border:3px solid #1a1a2e; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.15);
            }
            .etiqueta-header {
                background:linear-gradient(135deg,#1a1a2e,#16213e); color:#fff; padding:15px 20px; text-align:center;
            }
            .etiqueta-header h2 { margin:0; font-size:1.4rem; letter-spacing:2px; }
            .etiqueta-header p { margin:3px 0 0; font-size:0.75rem; opacity:0.7; }
            .etiqueta-body { padding:20px; }
            .etiqueta-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; font-size:0.85rem; }
            .etiqueta-row:last-child { border-bottom:none; }
            .etiqueta-label { font-weight:600; color:#555; }
            .etiqueta-value { color:#1a1a2e; font-weight:500; text-align:right; }
            .serie-box {
                margin-top:10px; padding:10px; background:linear-gradient(135deg,#F47427,#e65100); color:#fff; border-radius:8px; text-align:center; font-size:1.1rem; font-weight:bold; letter-spacing:2px;
            }
            .etiqueta-footer { background:#f8f8f8; padding:8px 20px; text-align:center; font-size:0.65rem; color:#999; border-top:1px solid #eee; }
            @media print {
                body { background:#fff; padding:0; }
                .etiqueta { border: 2px solid #000; box-shadow: none; }
            }
        </style>
        </head><body>
        <div class="etiqueta">
            <div class="etiqueta-header">
                <h2>DURTRON</h2>
                <p>Innovación Industrial</p>
            </div>
            <div class="etiqueta-body">
                <div class="etiqueta-row"><span class="etiqueta-label">Equipo</span><span class="etiqueta-value">${d.equipo}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Modelo</span><span class="etiqueta-value">${d.modelo || '-'}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Capacidad</span><span class="etiqueta-value">${d.capacidad || '-'}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Potencia Motor</span><span class="etiqueta-value">${d.potencia || '-'}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Apertura</span><span class="etiqueta-value">${d.apertura || '-'}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Tamaño Alimentación</span><span class="etiqueta-value">${d.tamano || '-'}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Peso</span><span class="etiqueta-value">${d.peso || '-'}</span></div>
                <div class="etiqueta-row"><span class="etiqueta-label">Fecha de Fabricación</span><span class="etiqueta-value">${d.fecha_fab || '-'}</span></div>
                ${d.numero_serie ? `<div class="serie-box">N/S: ${d.numero_serie}</div>` : ''}
            </div>
            <div class="etiqueta-footer">Av. del Sol #329, Durango, Dgo. | Tel: 618 134 1056 | DURTRON © ${new Date().getFullYear()}</div>
        </div>
        <script>setTimeout(()=>window.print(),500)<\/script>
        </body></html>
    `);
    w.document.close();
}

async function enviarEtiquetaEmailStandalone() {
    const email = document.getElementById('etq-email-s').value;
    if (!email) { notify('Ingresa un email destino', 'error'); return; }
    const data = getEtiquetaDataStandalone();
    if (!data.equipo) { notify('Selecciona un equipo primero', 'error'); return; }
    if (!confirm(`¿Enviar etiqueta de "${data.equipo}" a ${email}?`)) return;
    try {
        const res = await fetch(`${API}/api/enviar-etiqueta-standalone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, email })
        });
        const result = await res.json();
        if (result.success) {
            notify('Etiqueta enviada exitosamente', 'success');
        } else {
            notify(result.error || 'Error al enviar etiqueta', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

// ==================== ETIQUETA DESDE REQUISICION ====================
async function autoFillEtiqueta(equipoId) {
    if (!equipoId) return;
    try {
        // Fetch full equipment details
        const res = await fetch(`${API}/api/equipos/${equipoId}`);
        const eq = await res.json();

        // Auto-fill all fields
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('etq-equipo', eq.nombre || '');
        setVal('etq-modelo', eq.modelo || '');
        setVal('etq-capacidad', eq.capacidad || '');
        setVal('etq-potencia', eq.potencia_motor || '');
        setVal('etq-apertura', eq.apertura || '');
        setVal('etq-tamano', eq.tamano_alimentacion || '');
        setVal('etq-peso', eq.peso || '');
        if (eq.fecha_fabricacion) {
            setVal('etq-fecha-fab', eq.fecha_fabricacion.substring(0, 10));
        }

        // Auto-generate serial number (separate try/catch so equipo data still shows)
        let serialStr = '-';
        try {
            const serialRes = await fetch(`${API}/api/equipos/${equipoId}/serial`);
            if (serialRes.ok) {
                const serialData = await serialRes.json();
                if (serialData.serial) {
                    setVal('etq-serie', serialData.serial);
                    serialStr = serialData.serial;
                }
            } else {
                console.warn('Serial endpoint returned', serialRes.status);
            }
        } catch (serialErr) {
            console.warn('Error generando serial:', serialErr.message);
        }

        notify(`Datos del equipo "${eq.nombre}" cargados. Serie: ${serialStr}`, 'success');
    } catch (e) {
        notify('Error cargando equipo: ' + e.message, 'error');
    }
}

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

// Serial number management functions
async function resetLastSerial() {
    const select = document.getElementById('etq-equipo-select');
    if (!select || !select.value) {
        notify('Primero selecciona un equipo del catálogo', 'error');
        return;
    }
    if (!confirm('¿Quitar el último número de serie generado para este equipo? El contador se decrementará en 1.')) return;

    try {
        const res = await fetch(`${API}/api/equipos/${select.value}/serial`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            const newSerial = data.counter > 0 ? `${data.equipo_codigo}-${String(data.counter).padStart(3, '0')}` : '(sin seriales)';
            document.getElementById('etq-serie').value = data.counter > 0 ? newSerial : '';
            notify(`Serial decrementado. Contador actual: ${data.counter} (${data.equipo_codigo})`, 'success');
        } else {
            notify(data.error || 'Error al resetear serial', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

async function mostrarAdminSeriales() {
    const panel = document.getElementById('admin-seriales-panel');
    if (!panel) return;

    if (panel.style.display !== 'none') {
        panel.style.display = 'none';
        return;
    }

    panel.innerHTML = '<p style="color:#888;">Cargando contadores...</p>';
    panel.style.display = 'block';

    try {
        const res = await fetch(`${API}/api/serial-counters`);
        const counters = await res.json();

        if (!counters.length) {
            panel.innerHTML = '<p style="color:#888;">No hay contadores de serie registrados.</p>';
            return;
        }

        let html = '<table style="width:100%; font-size:0.85rem; border-collapse:collapse;">';
        html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.15);">';
        html += '<th style="text-align:left; padding:6px;">Equipo</th>';
        html += '<th style="text-align:left; padding:6px;">Código</th>';
        html += '<th style="text-align:center; padding:6px;">Último #</th>';
        html += '<th style="text-align:center; padding:6px;">Resetear a</th>';
        html += '<th style="text-align:center; padding:6px;">Acción</th>';
        html += '</tr></thead><tbody>';

        counters.forEach(c => {
            html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.08);">`;
            html += `<td style="padding:6px;">${c.nombre || '-'}</td>`;
            html += `<td style="padding:6px; color:#F47427;">${c.equipo_codigo}</td>`;
            html += `<td style="text-align:center; padding:6px; font-weight:bold;">${c.last_serial}</td>`;
            html += `<td style="text-align:center; padding:6px;">
                <input type="number" id="serial-reset-${c.equipo_id}" value="0" min="0" max="${c.last_serial}" style="width:60px; padding:3px; border-radius:3px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:#fff; text-align:center;">
            </td>`;
            html += `<td style="text-align:center; padding:6px;">
                <button class="btn" onclick="resetSerialTo(${c.equipo_id}, '${c.equipo_codigo}')" style="background:#D2152B; color:#fff; padding:3px 10px; font-size:0.75rem;">Resetear</button>
            </td>`;
            html += `</tr>`;
        });

        html += '</tbody></table>';
        panel.innerHTML = html;
    } catch (e) {
        panel.innerHTML = `<p style="color:#ff4444;">Error: ${e.message}</p>`;
    }
}

async function resetSerialTo(equipoId, equipoCodigo) {
    const input = document.getElementById(`serial-reset-${equipoId}`);
    const targetVal = parseInt(input?.value || '0');
    if (!confirm(`¿Resetear el contador de "${equipoCodigo}" a ${targetVal}? Los seriales del ${targetVal + 1} en adelante se considerarán eliminados.`)) return;

    try {
        const res = await fetch(`${API}/api/equipos/${equipoId}/serial?target=${targetVal}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            notify(`Contador de ${equipoCodigo} reseteado a ${data.counter}`, 'success');
            mostrarAdminSeriales(); // Refresh panel
        } else {
            notify(data.error || 'Error', 'error');
        }
    } catch (e) {
        notify('Error: ' + e.message, 'error');
    }
}

function descargarEtiquetaReq(rid) {
    const d = getEtiquetaData();
    if (!d.equipo) {
        notify('Selecciona un equipo o ingresa el nombre', 'error');
        return;
    }

    const fechaFab = d.fecha_fabricacion ? new Date(d.fecha_fabricacion + 'T00:00:00').toLocaleDateString('es-MX') : '-';

    const htmlContent = `
        <html><head>
        <title>Etiqueta ${d.equipo} - ${d.numero_serie || ''}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
            .etiqueta {
                width: 750px; background: #fff; border: 2px solid #000; border-radius: 12px;
                padding: 30px; position: relative;
            }
            .etq-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #000;
            }
            .etq-logo h1 {
                font-size: 2.5rem; font-weight: 800; color: #000; letter-spacing: 3px;
                display: flex; align-items: center; gap: 12px;
            }
            .etq-logo img {
                height: 70px; width: auto;
            }
            .etq-badges { text-align: right; font-size: 0.85rem; }
            .etq-badge { display: flex; align-items: center; gap: 6px; justify-content: flex-end; margin-bottom: 4px; font-weight: 600; }
            .etq-badge-icon { font-size: 1.2rem; }
            .etq-grid {
                display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;
                margin-bottom: 20px;
            }
            .etq-field label {
                font-size: 0.78rem; color: #555; font-style: italic; display: block; margin-bottom: 3px;
            }
            .etq-field .etq-value {
                border: 1.5px solid #000; border-radius: 6px; padding: 6px 10px;
                font-size: 0.9rem; font-weight: 600; min-height: 32px; background: #fff;
            }
            .etq-footer {
                display: flex; justify-content: space-between; align-items: center;
                padding-top: 15px; border-top: 1.5px solid #000;
                font-size: 0.82rem; color: #333;
            }
            .etq-footer-item { display: flex; align-items: center; gap: 6px; }
            .etq-footer-icon { font-size: 1.1rem; }
            @media print {
                body { background: #fff; min-height: auto; }
                .etiqueta { border: 2px solid #000; box-shadow: none; }
            }
        </style>
        </head><body>
        <div class="etiqueta">
            <div class="etq-header">
                <div class="etq-logo">
                    <img src="${typeof DURTRON_LOGO_B64 !== 'undefined' ? DURTRON_LOGO_B64 : ''}" alt="DURTRON">
                </div>
                <div class="etq-badges">
                    <div class="etq-badge"><span class="etq-badge-icon">*</span> Calidad Industrial</div>
                    <div class="etq-badge"><span class="etq-badge-icon">*</span> Durtron Planta 1 Durango</div>
                </div>
            </div>

            <div class="etq-grid">
                <div class="etq-field"><label>Equipo</label><div class="etq-value">${d.equipo}</div></div>
                <div class="etq-field"><label>Apertura</label><div class="etq-value">${d.apertura || '-'}</div></div>
                <div class="etq-field"><label>Peso del Equipo</label><div class="etq-value">${d.peso || '-'}</div></div>
                <div class="etq-field"><label>Modelo</label><div class="etq-value">${d.modelo || '-'}</div></div>
                <div class="etq-field"><label>Tama\u00f1o de Alimentaci\u00f3n</label><div class="etq-value">${d.tamano_alimentacion || '-'}</div></div>
                <div class="etq-field"><label>Fecha de Fabricaci\u00f3n</label><div class="etq-value">${fechaFab}</div></div>
                <div class="etq-field"><label>Capacidad</label><div class="etq-value">${d.capacidad || '-'}</div></div>
                <div class="etq-field"><label>Potencia</label><div class="etq-value">${d.potencia || '-'}</div></div>
                <div class="etq-field"><label>N\u00famero de Serie</label><div class="etq-value" style="color:#D2152B; font-weight:800;">${d.numero_serie || '-'}</div></div>
            </div>

            <div class="etq-footer">
                <div class="etq-footer-item"><span class="etq-footer-icon">Tel:</span> 6181341056</div>
                <div class="etq-footer-item"><span class="etq-footer-icon">Email:</span> contacto@durtron.com</div>
                <div class="etq-footer-item"><span class="etq-footer-icon">Web:</span> www.durtron.com</div>
            </div>
        </div>
        <script>setTimeout(()=>{window.print();},600)<\/script>
        </body></html>
    `;

    const win = window.open('', '_blank');
    win.document.write(htmlContent);
    win.document.close();
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
