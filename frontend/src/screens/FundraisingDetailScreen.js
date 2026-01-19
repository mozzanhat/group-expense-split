import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Button, Alert, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function FundraisingDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { fundraisingId, groupId } = route.params;

  const [details, setDetails] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [myContribution, setMyContribution] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    try {
      const response = await api.get(`/fundraisings/${fundraisingId}`);
      setDetails(response.data.info);
      setContributions(response.data.contributions);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải thông tin gọi vốn");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  const handleContribute = async () => {
    const amount = parseFloat(myContribution);
    if (!amount || amount <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ");
      return;
    }

    const remaining = details.targetAmount - details.currentAmount;
    // Cho phép nhập dư một chút (dưới 1000đ) để làm tròn, nếu quá lớn thì cảnh báo
    if (amount > remaining + 1000) {
        Alert.alert("Lưu ý", `Chỉ cần thêm ${formatCurrency(remaining)} là đủ. Bạn đang nhập dư quá nhiều.`, [
            { text: "Hủy" },
            { text: "Góp đúng số thiếu", onPress: () => submitContribution(remaining) }
        ]);
        return;
    }

    // Nếu nhập dư chút ít thì tự động cắt về đúng số còn thiếu
    const finalAmount = amount > remaining ? remaining : amount;
    submitContribution(finalAmount);
  };

  const submitContribution = async (amountVal) => {
    try {
      await api.post(`/fundraisings/${fundraisingId}/contribute`, {
        amount: amountVal,
        userId: user.id
      });
      Alert.alert("Thành công", "Đã góp vốn thành công!");
      setMyContribution('');
      
      // Tải lại dữ liệu mới nhất
      await fetchDetails();
      
      // Kiểm tra nếu đã đủ tiền (logic tương đối ở frontend, backend đã xử lý chính)
      if (parseFloat(details.currentAmount) + amountVal >= parseFloat(details.targetAmount)) {
         Alert.alert("🎉 Hoàn tất!", "Đã gọi vốn đủ! Chi phí đã được chuyển vào hàng chờ duyệt.", [
             { text: "OK", onPress: () => navigation.navigate('GroupDetail', { groupId, groupName: "Nhóm" }) }
         ]);
      }

    } catch (error) {
      Alert.alert("Lỗi", error.response?.data?.message || "Góp vốn thất bại");
    }
  };

  const handleDelete = async () => {
      try {
          await api.delete(`/fundraisings/${fundraisingId}`);
          Alert.alert("Đã xóa", "Đã hủy đợt gọi vốn này.");
          navigation.goBack();
      } catch (e) { Alert.alert("Lỗi", "Không thể xóa"); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (!details) return null;

  const progress = details.currentAmount / details.targetAmount;
  const isCreator = details.creatorId === user.id;
  const remainingAmount = details.targetAmount - details.currentAmount;

  return (
    <View style={styles.container}>
      <ScrollView>
          <View style={styles.card}>
            <Text style={styles.title}>{details.description}</Text>
            <Text style={styles.subtitle}>Lãi suất: <Text style={{fontWeight:'bold', color: '#d84315'}}>{details.interestRate}%</Text></Text>
            
            <View style={styles.progressRow}>
                <Text style={styles.label}>Tiến độ:</Text>
                <Text style={styles.value}>{formatCurrency(details.currentAmount)} / {formatCurrency(details.targetAmount)}</Text>
            </View>
            
            {/* Thanh Progress */}
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {width: `${Math.min(progress*100, 100)}%`}]} />
            </View>
            <Text style={{textAlign:'right', fontSize: 12, marginBottom: 10, marginTop: 2}}>
                Đạt {(progress*100).toFixed(0)}%
            </Text>

            {progress < 1 ? (
                <View style={styles.inputContainer}>
                    <Text style={{marginBottom: 5, fontWeight:'bold'}}>Nhập số tiền bạn muốn góp:</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="VD: 200000"
                        keyboardType="numeric"
                        value={myContribution}
                        onChangeText={setMyContribution}
                    />
                    <Button title="💰 Góp Vốn Ngay" onPress={handleContribute} />
                    
                    {/* Gợi ý góp phần còn thiếu */}
                    <TouchableOpacity onPress={() => setMyContribution(remainingAmount.toString())} style={{marginTop: 10}}>
                        <Text style={styles.hintText}>
                            👉 Góp toàn bộ số còn thiếu ({formatCurrency(remainingAmount)})
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.completedBox}>
                    <Text style={styles.completedText}>✅ Đã gọi vốn thành công!</Text>
                    <Text style={{fontSize:12, color:'green'}}>Chi phí đang chờ duyệt trong danh sách.</Text>
                </View>
            )}
          </View>

          <Text style={styles.sectionHeader}>Danh sách thành viên đã góp:</Text>
          {contributions.map((c, index) => (
              <View key={index} style={styles.contributorItem}>
                  <Text style={styles.contributorName}>{c.user.name}</Text>
                  <Text style={styles.contributorAmount}>+{formatCurrency(c.amount)}</Text>
                  <Text style={styles.contributorDate}>{formatDate(c.createdAt)}</Text>
              </View>
          ))}

          {contributions.length === 0 && <Text style={{textAlign:'center', color:'#999', marginTop: 10}}>Chưa có ai góp vốn.</Text>}
          
          <View style={{height: 20}} />
      </ScrollView>

      {/* Chỉ người tạo mới được xóa */}
      {isCreator && (
          <View style={{padding: 10}}>
              <Button title="Hủy Gọi Vốn" color="red" onPress={() => Alert.alert("Cảnh báo", "Bạn muốn hủy đợt gọi vốn này?", [{text:"Hủy"}, {text:"Xóa", onPress: handleDelete}])} />
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: 'white', padding: 20, margin: 10, borderRadius: 10, elevation: 3 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 16, marginBottom: 15, color: '#555' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressBarBg: { height: 12, backgroundColor: '#e0e0e0', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4caf50' },
  inputContainer: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10, fontSize: 16, backgroundColor: '#fafafa' },
  hintText: { color: '#1976d2', textDecorationLine: 'underline', textAlign: 'center', fontSize: 13 },
  completedBox: { marginTop: 10, padding: 15, backgroundColor: '#e8f5e9', borderRadius: 5, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9' },
  completedText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginLeft: 15, marginTop: 10, color: '#444' },
  contributorItem: { flexDirection: 'row', backgroundColor: 'white', padding: 15, marginHorizontal: 10, marginTop: 5, borderRadius: 5, justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  contributorName: { fontWeight: 'bold', fontSize: 15, color: '#333' },
  contributorAmount: { color: '#2e7d32', fontWeight: 'bold', fontSize: 15 },
  contributorDate: { color: '#999', fontSize: 11 }
});