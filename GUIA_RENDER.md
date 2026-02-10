# 🚀 GUÍA COMPLETA: Subir Sistema DURTRON a Render (GRATIS)

## 🎯 Lo que vas a lograr

Al finalizar tendrás:
- ✅ Tu sistema funcionando en internet
- ✅ Un link tipo: https://durtron-sistema.onrender.com
- ✅ Acceso desde Mac, Windows, celular, tablet
- ✅ Todos comparten el mismo inventario
- ✅ 100% GRATIS (plan gratuito de Render)

---

## 📋 REQUISITOS PREVIOS

1. ✅ Cuenta de GitHub (gratis)
2. ✅ Cuenta de Render (gratis)
3. ✅ 15 minutos de tu tiempo

---

## 🔧 PASO 1: Crear Cuenta en GitHub (si no tienes)

### 1.1 Ir a GitHub
```
https://github.com
```

### 1.2 Crear cuenta
- Click en "Sign up"
- Ingresa tu email
- Crea una contraseña
- Verifica tu email

---

## 📦 PASO 2: Subir tu Código a GitHub

### Opción A: Desde la Web (MÁS FÁCIL)

#### 2.1 Crear nuevo repositorio
1. Click en tu foto (arriba derecha)
2. Click en "Your repositories"
3. Click en "New" (botón verde)
4. Nombre: `sistema-durtron`
5. Público o Privado (como quieras)
6. Click "Create repository"

#### 2.2 Subir archivos
1. Click en "uploading an existing file"
2. Arrastra estos archivos:
   ```
   ✓ app.py (el que creé)
   ✓ requirements.txt (el que creé)
   ✓ init_db.py (el que creé)
   ✓ render.yaml (el que creé)
   ✓ Carpeta frontend/ completa
   ```
3. Click "Commit changes"

### Opción B: Desde Terminal (Si sabes Git)

```bash
cd /ruta/a/tu/proyecto

# Inicializar git
git init

# Copiar los archivos nuevos que creé
cp /ruta/app.py .
cp /ruta/requirements.txt .
cp /ruta/init_db.py .
cp /ruta/render.yaml .

# Agregar archivos
git add .
git commit -m "Sistema DURTRON v2.0"

# Crear repo en GitHub y ejecutar:
git remote add origin https://github.com/TU_USUARIO/sistema-durtron.git
git branch -M main
git push -u origin main
```

---

## 🌐 PASO 3: Crear Cuenta en Render

### 3.1 Ir a Render
```
https://render.com
```

### 3.2 Crear cuenta
- Click en "Get Started"
- Opción recomendada: "Sign up with GitHub"
  (Conecta automáticamente tus repos)
- O usa tu email

---

## 🚀 PASO 4: Desplegar en Render

### 4.1 Crear nuevo Web Service
1. En el dashboard de Render, click "New +"
2. Click en "Web Service"

### 4.2 Conectar tu repositorio
1. Si usaste GitHub: verás tu repo `sistema-durtron`
2. Click en "Connect"

### 4.3 Configurar el servicio

**Name:** `durtron-sistema` (o el que quieras)

**Region:** `Oregon (US West)` (es gratis)

**Branch:** `main`

**Runtime:** `Python 3`

**Build Command:**
```
pip install -r requirements.txt && python init_db.py
```

**Start Command:**
```
gunicorn app:app
```

**Plan:** Selecciona **"Free"** (gratis para siempre)

### 4.4 Variables de entorno (opcional)
Click en "Advanced" → "Add Environment Variable"

```
Key: PYTHON_VERSION
Value: 3.11.0
```

### 4.5 Crear el servicio
- Click en "Create Web Service"
- ¡Espera 3-5 minutos mientras se despliega!

---

## ✅ PASO 5: Verificar que Funciona

### 5.1 Ver el despliegue
Verás logs en tiempo real como:
```
==> Building...
==> Installing dependencies...
==> Starting service...
==> Your service is live at https://durtron-sistema.onrender.com
```

### 5.2 Abrir tu aplicación
1. Click en el link que te da Render
2. ¡Deberías ver tu sistema funcionando!

### 5.3 Importar el catálogo DURTRON

Tienes 2 opciones:

**Opción A: Desde tu Mac**
1. Abre Terminal
2. Instala httpie: `brew install httpie`
3. Ejecuta:
```bash
# Reemplaza con tu URL de Render
URL="https://durtron-sistema.onrender.com"

# Importar cada producto manualmente vía API
http POST $URL/api/equipos \
  codigo="JC-150X250" \
  nombre="Quebradora de Quijada" \
  marca="DURTRON" \
  modelo="JC-150X250" \
  categoria="Quebradoras de Quijada" \
  precio_lista:=109900 \
  precio_minimo:=98910 \
  precio_costo:=87920 \
  ubicacion="Bodega Principal" \
  estado="Disponible"
```

