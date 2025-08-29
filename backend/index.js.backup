const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const axios = require('axios');
const bodyParser = require('body-parser');

dotenv.config();

const app = express();
const port = 3001;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
const AREA_CONFIG_PATH = process.env.AREA_CONFIG_PATH;

app.use(cors());
app.use(bodyParser.json());

let areas = {};

try {
  const configPath = path.resolve(AREA_CONFIG_PATH);
  const data = fs.readFileSync(configPath, 'utf-8');
  areas = JSON.parse(data);
} catch (err) {
  console.error('❌ Error cargando configuración de áreas:', err);
  process.exit(1);
}

app.post('/api/login', async (req, res) => {
  const { area, password } = req.body;
  const areaData = areas[area];
  if (!areaData) return res.status(401).json({ message: 'Área no encontrada' });

  const match = await bcrypt.compare(password, areaData.password_hash);
  if (!match) return res.status(403).json({ message: 'Contraseña incorrecta' });

  return res.json({ message: 'Acceso concedido', agent_config: areaData.agent_config });
});

app.post('/api/chat', async (req, res) => {
  const { area, prompt } = req.body;
  const areaData = areas[area];
  if (!areaData) return res.status(401).json({ message: 'Área inválida' });

  const config = areaData.agent_config;

  try {
    const ollamaRes = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: config.model,
        prompt,
        system: config.system_prompt,
        options: {
          temperature: config.temperature,
          num_predict: config.max_tokens
        },
        stream: false
      }
    );

    res.json({ response: ollamaRes.data.response });

  } catch (err) {
    console.error('Error llamando a Ollama:', err.message);
    res.status(500).json({ message: 'Error al procesar el prompt' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
});
