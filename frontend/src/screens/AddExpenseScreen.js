import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../api';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext'; 

//import { recognize } from '@react-native-ml-kit/text-recognition';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export default function AddExpenseScreen() {//
  const { user } = useAuth(); // Lấy thông tin user hiện tại
  const navigation = useNavigation();
  const route = useRoute();// 
  const { groupId } = route.params; // Lấy groupId được truyền từ màn hình Chi tiết

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const [loadingOCR, setLoadingOCR] = useState(false);


  // Hàm xử lý lưu
  const handleSaveExpense = async () => {
    if (!description || !amount) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả và số tiền.');
      return;
    }

    try {
      await api.post('/expenses', {
        description: description,
        amount: parseFloat(amount),
        groupId: groupId,
        paidById: user.id
      });

      Alert.alert('Thành công', 'Đã thêm chi phí mới.');
      navigation.goBack(); // Quay về màn hình trước  
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu chi phí.');
      console.error('Save expense error:', error);
    }
  };

  // ...
// HÀM XỬ LÝ QUÉT HÓA ĐƠN 
const handleScanReceipt = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.granted === false) {
    Alert.alert('Lỗi', 'Cần cấp quyền camera để quét hóa đơn.');
    return;
  }

  setLoadingOCR(true);
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
  });

  if (result.canceled) {
    setLoadingOCR(false);
    return; 
  }

  const imageUri = result.assets[0].uri;

  try {
    // Gửi ảnh đến ML Kit để nhận diện (Cách gọi mới)

    //const result = await recognize(imageUri);
    const result = await TextRecognition.recognize(imageUri);

    // 5. Xử lý kết quả (Logic mới)
    // Kết quả mới là một object, không phải mảng.
    // Toàn bộ text nằm trong 'result.text'
    if (!result || !result.text) {
      throw new Error('Không tìm thấy chữ');
    }

    const fullText = result.text;
    setDescription(fullText); // Nối tất cả text lại làm mô tả

    let maxAmount = 0;
    const numbers = fullText.match(/\d+/g) || []; 
    numbers.forEach(numStr => {
      const num = parseInt(numStr, 10);
      if (num > maxAmount && num > 1000) { 
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
        // Kết hợp style cũ và thêm style mới cho ô nhập nhiều dòng
        style={[styles.input, styles.textArea]} 
        placeholder="Ví dụ: Tiền ăn tối..."
        value={description}
        onChangeText={setDescription}
        
        // --- CÁC THUỘC TÍNH QUAN TRỌNG MỚI THÊM ---
        multiline={true}       // Cho phép xuống dòng
        numberOfLines={4}      // Chiều cao ước lượng khoảng 4 dòng
        textAlignVertical="top" // Giúp chữ bắt đầu từ trên cùng (fix lỗi Android)
        scrollEnabled={true}   // Cho phép cuộn nếu nội dung quá dài
      />

      <Text style={styles.label}>Số tiền</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      {/* PHẦN OCR */}
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
  },

  textArea: {
      height: 200, // Tăng chiều cao lên để chứa được nhiều dòng
      textAlignVertical: 'top', // Đảm bảo text nằm ở trên cùng
  }
});