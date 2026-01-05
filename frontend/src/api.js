

// src/api.js (hoặc src/api/index.js)
import axios from 'axios';

// 1. Tạo instance
const instance = axios.create({
    baseURL: 'http://192.168.121.192:3000', // Thay IP của bạn vào đây
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. QUAN TRỌNG NHẤT: Phải dùng export default
export default instance;

