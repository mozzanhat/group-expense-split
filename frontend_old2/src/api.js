import axios from 'axios';

// ĐỊA CHỈ IP CỦA BẠN
const API_BASE_URL = 'http://10.0.2.2:3000';//gia lap
//const API_BASE_URL = 'http://192.168.1.128:3000';//dien hoai
const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;