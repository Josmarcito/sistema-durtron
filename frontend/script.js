// ===== CONFIGURACIÓN =====
const API_URL = window.location.origin;

// ===== ESTADO GLOBAL =====
let equipos = [];
let ventas = [];
let config = {};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupForms();
    setupModals();

    // Cargar configuración
    await loadConfig();

    // Cargar datos iniciales
    await loadDashboard();
    await loadInventory();
    await loadSales();
}

// ===== NAVEGACIÓN =====
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            showSection(section);

            // Update active button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// ===== CONFIGURACIÓN =====
async function loadConfig() {
    try {
        const response = await fetch(`${API_URL}/api/config`);
        config = await response.json();

        // Llenar selects
        populateSelect('input-estado', config.estados);
        populateSelect('input-ubicacion', config.ubicaciones);
        populateSelect('input-categoria', config.categorias);
        populateSelect('filter-estado', config.estados);
        populateSelect('filter-categoria', config.categorias);
        populateSelect('venta-forma-pago', config.formas_pago);

    } catch (error) {
        console.error('Error cargando configuración:', error);
        showNotification('Error al cargar la configuración', 'error');
    }
}

function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Mantener primera opción si existe
    const firstOption = select.querySelector('option');
    select.innerHTML = '';

    if (firstOption && firstOption.value === '') {
        select.appendChild(firstOption);
    }

    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/api/dashboard`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Verificar si hay error en la respuesta
        if (data.error) {
            throw new Error(data.error);
        }

        // Actualizar stats cards
        document.getElementById('stat-total').textContent = data.total_equipos || 0;
        document.getElementById('stat-disponibles').textContent = data.equipos_disponibles || 0;
        document.getElementById('stat-ventas-mes').textContent = data.total_ventas || 0;
        document.getElementById('stat-ingresos').textContent = formatMoney(data.ingresos_totales || 0);

        // Limpiar secciones de stats
        const statsEstado = document.getElementById('stats-estado');
        const statsUbicacion = document.getElementById('stats-ubicacion');

        if (statsEstado) statsEstado.innerHTML = '<div class="stat-item"><span class="stat-item-label">Sin datos</span></div>';
        if (statsUbicacion) statsUbicacion.innerHTML = '<div class="stat-item"><span class="stat-item-label">Sin datos</span></div>';

    } catch (error) {
        console.error('Error cargando dashboard:', error);
        showNotification(`Error al cargar el dashboard: ${error.message}`, 'error');

        // Mostrar valores en 0 en caso de error
        document.getElementById('stat-total').textContent = '0';
        document.getElementById('stat-disponibles').textContent = '0';
        document.getElementById('stat-ventas-mes').textContent = '0';
        document.getElementById('stat-ingresos').textContent = '$0';
    }
}

// ===== INVENTARIO =====
async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/api/equipos`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Verificar si hay error en la respuesta
        if (data.error) {
            throw new Error(data.error);
        }

        equipos = Array.isArray(data) ? data : [];

        renderInventory(equipos);
        setupInventoryFilters();

    } catch (error) {
        console.error('Error cargando inventario:', error);
        document.getElementById('inventory-tbody').innerHTML = `
            <tr><td colspan="9" class="loading">❌ Error al cargar el inventario: ${error.message}</td></tr>
        `;
        showNotification(`Error al cargar inventario: ${error.message}`, 'error');
    }
}

