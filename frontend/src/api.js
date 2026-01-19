

// src/api.js (hoặc src/api/index.js)
import axios from 'axios';

// 1. Tạo instance
const instance = axios.create({
    baseURL: 'http://192.168.91.192:3000', // Thay IP vào đây
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. QUAN TRỌNG NHẤT: Phải dùng export default\\

export default instance;

