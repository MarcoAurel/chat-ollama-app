// ================================
// 🧪 Authentication Tests
// Testing login functionality
// ================================

const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');

// Mock area configuration
const mockAreaConfig = {
  informatica: {
    password_hash: bcrypt.hashSync('claveinformatica', 10),
    agent_config: {
      model: 'llama3.2:1b',
      system_prompt: 'Eres un asistente de informática...',
      temperature: 0.7,
      max_tokens: 1000
    }
  }
};

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(bodyParser.json());
  
  // Mock login endpoint
  app.post('/api/login', async (req, res) => {
    const { area, password } = req.body;
    
    if (!area || !password) {
      return res.status(400).json({ message: 'Área y contraseña requeridas' });
    }
    
    const areaData = mockAreaConfig[area];
    if (!areaData) {
      return res.status(401).json({ message: 'Área inválida' });
    }
    
    const isValidPassword = await bcrypt.compare(password, areaData.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }
    
    res.json({ 
      message: 'Acceso concedido',
      agent_config: areaData.agent_config
    });
  });
  
  return app;
};

describe('🔐 Authentication System', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          area: 'informatica',
          password: 'claveinformatica'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Acceso concedido');
      expect(response.body).toHaveProperty('agent_config');
      expect(response.body.agent_config).toHaveProperty('model');
      expect(response.body.agent_config).toHaveProperty('system_prompt');
    });

    it('should reject invalid area', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          area: 'nonexistent',
          password: 'anypassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Área inválida');
    });

    it('should reject wrong password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          area: 'informatica',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Contraseña incorrecta');
    });

    it('should require both area and password', async () => {
      // Missing area
      await request(app)
        .post('/api/login')
        .send({ password: 'claveinformatica' })
        .expect(400);

      // Missing password
      await request(app)
        .post('/api/login')
        .send({ area: 'informatica' })
        .expect(400);

      // Missing both
      await request(app)
        .post('/api/login')
        .send({})
        .expect(400);
    });

    it('should handle empty strings', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          area: '',
          password: ''
        })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Área y contraseña requeridas');
    });
  });

  describe('Password Security', () => {
    it('should hash passwords correctly', async () => {
      const password = 'testpassword';
      const hash = await bcrypt.hash(password, 10);
      
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$10\$/);
      
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const correctPassword = 'testpassword';
      const wrongPassword = 'wrongpassword';
      const hash = await bcrypt.hash(correctPassword, 10);
      
      const isValid = await bcrypt.compare(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should use sufficient salt rounds', () => {
      const hash = bcrypt.hashSync('test', 10);
      const rounds = hash.split('$')[2];
      expect(parseInt(rounds)).toBeGreaterThanOrEqual(10);
    });
  });
});