function renderInventory(equiposToRender) {
    const tbody = document.getElementById('inventory-tbody');

    if (equiposToRender.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="loading">No hay equipos registrados</td></tr>
        `;
        return;
    }

    tbody.innerHTML = equiposToRender.map(equipo => `
        <tr>
            <td><strong>${equipo.codigo}</strong></td>
            <td>${equipo.nombre}</td>
            <td>${equipo.marca || '-'} ${equipo.modelo || ''}</td>
            <td>${equipo.categoria || '-'}</td>
            <td class="text-right">${formatMoney(equipo.precio_lista)}</td>
            <td class="text-right">${formatMoney(equipo.precio_minimo)}</td>
            <td>${getBadgeEstado(equipo.estado)}</td>
            <td>${equipo.ubicacion}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="viewEquipo(${equipo.id})">
                        👁️ Ver
                    </button>
                    ${canSell(equipo.estado) ? `
                        <button class="btn btn-sm btn-success" onclick="openVentaModal(${equipo.id})">
                            💰 Vender
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function setupInventoryFilters() {
    const searchInput = document.getElementById('search-input');
    const filterEstado = document.getElementById('filter-estado');
    const filterCategoria = document.getElementById('filter-categoria');

    const applyFilters = () => {
        let filtered = [...equipos];

        // Filtro de búsqueda
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(e =>
                e.codigo.toLowerCase().includes(searchTerm) ||
                e.nombre.toLowerCase().includes(searchTerm) ||
                (e.modelo && e.modelo.toLowerCase().includes(searchTerm)) ||
                (e.marca && e.marca.toLowerCase().includes(searchTerm))
            );
        }

        // Filtro de estado
        if (filterEstado.value) {
            filtered = filtered.filter(e => e.estado === filterEstado.value);
        }

        // Filtro de categoría
        if (filterCategoria.value) {
            filtered = filtered.filter(e => e.categoria === filterCategoria.value);
        }

        renderInventory(filtered);
    };

    searchInput.addEventListener('input', applyFilters);
    filterEstado.addEventListener('change', applyFilters);
    filterCategoria.addEventListener('change', applyFilters);
}

function getBadgeEstado(estado) {
    const badges = {
        'Disponible': 'badge-disponible',
        'Vendida - Entregada': 'badge-vendida',
        'Vendida - Por Entregar': 'badge-vendida',
        'Apartada': 'badge-apartada',
        'En Bodega/Almacén': 'badge-bodega',
        'En Piso de Venta': 'badge-piso'
    };

    const badgeClass = badges[estado] || 'badge-disponible';
    return `<span class="badge ${badgeClass}">${estado}</span>`;
}

function canSell(estado) {
    return ['Disponible', 'En Piso de Venta', 'Apartada', 'En Cotización'].includes(estado);
}

// ===== VENTAS =====
async function loadSales() {
    try {
        const response = await fetch(`${API_URL}/api/ventas`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Verificar si hay error en la respuesta
        if (data.error) {
            throw new Error(data.error);
        }

        ventas = Array.isArray(data) ? data : [];

        renderSales(ventas);

    } catch (error) {
        console.error('Error cargando ventas:', error);
        document.getElementById('sales-tbody').innerHTML = `
            <tr><td colspan="8" class="loading">❌ Error al cargar las ventas: ${error.message}</td></tr>
        `;
        showNotification(`Error al cargar ventas: ${error.message}`, 'error');
    }
}

function renderSales(ventasToRender) {
    const tbody = document.getElementById('sales-tbody');

    if (ventasToRender.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8" class="loading">No hay ventas registradas</td></tr>
        `;
        return;
    }

    tbody.innerHTML = ventasToRender.map(venta => `
        <tr>
            <td>${formatDate(venta.fecha_venta)}</td>
            <td><strong>${venta.numero_serie}</strong></td>
            <td>${venta.nombre} (${venta.codigo})</td>
            <td>${venta.cliente_nombre}</td>
            <td>${venta.vendedor}</td>
            <td class="text-right font-bold">${formatMoney(venta.precio_venta)}</td>
            <td class="text-right">${venta.descuento_porcentaje.toFixed(1)}%</td>
            <td>${venta.forma_pago}</td>
        </tr>
    `).join('');
}

// ===== NUEVO EQUIPO =====
function setupForms() {
    const formNuevo = document.getElementById('form-nuevo-equipo');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const formVenta = document.getElementById('form-venta');

    formNuevo.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createEquipo();
    });

    btnLimpiar.addEventListener('click', () => {
        formNuevo.reset();
    });

    formVenta.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitVenta();
    });

    // Monitorear precio de venta
    const ventaPrecio = document.getElementById('venta-precio');
    if (ventaPrecio) {
        ventaPrecio.addEventListener('input', updateVentaPrecioInfo);
    }
}

