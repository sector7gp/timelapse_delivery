module.exports = {
  apps : [{
    name: "timelapse_delivery",
    script: "-m backend.main",
    interpreter: "./venv/bin/python3",
    cwd: "./", // Asegura que el directorio de trabajo sea la raíz
    env: {
      NODE_ENV: "development",
      TZ: "America/Argentina/Buenos_Aires" // Para que los logs coincidan con tu hora
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}
