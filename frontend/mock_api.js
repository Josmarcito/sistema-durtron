
// Mock API for testing logic
window.originalFetch = window.fetch;
window.fetch = async (url, options) => {
    console.log(`[MOCK API] ${options?.method || 'GET'} ${url}`, options?.body);

    // DELAY
    await new Promise(r => setTimeout(r, 200));

    // MOCK DATA
    const providers = [
        { id: 1, razon_social: 'Acme Steel', contacto_nombre: 'John', correo: 'john@acme.com', whatsapp: '5551234567' },
        { id: 2, razon_social: 'Global Parts', contacto_nombre: 'Jane', correo: 'jane@global.com', whatsapp: '5559876543' },
        { id: 3, razon_social: 'Local Hardware', contacto_nombre: 'Bob', correo: 'bob@local.com', whatsapp: '5551112222' }
    ];

    if (url.includes('/api/proveedores') && (!options || options.method === 'GET')) {
        return { ok: true, json: async () => providers };
    }

    if (url.includes('/api/requisiciones') && (!options || options.method === 'GET') && !url.includes('whatsapp') && !url.includes('email')) {
        // Return list or single
        if (url.match(/\/api\/requisiciones\/\d+$/)) {
            return {
                ok: true, json: async () => ({
                    id: 123, folio: 'REQ-2024-001', equipo_nombre: 'Project X',
                    estado: 'Pendiente', created_at: new Date().toISOString(),
                    items: [
                        { id: 1, componente: 'Motor 5HP', proveedor_nombre: 'Acme Steel', cantidad: 2, unidad: 'pza', precio_unitario: 5000, tiene_iva: true },
                        { id: 2, componente: 'Tornillos', proveedor_nombre: 'Local Hardware', cantidad: 100, unidad: 'pza', precio_unitario: 5, tiene_iva: false },
                        { id: 3, componente: 'Placa A36', proveedor_nombre: 'Acme Steel', cantidad: 1, unidad: 'pza', precio_unitario: 2500, tiene_iva: true }
                    ]
                })
            };
        }
        return {
            ok: true, json: async () => [
                { id: 123, folio: 'REQ-2024-001', equipo_nombre: 'Project X', proveedor_nombre: 'Acme Steel', estado: 'Pendiente' }
            ]
        };
    }

    if (url.includes('/api/requisiciones') && options?.method === 'POST' && !url.includes('email')) {
        return { ok: true, json: async () => ({ success: true, folio: JSON.parse(options.body).folio }) };
    }

    if (url.includes('whatsapp-url')) {
        return { ok: true, json: async () => ({ success: true, url: 'https://wa.me/1234567890' }) };
    }

    if (url.includes('enviar-email')) {
        return { ok: true, json: async () => ({ success: true, message: 'Email sent (mock)' }) };
    }

    // Default 404
    return { ok: false, status: 404, json: async () => ({ error: 'Not found in mock' }) };
};
console.log("MOCK API INJECTED");
