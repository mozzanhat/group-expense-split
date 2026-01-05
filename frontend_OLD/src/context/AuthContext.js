import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // <-- THÊM MỚI
  const [isLoading, setIsLoading] = useState(true);

  // 1. Hàm kiểm tra token khi mở ứng dụng
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('authToken');
        if (storedToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          // Lấy thông tin user
          const response = await api.get('/users/me'); 
          setUser(response.data); // <-- CẬP NHẬT
          setToken(storedToken);
        }
      } catch (e) {
        console.error('Failed to load token or user', e);
        // Nếu token hỏng, xóa nó đi
        await SecureStore.deleteItemAsync('authToken');
      }
      setIsLoading(false);
    };
    loadToken();
  }, []);

  // 2. Hàm xử lý đăng nhập
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const newToken = response.data.token;
      
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      // Lấy thông tin user sau khi đăng nhập
      const userResponse = await api.get('/users/me'); 
      setUser(userResponse.data); // <-- CẬP NHẬT
      setToken(newToken);
      
      await SecureStore.setItemAsync('authToken', newToken);
    } catch (e) {
      console.error('Login failed', e);
      alert('Đăng nhập thất bại, vui lòng kiểm tra lại.');
    }
  };

  // 3. Hàm xử lý đăng ký (CÓ TRẢ VỀ)
  const register = async (name, email, password) => {
    try {
      await api.post('/auth/register', { name, email, password });
      alert('Đăng ký thành công! Vui lòng đăng nhập.');
      return true; // <-- CẬP NHẬT
    } catch (e) {
      console.error('Register failed', e);
      alert('Đăng ký thất bại, email có thể đã được sử dụng.');
      return false; // <-- CẬP NHẬT
    }
  };

  // 4. Hàm xử lý đăng xuất
  const logout = async () => {
    setUser(null); // <-- CẬP NHẬT
    setToken(null);
    delete api.defaults.headers.common['Authorization'];
    await SecureStore.deleteItemAsync('authToken');
  };

  // 5. Cung cấp các giá trị này cho toàn ứng dụng
  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook (móc) tùy chỉnh để dễ dàng sử dụng context
export const useAuth = () => {
  return useContext(AuthContext);
};