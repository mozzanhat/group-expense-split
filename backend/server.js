// backend/server.js (BẢN CHUẨN - ĐÃ FIX LỖI)
const fastify = require('fastify')({ logger: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();


// 1. Cấu hình CORS
fastify.register(require('@fastify/cors'), { origin: "*" });

// 2. Cấu hình JWT
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'supersecret123'
});

// Middleware xác thực
const authenticate = async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ message: 'Bạn chưa đăng nhập hoặc phiên đã hết hạn' });
  }
};

// --- API AUTH ---1 Đăng ký
fastify.post('/auth/register', async (request, reply) => {
  try {
    const { email, password, name } = request.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.status(400).send({ message: 'Email đã được sử dụng' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await prisma.user.create({
      data: { email, name, password: hashedPassword }
    });
    const { password: _, ...userWithoutPassword } = newUser;
    reply.status(201).send(userWithoutPassword);
  } catch (err) {
    reply.status(500).send({ message: 'Lỗi server' });
  }
});
//2 Đăng nhập
fastify.post('/auth/login', async (request, reply) => {
  try {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return reply.status(401).send({ message: 'Email hoặc mật khẩu không đúng' });
    }
    const token = fastify.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '7d' });
    reply.send({ token, message: 'Đăng nhập thành công' });
  } catch (err) {
    reply.status(500).send({ message: 'Lỗi server' });
  }
});
//3 Lấy thông tin user hiện tại
fastify.get('/users/me', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { id: true, email: true, name: true }
      });
      reply.send(user || {});
    } catch (err) { reply.status(500).send(err) }
});

// --- API GROUP ---4 Lấy danh sách nhóm của user
fastify.get('/groups', { onRequest: [authenticate] }, async (request, reply) => {
  try {
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: request.user.id } } }
    });
    reply.send(groups);
  } catch (err) { reply.status(500).send(err) }
});
//5 Tạo nhóm mới
fastify.post('/groups', { onRequest: [authenticate] }, async (request, reply) => {
  try {
    const { name } = request.body;
    const newGroup = await prisma.group.create({
      data: {
        name: name,
        creatorId: request.user.id,
        members: { create: { userId: request.user.id } }
      }
    });
    reply.send(newGroup);
  } catch (error) {
    reply.status(500).send({ error: 'Không thể tạo nhóm' });
  }
});
//6 Lấy chi tiết nhóm
fastify.get('/groups/:id', { onRequest: [authenticate] }, async (request, reply) => {
  try {
    const groupId = parseInt(request.params.id);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        expenses: { include: { paidBy: { select: { id: true, name: true } } } }
      }
    });
    reply.send(group);
  } catch (err) { reply.status(500).send(err) }
});
//7 Thêm thành viên vào nhóm
fastify.post('/groups/:id/members', { onRequest: [authenticate] }, async (request, reply) => {
    try {
        const { email } = request.body;
        const groupId = parseInt(request.params.id);
        const userToInvite = await prisma.user.findUnique({ where: { email } });
        if(!userToInvite) return reply.status(404).send({message: "Không tìm thấy email"});
        
        await prisma.groupMember.create({
            data: { userId: userToInvite.id, groupId }
        });
        reply.send({message: "Đã thêm"});
    } catch(err) { reply.status(500).send(err) }
});

// backend/server.js  8 Tính toán số nợ trong nhóm------------------------------------

