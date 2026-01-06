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

        const members = await prisma.groupMember.findMany({ 
            where: { groupId }, include: { user: true } 
        });

        // Lấy chi phí và sắp xếp theo ngày (để dễ theo dõi)
        const expenses = await prisma.expense.findMany({ 
            where: { groupId },
            include: { splits: true },
            orderBy: { createdAt: 'asc' }
        });

        let totalGroupSpend = 0; 
        const balances = {}; 

        members.forEach(m => {
            balances[m.userId] = { 
                name: m.user.name, 
                paid: 0, owe: 0, 
            };
        });

        expenses.forEach(e => {
            const amount = parseFloat(e.amount);
            const payerId = e.paidById; // Người chi tiền (Người trả nợ)
            
            // 1. Kiểm tra xem có phải là trả nợ không
            const isDebtPayment = e.description.toLowerCase().includes("trả nợ") 
                               || e.description.toLowerCase().includes("thanh toán");

            // 🔥 LOGIC QUAN TRỌNG NHẤT:
            // Nếu là "Trả nợ" mà CHƯA XÁC NHẬN (isConfirmed == false) 
            // -> Bỏ qua ngay, coi như chưa trả, nợ vẫn y nguyên.
            if (isDebtPayment && !e.isConfirmed) {
                return; 
            }

            // 2. Nếu không phải trả nợ (là chi tiêu nhóm) -> Cộng vào tổng
            if (!isDebtPayment) {
                totalGroupSpend += amount;
            }

            // 3. Tính toán Ví (Chỉ chạy xuống đây nếu đã xác nhận hoặc là chi tiêu thường)
            
            // Người chi tiền (Đã trả)
            if (balances[payerId]) {
                balances[payerId].paid += amount;
            }

            // Người thụ hưởng (Đã nhận)
            const splitUsers = e.splits; 
            if (splitUsers.length > 0) {
                const sharePerPerson = amount / splitUsers.length;
                splitUsers.forEach(split => {
                    const uid = split.userId;
                    if (balances[uid]) {
                        balances[uid].owe += sharePerPerson;
                    }
                });
            } else {
                if (balances[payerId]) balances[payerId].owe += amount;
            }
        });

        const debts = Object.keys(balances).map(uid => {
            const userBalance = balances[uid];
            return {
                userId: parseInt(uid),
                name: userBalance.name,
                paid: userBalance.paid,
                spent: userBalance.owe, 
                balance: userBalance.paid - userBalance.owe 
            };
        });

        reply.send({ total: totalGroupSpend, debts });

    } catch (err) {
        console.error(err);
        reply.status(500).send(err);
    }
});

// --- API EXPENSE Thêm - khoản chi tiêu mới (Tạo hóa đơn) ---9------------------------------
// 7. API TẠO CHI PHÍ (CÓ HẠN TRẢ VÀ BẢO MẬT)
// Sửa app.post thành fastify.post
// 7. API TẠO CHI PHÍ (CÓ CHỌN NGƯỜI CHIA TIỀN)
fastify.post('/expenses', { onRequest: [authenticate] }, async (request, reply) => {
    // Nhận thêm involvedUserIds: Là mảng chứa ID những người phải trả tiền
    // Ví dụ gửi lên: { ..., "involvedUserIds": [1, 3] }
    const { description, amount, groupId, paidById, profit, dueDate, involvedUserIds } = request.body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (!description || !amount || !groupId || !paidById) {
        return reply.code(400).send({ error: "Thiếu thông tin bắt buộc" });
    }

    // Kiểm tra xem có chọn người chia tiền không
    if (!involvedUserIds || !Array.isArray(involvedUserIds) || involvedUserIds.length === 0) {
        return reply.code(400).send({ error: "Phải chọn ít nhất 1 người để chia tiền" });
    }

    try {
        // 2. Lưu vào Database (Dùng Transaction lồng nhau của Prisma)
        const expense = await prisma.expense.create({
            data: {
                description,
                amount: parseFloat(amount),
                groupId: parseInt(groupId),
                paidById: parseInt(paidById),
                profit: parseFloat(profit) || 0,
                dueDate: dueDate ? new Date(dueDate) : null,
                isConfirmed: false,
                
                // ✅ QUAN TRỌNG: Lưu danh sách người được chọn vào bảng ExpenseSplit
                splits: {
                    create: involvedUserIds.map(uid => ({
                        userId: parseInt(uid)
                    }))
                }
            },
            // Trả về kèm danh sách người chia tiền để frontend hiển thị nếu cần
            include: {
                splits: true 
            }
        });
        
        return reply.send(expense);

    } catch (error) {
        console.error("Lỗi thêm chi phí:", error);
        return reply.code(500).send({ error: "Lỗi server: Không thể lưu chi phí này" });
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
fastify.post('/groups/:id/settle', { onRequest: [authenticate] }, async (request, reply) => {
    const groupId = parseInt(request.params.id);
    // debtorId: ID người trả nợ (Người đưa tiền)
    // amount: Số tiền đã trả
    const { debtorId, amount } = request.body; 
    
    // Người đang thao tác chính là Người nhận tiền (receiver)
    const receiverId = request.user.id; 

    if (!debtorId || !amount) {
        return reply.code(400).send({ error: "Thiếu thông tin người trả hoặc số tiền" });
    }

    try {
        // Tìm tên người trả nợ để lưu vào mô tả cho đẹp
        const debtor = await prisma.user.findUnique({ where: { id: debtorId } });
        const debtorName = debtor ? debtor.name : "Thành viên";

        // TẠO KHOẢN TRẢ NỢ VÀ XÁC NHẬN LUÔN (isConfirmed: true)
        const settlement = await prisma.expense.create({
            data: {
                description: `Trả nợ cho ${request.user.name }`, // Ví dụ: Trả nợ cho Admin
                amount: parseFloat(amount),
                groupId: groupId,
                paidById: parseInt(debtorId), // Người chi là Người nợ
                profit: 0,
                isConfirmed: true, // <--- QUAN TRỌNG: Xác nhận luôn
                
                // Người thụ hưởng là Chính mình (Người đang bấm nút)
                splits: {
                    create: [{ userId: receiverId }]
                }
            }
        });

        return reply.send({ message: "Đã cập nhật công nợ thành công!", data: settlement });

    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Lỗi server khi thanh toán" });
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




start();