# 🚀 SISTEMA DURTRON - Deployment en Render (GRATIS)

## ⚡ INICIO RÁPIDO (15 minutos)

### 📦 Archivos que necesitas:

1. **app.py** - Backend Flask adaptado para producción
2. **requirements.txt** - Dependencias Python
3. **init_db.py** - Inicialización de base de datos
4. **render.yaml** - Configuración de Render
5. **frontend/** - Tu carpeta frontend completa
6. **importar_catalogo_render.py** - Script para importar productos

---

## 🎯 PASOS RÁPIDOS:

### 1️⃣ Subir a GitHub
```
1. Ve a https://github.com
2. Crea nuevo repositorio: "sistema-durtron"
3. Sube TODOS estos archivos + tu carpeta frontend/
```

### 2️⃣ Desplegar en Render
```
1. Ve a https://render.com
2. Sign up with GitHub
3. New + → Web Service
4. Conecta tu repo "sistema-durtron"
5. Plan: FREE
6. Click "Create Web Service"
7. Espera 3-5 minutos
```

### 3️⃣ Importar Catálogo
```bash
# Edita importar_catalogo_render.py
# Cambia la línea 8 por TU URL de Render

# Ejecuta:
python3 importar_catalogo_render.py
```

### 4️⃣ ¡Listo!
```
Abre tu URL: https://durtron-sistema.onrender.com
(o la que te dé Render)
```

---

## 📖 Documentación Completa

Lee **GUIA_RENDER.md** para instrucciones paso a paso con capturas de pantalla.

---

## ✅ Ventajas de Render:

- ✅ 100% GRATIS para empezar
- ✅ SSL/HTTPS automático
- ✅ Funciona en Mac, Windows, celular
- ✅ Todos comparten el mismo inventario
- ✅ Deploy automático desde GitHub
- ✅ No se duerme en plan de pago ($7/mes)

---

## 🔐 IMPORTANTE: Seguridad

Después de desplegar, cambia la contraseña de gerente:

```python
# En app.py línea 345
if password != 'gerente123':  # ← CAMBIAR ESTO
```

---

## 📞 DURTRON

**Innovación Industrial**
📍 Av. del Sol #329, Durango
📞 618 134 1056

---

**¿Necesitas ayuda? Lee GUIA_RENDER.md**