fastify.get('/groups/:id/debts', { onRequest: [authenticate] }, async (request, reply) => {
    try {
        const groupId = parseInt(request.params.id);
        
        // 1. Lấy thành viên
        const members = await prisma.groupMember.findMany({ 
            where: { groupId }, 
            include: { user: true } 
        });

        // 2. Lấy chi phí đã duyệt (Hàng chính)
        const expenses = await prisma.expense.findMany({ 
            where: { groupId, isApproved: true },
            include: { splits: true },
            orderBy: { createdAt: 'asc' }
        });

        // 3. Lấy hàng chờ (Để hiển thị thôi)
        const pendingExpenses = await prisma.expense.findMany({
            where: { groupId, isApproved: false },
            include: { splits: true, paidBy: true }
        });

        // 4. Khởi tạo biến
        const pendingSettlements = {}; 
        let totalGroupSpend = 0; 
        const debtMap = {}; 
        const userStats = {}; 

        members.forEach(m => {
            userStats[m.userId] = { 
                id: m.userId, name: m.user.name, paidOriginal: 0, received: 0 
            };
        });

        // Helper thêm nợ
        const addDebt = (fromId, toId, amount, date) => {
             const key = `${fromId}-${toId}`;
             if (!debtMap[key]) debtMap[key] = { amount: 0, earliestDueDate: null };
             debtMap[key].amount += amount;
             if (date) {
                const currentDue = debtMap[key].earliestDueDate;
                if (!currentDue || new Date(date) < new Date(currentDue)) {
                    debtMap[key].earliestDueDate = date;
                }
             }
        };

        // 5. DUYỆT QUA TỪNG KHOẢN CHI (Vòng lặp quan trọng)
        expenses.forEach(e => {
            const amount = parseFloat(e.amount);
            const payerId = e.paidById;
            
            // Kiểm tra xem có phải là Trả nợ (Settlement) không
            const isSettlement = e.description.toLowerCase().includes("trả nợ") || e.isConfirmed === true; 

            if (isSettlement) {
                // ... (Logic trả nợ giữ nguyên) ...
                if (e.isConfirmed) {
                    e.splits.forEach(s => {
                        const key = `${payerId}-${s.userId}`;
                        if (debtMap[key]) debtMap[key].amount -= amount;
                        if (userStats[s.userId]) userStats[s.userId].received += amount;
                    });
                } else {
                    e.splits.forEach(s => {
                        const key = `${payerId}-${s.userId}`;
                        pendingSettlements[key] = { expenseId: e.id, amount: amount };
                    });
                }
                return; 
            }

            // --- XỬ LÝ CHI TIÊU THƯỜNG ---
            totalGroupSpend += amount;
            if (userStats[payerId]) userStats[payerId].paidOriginal += amount;
            
            const splitUsers = e.splits;
            
            // B1. CHIA TIỀN GỐC (Principal)
            // Lấy trực tiếp từ amount đã lưu trong split
            if (splitUsers.length > 0) {
                 // Nếu là bản ghi cũ chưa có amount riêng, thì chia đều (fallback)
                 const fallbackShare = amount / splitUsers.length;

                 splitUsers.forEach(split => {
                    // Ưu tiên lấy split.amount, nếu bằng 0 (data cũ) thì lấy fallback
                    const debtAmount = split.amount > 0 ? split.amount : fallbackShare;
                    addDebt(split.userId, payerId, debtAmount, e.dueDate);
                 });
            }

            // ==========================================================
            // ✅ B2. CHIA TIỀN LÃI (Logic tỷ lệ thuận bạn vừa hỏi)
            // ==========================================================
            if (e.profit > 0) {
                const profitPayers = splitUsers.filter(s => s.paysProfit);
                
                // Tính tổng tiền gốc của những người chịu lãi
                const totalPrincipalOfProfitPayers = profitPayers.reduce((sum, s) => sum + s.amount, 0);
                
                if (totalPrincipalOfProfitPayers > 0) {
                    // Tính ra tỷ lệ phần trăm thực tế từ dữ liệu đã lưu
                    // Ví dụ: Tổng lãi 100k, Tổng gốc chịu lãi 1tr => Tỷ lệ = 0.1 (10%)
                    const impliedPercentage = e.profit / totalPrincipalOfProfitPayers; 
        
                    profitPayers.forEach(payer => {
                        // Tiền lãi phải trả = Tiền gốc của người đó * Tỷ lệ
                        const profitShare = payer.amount * impliedPercentage;
                        addDebt(payer.userId, payerId, profitShare, e.dueDate);
                    });
                }
            }
            // ==========================================================
        });

        // 6. Tổng hợp dữ liệu trả về (Giữ nguyên)
        const finalData = members.map(m => {
            const uid = m.userId;
            
            const iOwe = [];
            members.forEach(other => {
                const key = `${uid}-${other.userId}`;
                if (debtMap[key] && debtMap[key].amount > 50) { 
                    iOwe.push({
                        toId: other.userId,
                        toName: other.user.name,
                        amount: debtMap[key].amount,
                        dueDate: debtMap[key].earliestDueDate,
                        pending: pendingSettlements[`${uid}-${other.userId}`] || null 
                    });
                }
            });

            const owesMe = [];
            members.forEach(other => {
                const key = `${other.userId}-${uid}`;
                if (debtMap[key] && debtMap[key].amount > 50) {
                    owesMe.push({
                        fromId: other.userId,
                        fromName: other.user.name,
                        amount: debtMap[key].amount,
                        dueDate: debtMap[key].earliestDueDate,
                        pending: pendingSettlements[`${other.userId}-${uid}`] || null
                    });
                }
            });

            return {
                userId: uid,
                name: m.user.name,
                paidOriginal: userStats[uid].paidOriginal,
                received: userStats[uid].received,
                debts: iOwe,
                credits: owesMe
            };
        });

        reply.send({ total: totalGroupSpend, debts: finalData, pendingExpenses });

    } catch (err) {
        console.error(err);
        reply.status(500).send(err);
    }
});

