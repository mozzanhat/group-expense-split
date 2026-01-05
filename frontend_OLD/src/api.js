import axios from 'axios';

// ĐỊA CHỈ IP CỦA BẠN
const API_BASE_URL = 'http://192.168.1.57:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;