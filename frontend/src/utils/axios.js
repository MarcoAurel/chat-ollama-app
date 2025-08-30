import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.baseURL = 'http://localhost:3001';

// Add request interceptor for logging (development only)
if (process.env.NODE_ENV === 'development') {
  axios.interceptors.request.use(
    (config) => {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
      return config;
    },
    (error) => {
      console.error('API Request Error:', error);
      return Promise.reject(error);
    }
  );

  axios.interceptors.response.use(
    (response) => {
      console.log('API Response:', response.status, response.config.url);
      return response;
    },
    (error) => {
      console.error('API Response Error:', error.response?.status, error.config?.url);
      return Promise.reject(error);
    }
  );
}

export default axios;