// --- API EXPENSE Thêm - khoản chi tiêu mới (Tạo hóa đơn) ---9------------------------------
// 1. CẬP NHẬT API TẠO CHI PHÍ (POST /expenses)
// --- API TẠO CHI PHÍ MỚI (Cập nhật tính lãi theo %) ---
fastify.post('/expenses', { onRequest: [authenticate] }, async (request, reply) => {
    // Nhận profitPercentage (số %) từ Frontend gửi lên
    const { description, amount, groupId, paidById, profitPercentage, dueDate, splits } = request.body;

    const totalAmount = parseFloat(amount);

    // Validate: Tổng tiền chia phải khớp với tổng gốc
    const totalSplitAmount = splits.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(totalSplitAmount - totalAmount) > 1000) { 
         return reply.code(400).send({ error: "Tổng tiền chia không khớp với số tiền gốc!" });
    }

    try {
        const creatorId = request.user.id;
        const isAutoApproved = splits.length === 1 && splits[0].userId === creatorId;
        
        // --- LOGIC TÍNH LÃI MỚI ---
        let calculatedTotalProfit = 0;

        const splitsWithProfit = splits.map(s => {
            // Tính lãi riêng cho từng người: (Gốc * % lãi) / 100
            let individualProfit = 0;
            // Chỉ tính nếu người đó phải chịu lãi (paysProfit = true) và có nhập %
            if (s.paysProfit && profitPercentage > 0) {
                individualProfit = (s.amount * parseFloat(profitPercentage)) / 100;
            }
            
            calculatedTotalProfit += individualProfit;

            return {
                userId: parseInt(s.userId),
                amount: parseFloat(s.amount),
                paysProfit: s.paysProfit || false,
                hasApproved: parseInt(s.userId) === creatorId,
            };
        });

        const expense = await prisma.expense.create({
            data: {
                description,
                amount: totalAmount,
                groupId: parseInt(groupId),
                paidById: parseInt(paidById),
                
                // QUAN TRỌNG: Lưu tổng số tiền lãi vừa tính được vào Database
                profit: calculatedTotalProfit, 
                
                dueDate: dueDate ? new Date(dueDate) : null,
                isConfirmed: false,
                isApproved: isAutoApproved,

                splits: {
                    create: splitsWithProfit
                }
            }
        });
        return reply.send(expense);
    } catch (error) {
        console.error("Lỗi tạo chi phí:", error);
        return reply.code(500).send({ error: "Lỗi server" });
    }
});

// . API BIỂU QUYẾT (Đồng ý / Không đồng ý)16 ------------------------------------------------
fastify.post('/expenses/:id/vote', { onRequest: [authenticate] }, async (request, reply) => {
    const expenseId = parseInt(request.params.id);
    const userId = request.user.id;
    const { action } = request.body; // "AGREE" hoặc "REJECT"

    try {
        if (action === "REJECT") {
            // LOGIC: Nếu không đồng ý -> Xóa khỏi danh sách splits
            await prisma.expenseSplit.deleteMany({
                where: { expenseId, userId }
            });
        } else {
            // LOGIC: Đồng ý -> Cập nhật hasApproved = true
            await prisma.expenseSplit.updateMany({
                where: { expenseId, userId },
                data: { hasApproved: true }
            });
        }

        // KIỂM TRA: Xem tất cả những người CÒN LẠI đã đồng ý hết chưa?
        const remainingSplits = await prisma.expenseSplit.findMany({
            where: { expenseId }
        });

        // Nếu danh sách rỗng (ai cũng từ chối hết) -> Xóa luôn expense hoặc để đó tùy bạn
        if (remainingSplits.length === 0) {
            // Tùy chọn: Xóa expense rỗng
            await prisma.expense.delete({ where: { id: expenseId } });
            return reply.send({ message: "Khoản chi đã bị hủy do tất cả từ chối" });
        }

        // Kiểm tra xem có ai chưa duyệt không
        const allApproved = remainingSplits.every(split => split.hasApproved === true);

        if (allApproved) {
            // Nếu tất cả còn lại đều OK -> Chuyển sang HÀNG CHÍNH
            await prisma.expense.update({
                where: { id: expenseId },
                data: { isApproved: true }
            });
            return reply.send({ message: "Đã duyệt! Khoản chi chuyển sang hàng chính." });
        }

        return reply.send({ message: "Đã ghi nhận phiếu bầu. Chờ thành viên khác..." });

    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Lỗi xử lý biểu quyết" });
    }
});

