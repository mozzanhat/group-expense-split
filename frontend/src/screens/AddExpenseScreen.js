import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  TouchableOpacity, ScrollView, ActivityIndicator, Switch 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api';
import { useAuth } from '../context/AuthContext'; 
import { formatCurrency } from '../utils/format'; 

export default function AddExpenseScreen({ route, navigation }) {
  const { user } = useAuth(); 
  const { groupId } = route.params; 

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  
  // ✅ THAY ĐỔI: Biến này giờ lưu số phần trăm (Ví dụ: "10")
  const [profitPercentage, setProfitPercentage] = useState(''); 
  
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data State
  const [members, setMembers] = useState([]);
  
  // Logic State
  const [involvedUserIds, setInvolvedUserIds] = useState([]); 
  const [profitPayerIds, setProfitPayerIds] = useState([]);   
  
  const [isCustomSplit, setIsCustomSplit] = useState(false);
  const [customAmounts, setCustomAmounts] = useState({});

  useEffect(() => {
    fetchGroupMembers();
  }, []);

  const fetchGroupMembers = async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      const groupMembers = response.data.members || [];
      setMembers(groupMembers);

      const allIds = groupMembers.map(m => m.user.id);
      setInvolvedUserIds(allIds);
      setProfitPayerIds(allIds);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải thành viên");
    }
  };

  const toggleUserSelection = (userId) => {
    if (involvedUserIds.includes(userId)) {
      setInvolvedUserIds(involvedUserIds.filter(id => id !== userId));
      setProfitPayerIds(profitPayerIds.filter(id => id !== userId));
      
      const newAmounts = {...customAmounts};
      delete newAmounts[userId];
      setCustomAmounts(newAmounts);
    } else {
      setInvolvedUserIds([...involvedUserIds, userId]);
      setProfitPayerIds([...profitPayerIds, userId]);
    }
  };

  const toggleProfitPayer = (userId) => {
    if (profitPayerIds.includes(userId)) {
      setProfitPayerIds(profitPayerIds.filter(id => id !== userId));
    } else {
      setProfitPayerIds([...profitPayerIds, userId]);
    }
  };

  const handleAmountChange = (userId, text) => {
    setCustomAmounts({
      ...customAmounts,
      [userId]: text
    });
  };

  const calculateRemaining = () => {
    const total = parseFloat(amount) || 0;
    let currentSum = 0;
    involvedUserIds.forEach(uid => {
        currentSum += parseFloat(customAmounts[uid] || 0);
    });
    return total - currentSum;
  };

  // Hàm phụ trợ: Tính toán chi tiết từng người
  const calculateSplits = () => {
      const totalAmount = parseFloat(amount) || 0;
      let splits = [];

      if (isCustomSplit) {
          splits = involvedUserIds.map(uid => ({
              userId: uid,
              amount: parseFloat(customAmounts[uid] || 0),
              paysProfit: profitPayerIds.includes(uid)
          }));
      } else {
          // Chia đều
          const share = involvedUserIds.length > 0 ? totalAmount / involvedUserIds.length : 0;
          splits = involvedUserIds.map(uid => ({
              userId: uid,
              amount: share,
              paysProfit: profitPayerIds.includes(uid)
          }));
      }
      return splits;
  };

  const handleSave = async () => {
    if (!description || !amount) {
      Alert.alert('Thiếu thông tin', 'Nhập tên và tổng số tiền!'); return;
    }
    if (involvedUserIds.length === 0) {
      Alert.alert('Lỗi', 'Phải chọn ít nhất 1 người!'); return;
    }

    const totalAmount = parseFloat(amount);
    const splitsData = calculateSplits();
    
    // Kiểm tra tổng tiền nhập tay
    if (isCustomSplit) {
        const sumCheck = splitsData.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(sumCheck - totalAmount) > 1000) {
            Alert.alert("Lỗi chia tiền", `Tổng tiền chia (${formatCurrency(sumCheck)}) không khớp với Gốc (${formatCurrency(totalAmount)}).`);
            return;
        }
    }

    setLoading(true);
    try {
      await api.post('/expenses', {
        description,
        amount: totalAmount,
        groupId,
        paidById: user.id,
        // Gửi số phần trăm lãi lên server
        profitPercentage: parseFloat(profitPercentage) || 0, 
        dueDate: dueDate.toISOString(),
        splits: splitsData 
      });
      
      Alert.alert('Thành công', 'Đã thêm khoản chi mới!');
      navigation.goBack(); 
    } catch (error) {
      console.log(error);
      const msg = error.response?.data?.error || "Lỗi server";
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  const remaining = calculateRemaining();
  
  // Tính tổng lãi dự kiến để hiển thị
  const currentSplits = calculateSplits();
  const totalEstimatedProfit = currentSplits.reduce((sum, s) => {
      if (s.paysProfit && profitPercentage) {
          return sum + (s.amount * parseFloat(profitPercentage) / 100);
      }
      return sum;
  }, 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Tên khoản chi</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Nhập tên..." />

      <Text style={styles.label}>Tổng số tiền gốc</Text>
      <TextInput 
        style={styles.input} value={amount} onChangeText={setAmount} 
        keyboardType="numeric" placeholder="0" 
      />

      {/* ✅ SỬA LABEL VÀ INPUT THÀNH % */}
      <Text style={styles.label}>Lãi suất (%)</Text>
      <TextInput 
        style={styles.input} 
        value={profitPercentage} 
        onChangeText={setProfitPercentage} 
        keyboardType="numeric" 
        placeholder="VD: 10" 
      />
      {/* Hiển thị tổng lãi dự kiến */}
      {parseFloat(profitPercentage) > 0 && (
          <Text style={{textAlign:'right', color:'#e67e22', fontStyle:'italic', marginTop: 5}}>
              Tổng lãi dự tính: {formatCurrency(totalEstimatedProfit)}
          </Text>
      )}

      <Text style={styles.label}>Hạn trả</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
        <Text style={styles.dateText}>📅 {dueDate.toLocaleDateString('vi-VN')}</Text>
      </TouchableOpacity>
      {showDatePicker && <DateTimePicker value={dueDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if(d) setDueDate(d); }} />}

      <View style={{marginTop: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
          <Text style={styles.sectionTitle}>Chia tiền: {isCustomSplit ? "Tự nhập số" : "Chia đều"}</Text>
          <Switch value={isCustomSplit} onValueChange={setIsCustomSplit} />
      </View>

      {isCustomSplit && (
          <Text style={{textAlign:'right', color: remaining === 0 ? 'green' : 'red', fontWeight:'bold'}}>
             {remaining === 0 ? "✅ Đã khớp đủ tiền" : `⚠️ Còn lại: ${formatCurrency(remaining)}`}
          </Text>
      )}

      <View style={styles.membersContainer}>
        {members.map((member) => {
          const isSelected = involvedUserIds.includes(member.user.id);
          
          return (
            <View key={member.user.id} style={styles.memberRow}>
                <TouchableOpacity 
                  style={[styles.memberBadge, isSelected ? styles.badgeSelected : styles.badgeUnselected]}
                  onPress={() => toggleUserSelection(member.user.id)}
                >
                  <Text style={[styles.memberText, isSelected ? styles.textSelected : styles.textUnselected]}>
                    {isSelected ? "☑️" : "⬜"} {member.user.name}
                  </Text>
                </TouchableOpacity>

                {isCustomSplit && isSelected && (
                    <TextInput 
                        style={styles.smallInput}
                        placeholder="Số tiền"
                        keyboardType="numeric"
                        value={customAmounts[member.user.id] || ''}
                        onChangeText={(t) => handleAmountChange(member.user.id, t)}
                    />
                )}
            </View>
          );
        })}
      </View>

      {/* --- PHẦN HIỂN THỊ NGƯỜI CHỊU LÃI --- */}
      {(parseFloat(profitPercentage) > 0) && (
        <View>
          <Text style={[styles.sectionTitle, { color: '#e67e22', marginTop: 20 }]}>Ai chịu lãi {profitPercentage}%?</Text>
          <View style={{flexDirection:'row', flexWrap:'wrap'}}>
            {members.map((member) => {
              if (!involvedUserIds.includes(member.user.id)) return null;
              
              const isProfitPayer = profitPayerIds.includes(member.user.id);
              
              // Tính lãi cụ thể cho người này để hiển thị
              let userPrincipal = 0;
              if (isCustomSplit) {
                  userPrincipal = parseFloat(customAmounts[member.user.id] || 0);
              } else {
                  userPrincipal = (parseFloat(amount) || 0) / involvedUserIds.length;
              }
              const userProfit = (userPrincipal * parseFloat(profitPercentage)) / 100;

              return (
                <TouchableOpacity 
                  key={`profit-${member.user.id}`} 
                  style={[styles.profitBadge, isProfitPayer ? styles.badgeProfit : styles.badgeUnselected]}
                  onPress={() => toggleProfitPayer(member.user.id)}
                >
                    <View>
                        <Text style={[styles.memberText, isProfitPayer ? {color: '#d35400', fontWeight:'bold'} : styles.textUnselected]}>
                            {isProfitPayer ? "💸" : "🙅"} {member.user.name}
                        </Text>
                        {/* Hiện luôn số tiền lãi họ phải trả */}
                        {isProfitPayer && (
                            <Text style={{fontSize: 10, color: '#d35400', textAlign: 'center'}}>
                                +{formatCurrency(userProfit)}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={{marginTop: 30, marginBottom: 50}}>
        {loading ? <ActivityIndicator size="large" color="blue" /> : <Button title="GỬI YÊU CẦU" onPress={handleSave} color="#28a745" />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, fontSize: 16, backgroundColor: '#f9f9f9' },
  dateButton: { padding: 15, backgroundColor: '#e6e6e6', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  dateText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#007bff' },
  membersContainer: { marginTop: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' },
  memberBadge: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, marginRight: 10 },
  badgeSelected: { backgroundColor: '#e7f1ff', borderColor: '#007bff' },
  badgeUnselected: { backgroundColor: '#f0f0f0', borderColor: '#ccc' },
  textSelected: { color: '#007bff', fontWeight: 'bold' },
  textUnselected: { color: '#777' },
  smallInput: { width: 120, borderWidth: 1, borderColor: '#28a745', borderRadius: 5, padding: 8, textAlign: 'right', fontWeight: 'bold' },
  profitBadge: { padding: 8, borderRadius: 10, borderWidth: 1, marginRight: 8, marginBottom: 8, minWidth: 80, alignItems: 'center' },
  badgeProfit: { backgroundColor: '#fadbd8', borderColor: '#e67e22' },
});