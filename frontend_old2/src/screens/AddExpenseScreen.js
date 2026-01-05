import React, { useState } from 'react';


//import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api';

import * as ImagePicker from 'expo-image-picker';


//import * as TextRecognition from 'react-native-text-recognition';
import TextRecognition from 'react-native-text-recognition';

export default function AddExpenseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params; // Lấy groupId được truyền từ màn hình Chi tiết

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const [loadingOCR, setLoadingOCR] = useState(false);

  // (Chúng ta sẽ thêm logic cho OCR và chọn người trả ở các bước sau)

  // Hàm xử lý lưu
  const handleSaveExpense = async () => {
    if (!description || !amount) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả và số tiền.');
      return;
    }

    try {
      // Tạm thời, chúng ta sẽ mặc định người trả (paidById) là 1
      // (Chúng ta sẽ nâng cấp cái này sau)
      await api.post('/expenses', {
        description: description,
        amount: parseFloat(amount),
        groupId: groupId,
        paidById: 1 // TẠM THỜI MẶC ĐỊNH LÀ USER ID 1
      });

      Alert.alert('Thành công', 'Đã thêm chi phí mới.');
      navigation.goBack(); // Quay lại màn hình chi tiết
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu chi phí.');
      console.error('Save expense error:', error);
    }
  };

  // ...
  // Hàm xử lý quét hóa đơn
  const handleScanReceipt = async () => {
    // 1. Xin quyền truy cập Camera
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted === false) {
      Alert.alert('Lỗi', 'Cần cấp quyền camera để quét hóa đơn.');
      return;
    }

    // 2. Mở camera để chụp ảnh
    setLoadingOCR(true);
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7, // Giảm chất lượng ảnh để xử lý nhanh hơn
    });

    if (result.canceled) {
      setLoadingOCR(false);
      return; // Người dùng hủy
    }

    // 3. Lấy URI (đường dẫn) của ảnh
    const imageUri = result.assets[0].uri;

    // 4. GỌI OCR (ML KIT)
    try {
      // Gửi ảnh đến ML Kit để nhận diện
      const textResult = await TextRecognition.recognize(imageUri);

      // 5. Xử lý kết quả (Logic đơn giản)
      // textResult là một mảng các dòng text, ví dụ: ["Cơm gà", "25000", "Nước ngọt", "10000"]

      // Nối tất cả text lại làm mô tả
      const fullText = textResult.join('\n');
      setDescription(fullText);

      // Tìm số lớn nhất trong text để làm "Số tiền"
      let maxAmount = 0;
      const numbers = fullText.match(/\d+/g) || []; // Lấy tất cả các số
      numbers.forEach(numStr => {
        const num = parseInt(numStr, 10);
        if (num > maxAmount && num > 1000) { // Giả định số tiền > 1000
          maxAmount = num;
        }
      });

      if(maxAmount > 0) {
        setAmount(maxAmount.toString());
      }

    } catch (error) {
      Alert.alert('Lỗi OCR', 'Không thể nhận diện được chữ.');
      console.error('OCR Error:', error);
    } finally {
      setLoadingOCR(false);
    }
  };
// ...

 return (
    <View style={styles.container}>
      <Text style={styles.label}>Mô tả</Text>
      <TextInput
        style={styles.input}
        placeholder="Ví dụ: Tiền ăn tối"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Số tiền</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      {/* PHẦN OCR (đã sửa) */}
      <View style={styles.ocrButtonContainer}>
        {loadingOCR ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <Button title="Quét hóa đơn (OCR)" onPress={handleScanReceipt} />
        )}
      </View>
      
      {/* PHẦN LƯU */}
      <View style={styles.saveButtonContainer}>
        <Button title="Lưu Chi Phí" onPress={handleSaveExpense} />
      </View>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  // Đổi tên style cho rõ ràng
  ocrButtonContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  saveButtonContainer: {
    marginTop: 10,
  }
});