// === API XÓA CHI PHÍ === 10
fastify.delete('/expenses/:id', { onRequest: [authenticate] }, async (request, reply) => {
  try {
    const expenseId = parseInt(request.params.id);
    const userId = request.user.id; // Người đang thực hiện thao tác

    // 1. Tìm khoản chi phí đó xem có tồn tại không
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { group: true } // Lấy thông tin nhóm để check quyền Admin
    });

    if (!expense) {
      return reply.status(404).send({ message: 'Không tìm thấy khoản chi' });
    }

    // 2. Kiểm tra quyền: Chỉ cho phép "Người trả tiền" HOẶC "Trưởng nhóm" xóa
    const isPayer = expense.paidById === userId;
    const isGroupAdmin = expense.group.creatorId === userId;

    if (!isPayer && !isGroupAdmin) {
      return reply.status(403).send({ message: 'Bạn không có quyền xóa khoản này' });
    }

    // 3. Thực hiện xóa
    await prisma.expense.delete({
      where: { id: expenseId }
    });

    reply.send({ message: 'Đã xóa thành công' });

  } catch (err) {
    reply.status(500).send({ message: 'Lỗi server' });
  }
});

// === API SỬA CHI PHÍ ===  11------------------------------------------------
// API SỬA CHI PHÍ (CÓ BẢO MẬT: CHÍNH CHỦ MỚI ĐƯỢC SỬA)
fastify.put('/expenses/:id', { onRequest: [authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { description, amount, profit, dueDate } = request.body;
    
    // Lấy ID của người đang thực hiện thao tác này (từ Token đăng nhập)
    const currentUserId = request.user.id; 

    try {
        // BƯỚC 1: Tìm xem khoản chi này có tồn tại không và ai là chủ
        const existingExpense = await prisma.expense.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingExpense) {
            return reply.code(404).send({ error: "Khoản chi không tồn tại" });
        }

        // BƯỚC 2: Kiểm tra quyền sở hữu (Quan trọng nhất)
        // Nếu người tạo (paidById) KHÁC với người đang sửa (currentUserId) -> Chặn ngay
        if (existingExpense.paidById !== currentUserId) {
            return reply.code(403).send({ 
                error: "Bạn không có quyền sửa khoản chi của người khác!" 
            });
        }

        // BƯỚC 3: Nếu là chính chủ thì mới cho cập nhật
        const updatedExpense = await prisma.expense.update({
            where: { id: parseInt(id) },
            data: {
                description,
                amount: parseFloat(amount),
                profit: parseFloat(profit) || 0,
                // Xử lý ngày tháng
                dueDate: dueDate ? new Date(dueDate) : null 
            }
        });

        return reply.send(updatedExpense);

    } catch (error) {
        console.error("Lỗi sửa chi phí:", error);
        return reply.code(500).send({ error: "Lỗi server" });
    }
});