**Opción B: Crear un script de importación web**
(Te lo puedo crear si quieres)

---

## 🎁 ¡LISTO! Tu Sistema Está en Internet

### Tu URL será algo como:
```
https://durtron-sistema.onrender.com
```

### Ahora puedes:
- ✅ Abrirlo desde cualquier dispositivo
- ✅ Compartir el link con tus vendedores
- ✅ Usarlo desde Mac, Windows, iPad, iPhone
- ✅ Todos ven el mismo inventario en tiempo real

---

## 🔐 SEGURIDAD IMPORTANTE

### Cambiar la contraseña de gerente

1. En tu repositorio de GitHub
2. Edita el archivo `app.py`
3. Busca la línea: `if password != 'gerente123':`
4. Cambia a: `if password != 'TU_CONTRASEÑA_SEGURA':`
5. Guarda (commit)
6. Render se actualizará automáticamente

---

## 💡 CARACTERÍSTICAS DEL PLAN GRATIS

### ✅ Incluido:
- 750 horas gratis al mes (suficiente para uso normal)
- SSL/HTTPS automático (seguro)
- Despliegue automático desde GitHub
- Backups de base de datos

### ⚠️ Limitaciones:
- Si nadie usa el sitio por 15 minutos, se "duerme"
- Primera carga después de dormir tarda ~1 minuto
- 512 MB de RAM (suficiente para DURTRON)

### 💰 Para eliminar limitaciones:
- Plan Starter: $7 USD/mes
  - No se duerme nunca
  - Más rápido
  - Más RAM

---

## 🔄 ACTUALIZAR EL SISTEMA

Cuando hagas cambios:

### Desde GitHub (web):
1. Ve a tu repositorio
2. Click en el archivo que quieres editar
3. Click en el ícono del lápiz (editar)
4. Haz tus cambios
5. Click "Commit changes"
6. Render detecta el cambio y redespliega automáticamente

### Desde Terminal (Git):
```bash
# Hacer cambios en tu código local
git add .
git commit -m "Actualización XYZ"
git push

# Render se actualiza automáticamente
```

---

## 📊 MONITOREO

### Ver logs en tiempo real:
1. En Render dashboard
2. Click en tu servicio "durtron-sistema"
3. Pestaña "Logs"
4. Ves todo lo que pasa en tiempo real

### Estadísticas:
- Pestaña "Metrics"
- Ves uso de CPU, RAM, requests

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### "Build failed"
- Revisa que `requirements.txt` esté bien
- Verifica que `init_db.py` esté en el repo

### "Application error"
- Ve a Logs en Render
- Busca errores en rojo
- Generalmente es un error de código

### "La base de datos está vacía"
- Necesitas importar el catálogo DURTRON
- Usa la Opción A o B del Paso 5.3

### "El sitio está lento"
- Es normal en plan gratis después de 15 min sin uso
- Se "despierta" en ~1 minuto
- Upgrade a plan Starter ($7/mes) para eliminar esto

---

## 🎯 SIGUIENTES PASOS

### 1. Importar el Catálogo DURTRON
- Usa el método que prefieras del Paso 5.3
- O déjame crearte un script automático

### 2. Personalizar
- Cambia la contraseña de gerente
- Personaliza colores/logo si quieres

### 3. Compartir
- Comparte el link con tu equipo
- Crea usuarios si quieres control de acceso

### 4. ¿Necesitas ayuda adicional?
- ¿Quieres script de importación automático?
- ¿Quieres sistema de usuarios y permisos?
- ¿Quieres personalización de marca?

---

## 📞 CONTACTO DURTRON

**DURTRON - Innovación Industrial**
📍 Av. del Sol #329, Durango, Dgo.
📞 Tel: 618 134 1056

---

## ✅ CHECKLIST FINAL

Antes de empezar a usar en producción:

- [ ] Sistema desplegado en Render
- [ ] Link funcionando
- [ ] Base de datos inicializada
- [ ] Catálogo DURTRON importado (32 productos)
- [ ] Contraseña de gerente cambiada
- [ ] Probado desde diferentes dispositivos
- [ ] Equipo capacitado en el uso

---

**¡Tu sistema DURTRON está en la nube! 🌟**

Ahora cualquier persona con el link puede acceder desde donde sea.
