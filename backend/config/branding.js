const fs = require('fs');
const path = require('path');

const brandingConfigPath = path.join(__dirname, 'branding-config.json');

class BrandingConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(brandingConfigPath)) {
        const data = fs.readFileSync(brandingConfigPath, 'utf8');
        return JSON.parse(data);
      }
      console.warn('Branding config file not found, using defaults');
      return this.getDefaultConfig();
    } catch (error) {
      console.error('Error loading branding config:', error);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      branding: {
        company: {
          name: "Luckia",
          logo: "/Logo_Luckia.svg"
        },
        app: {
          name: "Luckia Chat",
          agent_name: "Asistente Luckia",
          description: "Sistema de chat inteligente con IA"
        },
        theme: {
          primary_color: "#1f2937",
          accent_color: "#3b82f6",
          background_color: "#f9fafb",
          text_color: "#111827"
        }
      }
    };
  }

  get(key) {
    return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
  }

  getAll() {
    return { ...this.config };
  }

  // Métodos de conveniencia
  getCompanyName() {
    return this.get('branding.company.name') || 'Luckia';
  }

  getAppName() {
    return this.get('branding.app.name') || 'Luckia Chat';
  }

  getAgentName() {
    return this.get('branding.app.agent_name') || 'Asistente Luckia';
  }

  getTheme() {
    return this.get('branding.theme') || this.getDefaultConfig().branding.theme;
  }

  getLogo() {
    return this.get('branding.company.logo') || '/Logo_Luckia.svg';
  }
}

module.exports = new BrandingConfig();