// === API XÓA NHÓM (Có kiểm tra điều kiện) ===  12
fastify.delete('/groups/:id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;

        // 1. Tìm nhóm để kiểm tra quyền
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return reply.status(404).send({ message: 'Nhóm không tồn tại' });

        // 2. Chỉ Trưởng nhóm (người tạo) mới được xóa
        if (group.creatorId !== userId) {
            return reply.status(403).send({ message: 'Chỉ trưởng nhóm mới được quyền xóa' });
        }

        // 3. KIỂM TRA QUAN TRỌNG: Nhóm có chi phí nào chưa?
        const expenseCount = await prisma.expense.count({
            where: { groupId: groupId }
        });

        if (expenseCount > 0) {
            // Nếu đã có chi phí -> BÁO LỖI, KHÔNG CHO XÓA
            return reply.status(400).send({ 
                message: 'Không thể xóa nhóm đã có chi phí phát sinh!' 
            });
        }

        // 4. Nếu chưa có chi phí -> Xóa thành viên trước, rồi xóa nhóm
        // (Dùng transaction để đảm bảo an toàn)
        await prisma.$transaction([
            prisma.groupMember.deleteMany({ where: { groupId: groupId } }), // Xóa hết thành viên
            prisma.group.delete({ where: { id: groupId } })                 // Xóa nhóm
        ]);

        reply.send({ message: 'Đã xóa nhóm thành công' });

    } catch (err) {
        console.error(err);
        reply.status(500).send({ message: 'Lỗi server' });

    }
});

// === API SỬA TÊN NHÓM === 13
fastify.put('/groups/:id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
        const { name } = req.body; // Lấy tên mới từ Frontend gửi lên

        // 1. Kiểm tra nhóm tồn tại
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return reply.status(404).send({ message: 'Nhóm không tồn tại' });

        // 2. Chỉ Trưởng nhóm (người tạo) mới được sửa
        if (group.creatorId !== userId) {
            return reply.status(403).send({ message: 'Chỉ trưởng nhóm mới được đổi tên' });
        }

        // 3. Cập nhật tên mới
        const updatedGroup = await prisma.group.update({
            where: { id: groupId },
            data: { name: name }
        });

        reply.send(updatedGroup);

    } catch (err) {
        console.error(err);
        reply.status(500).send({ message: 'Lỗi server' });
    }
});

