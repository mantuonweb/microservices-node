require('dotenv').config({ path: './config-service.env' });
const Consul = require('consul');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const SERVICE_NAME = 'config-service';
const PORT = process.env.PORT || 4000;
const SERVICE_ID = `${SERVICE_NAME}-${PORT}`;
// Configuration directory
const CONFIG_DIR = path.join(__dirname, 'configs');
const consul = new Consul({
  host: process.env.CONSUL_HOST || 'localhost',
  port: process.env.CONSUL_PORT || 8500,
  promisify: true,
});
// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Function to load configuration from file
async function loadConfigFile(service, environment) {
  try {
    const filePath = path.join(CONFIG_DIR, service, `${environment}.env`);
    const data = await fs.readFile(filePath, 'utf8');
    return parseEnvString(data);
  } catch (error) {
    console.error(
      `Error loading config for ${service}/${environment}:`,
      error.message
    );
    return null;
  }
}

// Function to get all services
async function getServices() {
  try {
    const services = await fs.readdir(CONFIG_DIR);
    return services.filter(async (service) => {
      const stat = await fs.stat(path.join(CONFIG_DIR, service));
      return stat.isDirectory();
    });
  } catch (error) {
    console.error('Error getting services:', error.message);
    return [];
  }
}

// Function to get all environments for a service
async function getEnvironments(service) {
  try {
    const servicePath = path.join(CONFIG_DIR, service);
    const files = await fs.readdir(servicePath);
    return files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));
  } catch (error) {
    console.error(`Error getting environments for ${service}:`, error.message);
    return [];
  }
}

// Route to get configuration for a specific service and environment
app.get('/config/:service/:environment', async (req, res) => {
  const { service, environment } = req.params;

  const config = await loadConfigFile(service, environment);

  if (!config) {
    return res.status(404).json({
      error: `Configuration not found for service '${service}' and environment '${environment}'`,
    });
  }

  res.json(config);
});

// Route to get all available services
app.get('/services', async (req, res) => {
  const services = await getServices();
  res.json(services);
});

// Route to get all environments for a service
app.get('/environments/:service', async (req, res) => {
  const { service } = req.params;

  // Check if service directory exists
  try {
    await fs.access(path.join(CONFIG_DIR, service));
  } catch (error) {
    return res.status(404).json({ error: `Service '${service}' not found` });
  }

  const environments = await getEnvironments(service);
  res.json(environments);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  deregisterService();
});

process.on('SIGTERM', () => {
  deregisterService();
});


// Ensure config directory exists before starting server
async function ensureConfigDir() {
  try {
    await fs.access(CONFIG_DIR);
  } catch (error) {
    // Create the config directory if it doesn't exist
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    console.log(`Created config directory: ${CONFIG_DIR}`);
  }
}

// Start the server
async function startServer() {
  await ensureConfigDir();

  app.listen(PORT, () => {
    registerService();
    console.log(`Config server running on port ${PORT}`);
    console.log(`Configuration files are loaded from: ${CONFIG_DIR}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

/**
 * Converts environment variable string format to a JSON object
 * @param {string} envString - String in KEY=VALUE format with newlines
 * @returns {Object} - Configuration object
 */
function parseEnvString(envString) {
  const lines = envString.split(/\r?\n/);
  const config = {};

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();

      // Convert values to appropriate types
      if (value === 'true') {
        config[key] = true;
      } else if (value === 'false') {
        config[key] = false;
      } else if (!isNaN(value) && value !== '') {
        config[key] = Number(value);
      } else {
        config[key] = value;
      }
    }
  }

  return config;
}
// Register service with Consul
function registerService() {
  try {
    consul.agent.service.register(
      {
        id: SERVICE_ID,
        name: SERVICE_NAME,
        address: process.env.SERVICE_HOST || 'localhost',
        port: parseInt(PORT),
        tags: ['microservice', 'config'],
        check: {
          http: `http://${process.env.SERVICE_HOST || 'localhost'
            }:${PORT}/health`,
          interval: '15s',
          timeout: '5s',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to register service with Consul:', err);
          return;
        }
        console.info(`Service registered with Consul: ${SERVICE_ID}`);
      }
    );
  } catch (error) {
    console.error('Error connecting to Consul:', error.message);
    console.info('Service will run without Consul registration');
  }
}

// Deregister service from Consul
function deregisterService() {
  if (!consul || !CONSUL_ENABLED) {
    return;
  }

  consul.agent.service.deregister(SERVICE_ID, (err) => {
    if (err) {
      console.error('Failed to deregister service from Consul:', err);
      return;
    }
    console.info(`Service deregistered from Consul: ${SERVICE_ID}`);
  });
}