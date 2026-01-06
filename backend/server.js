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

// backend/server.js  8 Tính toán số nợ trong nhóm
fastify.get('/groups/:id/debts', { onRequest: [authenticate] }, async (request, reply) => {
    try {
        const groupId = parseInt(request.params.id);
        const members = await prisma.groupMember.findMany({ where: { groupId }, include: { user: true } });
        const expenses = await prisma.expense.findMany({ where: { groupId } });

        let total = 0; // Tổng chi phí trong nhóm
        const balances = {};// Đối tượng lưu số tiền đã trả và số dư của mỗi thành viên

        members.forEach(m => balances[m.userId] = { name: m.user.name, paid: 0, balance: 0 }); 

        expenses.forEach(e => {
            if(balances[e.paidById]) {
                balances[e.paidById].paid += e.amount;
            }

            const isDebtPayment = e.description.includes("Trả nợ") || e.description.includes("Thanh toán");
            
            if (!isDebtPayment) {
                total += parseFloat(e.amount); 
            }
        });

        const share = members.length ? total / members.length : 0;
        
        const debts = Object.keys(balances).map(uid => ({
            userId: parseInt(uid), 
            name: balances[uid].name, 
            paid: balances[uid].paid, 
            balance: balances[uid].paid - share
        }));

        reply.send({ total, sharePerPerson: share, debts }); 

    } catch(err) { reply.status(500).send(err) }
});

// --- API EXPENSE Thêm - khoản chi tiêu mới (Tạo hóa đơn) ---9------------------------------
// 7. API TẠO CHI PHÍ (CÓ HẠN TRẢ VÀ BẢO MẬT)
// Sửa app.post thành fastify.post
fastify.post('/expenses', { onRequest: [authenticate] }, async (request, reply) => {
    // Lấy dữ liệu từ App gửi lên
    const { description, amount, groupId, paidById, profit, dueDate } = request.body;

    // 1. Kiểm tra dữ liệu đầu vào (Validation)
    if (!description || !amount || !groupId || !paidById) {
        return reply.code(400).send({ error: "Thiếu thông tin bắt buộc (Tên, Tiền, Nhóm, Người trả)" });
    }

    try {
        // 2. Lưu vào Database
        const expense = await prisma.expense.create({
            data: {
                description,
                // Chuyển đổi số để tránh lỗi string
                amount: parseFloat(amount),
                groupId: parseInt(groupId),
                paidById: parseInt(paidById),
                profit: parseFloat(profit) || 0,
                
                // Xử lý ngày tháng: Nếu có gửi lên thì đổi sang dạng Date, không thì null
                dueDate: dueDate ? new Date(dueDate) : null,
                
                isConfirmed: false 
            }
        });
        
        // 3. Trả kết quả về cho App
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