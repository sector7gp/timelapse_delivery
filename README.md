# Portal de Distribución de Videos

Versión 1 del portal de distribución de videos, construido con FastAPI, MariaDB y Vanilla JS.

## Requisitos Previos
- Python 3.9+
- MariaDB (MySQL) funcionando
- Crear base de datos llamada `video_portal` (o la configurada en `.env`)

## Instalación y Ejecución

1. Crear el entorno virtual e instalar las dependencias:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install email-validator
```

2. Configurar las variables de entorno:
- Copiar `.env.template` a `.env` y ajustar `DATABASE_URL` y otras variables necesarias.
Ejemplo: `DATABASE_URL=mysql+pymysql://usuario:password@localhost:3306/video_portal`

3. Inicializar la base de datos y crear usuario administrador:
```bash
python init_db.py
```
*(Si da error de conexión refused, asegúrate de que MariaDB esté corriendo y las credenciales sean correctas)*

4. Crear el directorio base para los videos (por defecto `/tmp/videos/sample`):
```bash
mkdir -p /tmp/videos/sample
```

5. Iniciar el servidor:
```bash
uvicorn backend.main:app --reload
```

## Uso
- Accede a `http://localhost:8000/` desde el navegador.
- Credenciales por defecto (creadas por `init_db.py`):
  - Email: `admin@example.com`
  - Contraseña: `admin123`
- Agrega archivos de video (.mp4, .mkv, etc) dentro del directorio `/tmp/videos/sample` para verlos en el portal.