async function createEquipo() {
    const data = {
        codigo: document.getElementById('input-codigo').value,
        nombre: document.getElementById('input-nombre').value,
        marca: document.getElementById('input-marca').value,
        modelo: document.getElementById('input-modelo').value,
        categoria: document.getElementById('input-categoria').value,
        precio_lista: parseFloat(document.getElementById('input-precio-lista').value),
        precio_minimo: parseFloat(document.getElementById('input-precio-minimo').value),
        precio_costo: parseFloat(document.getElementById('input-precio-costo').value) || null,
        ubicacion: document.getElementById('input-ubicacion').value,
        estado: document.getElementById('input-estado').value,
        cantidad_disponible: parseInt(document.getElementById('input-cantidad').value) || 1,
        potencia_motor: document.getElementById('input-potencia').value,
        capacidad: document.getElementById('input-capacidad').value,
        dimensiones: document.getElementById('input-dimensiones').value,
        peso: document.getElementById('input-peso').value,
        especificaciones: document.getElementById('input-especificaciones').value,
        observaciones: document.getElementById('input-observaciones').value
    };

    try {
        const response = await fetch(`${API_URL}/api/equipos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('✅ Equipo creado exitosamente', 'success');
            document.getElementById('form-nuevo-equipo').reset();
            await loadInventory();
            await loadDashboard();
        } else {
            showNotification(`❌ ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Error creando equipo:', error);
        showNotification('❌ Error al crear el equipo', 'error');
    }
}

// ===== MODALES =====
function setupModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.modal-close');

    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ===== VER DETALLES =====
async function viewEquipo(id) {
    try {
        const response = await fetch(`${API_URL}/api/equipos/${id}`);
        const equipo = await response.json();

        const modalBody = document.getElementById('modal-detalle-body');
        modalBody.innerHTML = `
            <div class="equipo-info-grid">
                <div class="info-item">
                    <div class="info-label">Código</div>
                    <div class="info-value">${equipo.codigo}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Nombre</div>
                    <div class="info-value">${equipo.nombre}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Marca</div>
                    <div class="info-value">${equipo.marca || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Modelo</div>
                    <div class="info-value">${equipo.modelo || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Categoría</div>
                    <div class="info-value">${equipo.categoria || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Estado</div>
                    <div class="info-value">${getBadgeEstado(equipo.estado)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Ubicación</div>
                    <div class="info-value">${equipo.ubicacion}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Cantidad</div>
                    <div class="info-value">${equipo.cantidad_disponible}</div>
                </div>
            </div>
            
            <div class="form-section">
                <h3>💰 Precios</h3>
                <div class="equipo-info-grid">
                    <div class="info-item">
                        <div class="info-label">Precio de Lista</div>
                        <div class="info-value text-primary">${formatMoney(equipo.precio_lista)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Precio Mínimo</div>
                        <div class="info-value text-warning">${formatMoney(equipo.precio_minimo)}</div>
                    </div>
                    ${equipo.precio_costo ? `
                        <div class="info-item">
                            <div class="info-label">Precio de Costo</div>
                            <div class="info-value">${formatMoney(equipo.precio_costo)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            ${equipo.potencia_motor || equipo.capacidad || equipo.dimensiones || equipo.peso ? `
                <div class="form-section">
                    <h3>⚙️ Especificaciones Técnicas</h3>
                    <div class="equipo-info-grid">
                        ${equipo.potencia_motor ? `
                            <div class="info-item">
                                <div class="info-label">Potencia</div>
                                <div class="info-value">${equipo.potencia_motor}</div>
                            </div>
                        ` : ''}
                        ${equipo.capacidad ? `
                            <div class="info-item">
                                <div class="info-label">Capacidad</div>
                                <div class="info-value">${equipo.capacidad}</div>
                            </div>
                        ` : ''}
                        ${equipo.dimensiones ? `
                            <div class="info-item">
                                <div class="info-label">Dimensiones</div>
                                <div class="info-value">${equipo.dimensiones}</div>
                            </div>
                        ` : ''}
                        ${equipo.peso ? `
                            <div class="info-item">
                                <div class="info-label">Peso</div>
                                <div class="info-value">${equipo.peso}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            ${equipo.especificaciones ? `
                <div class="form-section">
                    <h3>📋 Especificaciones Adicionales</h3>
                    <p>${equipo.especificaciones}</p>
                </div>
            ` : ''}
            
            ${equipo.observaciones ? `
                <div class="form-section">
                    <h3>📝 Observaciones</h3>
                    <p>${equipo.observaciones}</p>
                </div>
            ` : ''}
        `;

        document.getElementById('modal-detalle').classList.add('active');

    } catch (error) {
        console.error('Error cargando detalles:', error);
        showNotification('Error al cargar los detalles del equipo', 'error');
    }
}

// ===== VENTA =====
async function openVentaModal(id) {
    try {
        const response = await fetch(`${API_URL}/api/equipos/${id}`);
        const equipo = await response.json();

        document.getElementById('venta-equipo-id').value = id;

        const equipoInfo = document.getElementById('venta-equipo-info');
        equipoInfo.innerHTML = `
            <div class="equipo-info-grid">
                <div class="info-item">
                    <div class="info-label">Equipo</div>
                    <div class="info-value">${equipo.nombre}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Código</div>
                    <div class="info-value">${equipo.codigo}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Precio de Lista</div>
                    <div class="info-value text-primary">${formatMoney(equipo.precio_lista)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Precio Mínimo</div>
                    <div class="info-value text-warning">${formatMoney(equipo.precio_minimo)}</div>
                </div>
            </div>
        `;

        // Guardar precios en dataset para validación
        const ventaPrecio = document.getElementById('venta-precio');
        ventaPrecio.dataset.precioLista = equipo.precio_lista;
        ventaPrecio.dataset.precioMinimo = equipo.precio_minimo;
        ventaPrecio.value = equipo.precio_lista;

        // Reset form
        document.getElementById('form-venta').reset();
        document.getElementById('venta-equipo-id').value = id;
        document.getElementById('venta-precio').value = equipo.precio_lista;

        updateVentaPrecioInfo();

        document.getElementById('modal-venta').classList.add('active');

    } catch (error) {
        console.error('Error abriendo modal de venta:', error);
        showNotification('Error al abrir el formulario de venta', 'error');
    }
}

function updateVentaPrecioInfo() {
    const ventaPrecio = document.getElementById('venta-precio');
    const precioLista = parseFloat(ventaPrecio.dataset.precioLista);
    const precioMinimo = parseFloat(ventaPrecio.dataset.precioMinimo);
    const precioVenta = parseFloat(ventaPrecio.value) || 0;

    const descuento = precioLista - precioVenta;
    const descuentoPct = (descuento / precioLista * 100).toFixed(1);

    const infoElement = document.getElementById('venta-precio-info');
    const autorizacionDiv = document.getElementById('venta-autorizacion');

    if (precioVenta < precioMinimo) {
        infoElement.innerHTML = `⚠️ Precio menor al mínimo. Descuento: ${descuentoPct}%. Requiere autorización.`;
        infoElement.className = 'text-danger';
        autorizacionDiv.style.display = 'block';
    } else if (precioVenta < precioLista) {
        infoElement.innerHTML = `ℹ️ Descuento: ${descuentoPct}%`;
        infoElement.className = 'text-warning';
        autorizacionDiv.style.display = 'none';
    } else {
        infoElement.innerHTML = `✅ Precio de lista`;
        infoElement.className = 'text-success';
        autorizacionDiv.style.display = 'none';
    }
}

async function submitVenta() {
    const equipoId = document.getElementById('venta-equipo-id').value;
    const precioVenta = parseFloat(document.getElementById('venta-precio').value);
    const precioMinimo = parseFloat(document.getElementById('venta-precio').dataset.precioMinimo);

    const data = {
        vendedor: document.getElementById('venta-vendedor').value,
        cliente_nombre: document.getElementById('venta-cliente').value,
        cliente_contacto: document.getElementById('venta-contacto').value,
        cliente_rfc: document.getElementById('venta-rfc').value,
        cliente_direccion: document.getElementById('venta-direccion').value,
        precio_venta: precioVenta,
        forma_pago: document.getElementById('venta-forma-pago').value,
        motivo_descuento: document.getElementById('venta-motivo').value,
        notas: document.getElementById('venta-notas').value
    };

    // Si requiere autorización
    if (precioVenta < precioMinimo) {
        data.password_gerente = document.getElementById('venta-password').value;

        if (!data.password_gerente) {
            showNotification('❌ Ingrese la contraseña de gerente', 'error');
            return;
        }
    }

    try {
        const response = await fetch(`${API_URL}/api/equipos/${equipoId}/vender`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`✅ Venta registrada exitosamente. N° Serie: ${result.numero_serie}`, 'success');
            closeAllModals();
            await loadInventory();
            await loadSales();
            await loadDashboard();
        } else {
            showNotification(`❌ ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Error registrando venta:', error);
        showNotification('❌ Error al registrar la venta', 'error');
    }
}

// ===== UTILIDADES =====
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 4000);
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
