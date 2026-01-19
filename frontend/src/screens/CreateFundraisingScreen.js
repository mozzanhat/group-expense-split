import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import api from '../api';

export default function CreateFundraisingScreen({ route, navigation }) {
  const { groupId } = route.params;
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!description || !targetAmount) {
       Alert.alert("Thiếu thông tin", "Vui lòng nhập tên và số tiền mục tiêu");
       return;
    }

    setLoading(true);
    try {
       await api.post('/fundraisings', {
           groupId,
           description,
           targetAmount: parseFloat(targetAmount),
           interestRate: parseFloat(interestRate) || 0
       });
       Alert.alert("Thành công", "Đã tạo đợt gọi vốn! Các thành viên có thể bắt đầu đóng góp.");
       navigation.goBack();
    } catch (error) {
       Alert.alert("Lỗi", "Không thể tạo gọi vốn");
    } finally {
       setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
       <Text style={styles.header}>Tạo Đợt Gọi Vốn Mới 📢</Text>

       <Text style={styles.label}>Mục đích</Text>
       <TextInput 
         style={styles.input} 
         value={description} 
         onChangeText={setDescription} 
         placeholder="VD: Mua Tủ Lạnh,..." 
       />

       <Text style={styles.label}>Tổng số tiền cần có (VNĐ)</Text>
       <TextInput 
         style={styles.input} 
         value={targetAmount} 
         onChangeText={setTargetAmount} 
         keyboardType="numeric" 
         placeholder="VD: 1000000" 
       />

       <Text style={styles.label}>Lãi suất trả cho người góp (%)</Text>
       <Text style={styles.hint}>Nhập 0 nếu không tính lãi.</Text>
       <TextInput 
         style={styles.input} 
         value={interestRate} 
         onChangeText={setInterestRate} 
         keyboardType="numeric" 
         placeholder="VD: 10 %" 
       />

       <View style={styles.btnContainer}>
         {loading ? <ActivityIndicator color="blue" /> : <Button title="Bắt đầu Gọi Vốn" onPress={handleSubmit} />}
       </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'white' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 5 },
  subHeader: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: '#333' },
  hint: { fontSize: 12, color: '#888', marginBottom: 5, fontStyle: 'italic' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f9f9f9' },
  btnContainer: { marginTop: 30 }
});