// API XÁC NHẬN ĐÃ NHẬN TIỀN (CONFIRM)--------------------------------------------
fastify.put('/expenses/:id/confirm', { onRequest: [authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.id; // Người đang bấm nút

    try {
        // 1. Tìm khoản chi và danh sách người thụ hưởng
        const expense = await prisma.expense.findUnique({
            where: { id: parseInt(id) },
            include: { splits: true }
        });

        if (!expense) return reply.code(404).send({ error: "Không tìm thấy khoản chi" });

        // 2. Kiểm tra quyền xác nhận
        // Chỉ có người "được nhận tiền" (nằm trong splits) mới có quyền xác nhận
        // Ví dụ: A trả nợ cho B. Splits = [B]. Thì chỉ B mới được bấm Confirm.
        const isReceiver = expense.splits.some(s => s.userId === currentUserId);
        const isCreator = expense.paidById === currentUserId;

        // Cho phép Người nhận tiền HOẶC Admin nhóm (nếu có logic admin) xác nhận.
        // Ở đây mình cho phép Người thụ hưởng (Receiver) xác nhận.
        if (!isReceiver) {
            return reply.code(403).send({ error: "Bạn không phải người nhận tiền, bạn không thể xác nhận!" });
        }

        // 3. Cập nhật trạng thái
        const updated = await prisma.expense.update({
            where: { id: parseInt(id) },
            data: { isConfirmed: true }
        });

        return reply.send({ message: "Đã xác nhận thanh toán thành công!", data: updated });

    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Lỗi server" });
    }
});

// API: THANH TOÁN NHANH (Người nhận tiền xác nhận người nợ đã trả)--------------------
// API: THANH TOÁN NHANH (Người nhận tiền xác nhận người nợ đã trả)
fastify.post('/groups/:id/settle', { onRequest: [authenticate] }, async (request, reply) => {
    const groupId = parseInt(request.params.id);
    const { debtorId, amount } = request.body; 
    const receiverId = request.user.id; // ID người đang bấm nút

    if (!debtorId || !amount) {
        return reply.code(400).send({ error: "Thiếu thông tin người trả hoặc số tiền" });
    }

    try {
        // ✅ SỬA LỖI TẠI ĐÂY:
        // Lấy thông tin cả Người trả (Debtor) và Người nhận (Receiver/User hiện tại)
        const [debtor, receiver] = await prisma.$transaction([
            prisma.user.findUnique({ where: { id: parseInt(debtorId) } }),
            prisma.user.findUnique({ where: { id: receiverId } })
        ]);

        const debtorName = debtor ? debtor.name : "Thành viên";
        const receiverName = receiver ? receiver.name : "bạn"; // Lấy tên thật từ DB

        // TẠO KHOẢN TRẢ NỢ
        const settlement = await prisma.expense.create({
            data: {
                // ✅ Dùng receiverName vừa lấy từ DB
                description: `Trả nợ cho ${receiverName}`, 
                amount: parseFloat(amount),
                groupId: groupId,
                paidById: parseInt(debtorId),
                profit: 0,
                isConfirmed: true, 
                // Mặc định là Approved (Hàng chính) luôn vì đây là xác nhận thanh toán
                isApproved: true, 
                
                splits: {
                    create: [{ 
                        userId: receiverId,
                        hasApproved: true // Người nhận tự tạo nên coi như đã duyệt
                    }]
                }
            }
        });

        return reply.send({ message: "Đã cập nhật công nợ thành công!", data: settlement });

    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Lỗi server khi thanh toán" });
    }
});

// 1. API: NGƯỜI NỢ BÁO ĐÃ TRẢ (Tạo khoản nợ chờ xác nhận)
fastify.post('/groups/:id/notify-payment', { onRequest: [authenticate] }, async (request, reply) => {
    const groupId = parseInt(request.params.id);
    const { creditorId, amount } = request.body; // Trả cho ai, bao nhiêu
    const debtorId = request.user.id; // Người đang bấm nút

    try {
        const creditor = await prisma.user.findUnique({ where: { id: creditorId } });
        
        // Tạo khoản chi nhưng chưa Confirm
        await prisma.expense.create({
            data: {
                description: `Trả nợ cho ${creditor.name}`,
                amount: parseFloat(amount),
                groupId: groupId,
                paidById: debtorId, 
                profit: 0,
                isConfirmed: false, // <--- QUAN TRỌNG: Chờ người nhận xác nhận
                isApproved: true,   // Hàng chính (không cần vote)
                splits: {
                    create: [{ userId: creditorId, hasApproved: true }]
                }
            }
        });

        return reply.send({ message: "Đã gửi thông báo trả nợ!" });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Lỗi server" });
    }
});

// 2. API: TỪ CHỐI THANH TOÁN (Xóa khoản chờ)
fastify.post('/expenses/:id/reject', { onRequest: [authenticate] }, async (request, reply) => {
    const expenseId = parseInt(request.params.id);
    // Logic: Xóa khoản chi này đi
    await prisma.expense.delete({ where: { id: expenseId } });
    return reply.send({ message: "Đã từ chối thanh toán" });
});

// 1. API LẤY THÔNG TIN PROFILE (Chi tiết)
fastify.get('/profile', { onRequest: [authenticate] }, async (request, reply) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: request.user.id }
        });
        // Loại bỏ password trước khi trả về
        const { password, ...userData } = user;
        return reply.send(userData);
    } catch (error) {
        return reply.code(500).send({ error: "Lỗi lấy thông tin" });
    }
});

// 2. API CẬP NHẬT PROFILE
fastify.put('/profile', { onRequest: [authenticate] }, async (request, reply) => {
    const { 
        name, username, password, phone, address, 
        gender, dob, cccd, bankAccount, bankBin, bankName 
    } = request.body;

    try {
        const updateData = {
            name, username, phone, address, gender, cccd,
            bankAccount, bankBin, bankName,
            dob: dob ? new Date(dob) : null
        };

        // Nếu có gửi mật khẩu mới lên thì mới cập nhật và mã hóa
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const updatedUser = await prisma.user.update({
            where: { id: request.user.id },
            data: updateData
        });

        // Loại bỏ password khi trả về
        const { password: _, ...userNoPass } = updatedUser;
        return reply.send(userNoPass);

    } catch (error) {
        console.error(error);
        // Kiểm tra lỗi trùng unique (ví dụ trùng username)
        if (error.code === 'P2002') {
            return reply.code(400).send({ error: "Tên đăng nhập hoặc SĐT đã tồn tại" });
        }
        return reply.code(500).send({ error: "Lỗi cập nhật thông tin" });
    }
});



// Khởi động server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log("Server đang chạy tại http://0.0.0.0:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};




//new 1.1.1

start();