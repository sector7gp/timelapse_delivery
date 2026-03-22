module.exports = {
  apps : [{
    name: "timelapse_delivery",
    script: "backend/main.py",
    interpreter: "./venv/bin/python3",
    cwd: "./",
    env: {
      NODE_ENV: "development",
      PYTHONPATH: ".", // Agregamos la raíz al path de Python para que los imports funcionen
      TZ: "America/Argentina/Buenos_Aires"
    },
    env_production: {
      NODE_ENV: "production",
      PYTHONPATH: "."
    }
  }]
}
