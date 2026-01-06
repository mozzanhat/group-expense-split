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
// 3. CẬP NHẬT API TÍNH NỢ (Logic chia tiền lãi + Chỉ tính hàng chính)
fastify.get('/groups/:id/debts', { onRequest: [authenticate] }, async (request, reply) => {
    try {
        const groupId = parseInt(request.params.id);
        const members = await prisma.groupMember.findMany({ where: { groupId }, include: { user: true } });
        
        // Lấy các khoản chi ĐÃ DUYỆT (Hàng chính)
        const expenses = await prisma.expense.findMany({ 
            where: { 
                groupId,
                isApproved: true // CHỈ LẤY HÀNG CHÍNH
            },
            include: { splits: true } 
        });

        // Lấy danh sách HÀNG CHỜ để hiển thị thông báo (nếu cần)
        const pendingExpenses = await prisma.expense.findMany({
            where: { groupId, isApproved: false },
            include: { splits: true }
        });

        let totalGroupSpend = 0; 
        const balances = {}; 
        members.forEach(m => balances[m.userId] = { name: m.user.name, paid: 0, owe: 0 });

        expenses.forEach(e => {
            const amount = parseFloat(e.amount);
            const profit = parseFloat(e.profit);
            const payerId = e.paidById;
            
            // Bỏ qua khoản trả nợ chưa xác nhận (Logic cũ)
            const isDebtPayment = e.description.toLowerCase().includes("trả nợ");
            if (isDebtPayment && !e.isConfirmed) return;

            if (!isDebtPayment) totalGroupSpend += amount;

            // 1. Tính tiền GỐC
            if (balances[payerId]) balances[payerId].paid += amount;
            
            const splitUsers = e.splits;
            if (splitUsers.length > 0) {
                const shareBase = amount / splitUsers.length;
                splitUsers.forEach(split => {
                    if (balances[split.userId]) balances[split.userId].owe += shareBase;
                });
            } else {
                if (balances[payerId]) balances[payerId].owe += amount;
            }

            // 2. Tính tiền LÃI (Chỉ chia cho những người có paysProfit = true)
            if (profit > 0 && balances[payerId]) {
                 // Người trả được cộng thêm phần lãi vào "Đã chi" (vì họ ứng trước hoặc được hưởng)
                 // Lưu ý: Logic tiền lãi hơi trừu tượng. 
                 // Ở đây hiểu là: Payer bỏ ra (Gốc + Lãi) hay Payer muốn thu về (Gốc + Lãi)?
                 // Thường là Payer muốn thu về Lãi. Nên coi như Payer đã "paid" phần lãi đó.
                 balances[payerId].paid += profit;

                 const profitPayers = splitUsers.filter(s => s.paysProfit);
                 if (profitPayers.length > 0) {
                     const shareProfit = profit / profitPayers.length;
                     profitPayers.forEach(p => {
                         if (balances[p.userId]) balances[p.userId].owe += shareProfit;
                     });
                 }
            }
        });

        const debts = Object.keys(balances).map(uid => ({
            userId: parseInt(uid),
            name: balances[uid].name,
            paid: balances[uid].paid,
            spent: balances[uid].owe, 
            balance: balances[uid].paid - balances[uid].owe 
        }));

        // Trả về cả pendingExpenses để Frontend biết có hàng chờ
        reply.send({ total: totalGroupSpend, debts, pendingCount: pendingExpenses.length, pendingExpenses });

    } catch (err) {
        reply.status(500).send(err);
    }
});

// --- API EXPENSE Thêm - khoản chi tiêu mới (Tạo hóa đơn) ---9------------------------------
// 7. API TẠO CHI PHÍ (CÓ HẠN TRẢ VÀ BẢO MẬT)
// Sửa app.post thành fastify.post
// 7. API TẠO CHI PHÍ (CÓ CHỌN NGƯỜI CHIA TIỀN)
// 1. CẬP NHẬT API TẠO CHI PHÍ (Thêm xử lý Lãi & Hàng chờ)
fastify.post('/expenses', { onRequest: [authenticate] }, async (request, reply) => {
    // Nhận thêm profitPayerIds (Danh sách người phải trả lãi)
    const { description, amount, groupId, paidById, profit, dueDate, involvedUserIds, profitPayerIds } = request.body;

    if (!description || !amount || !groupId || !involvedUserIds?.length) {
        return reply.code(400).send({ error: "Thiếu thông tin bắt buộc" });
    }

    try {
        const creatorId = request.user.id;

        const expense = await prisma.expense.create({
            data: {
                description,
                amount: parseFloat(amount),
                groupId: parseInt(groupId),
                paidById: parseInt(paidById),
                profit: parseFloat(profit) || 0,
                dueDate: dueDate ? new Date(dueDate) : null,
                isConfirmed: false,
                
                // Mặc định là FALSE (Hàng chờ), trừ khi chỉ có 1 mình người tạo tự chơi
                isApproved: involvedUserIds.length === 1 && involvedUserIds[0] === creatorId,

                splits: {
                    create: involvedUserIds.map(uid => ({
                        userId: parseInt(uid),
                        // Nếu ID này nằm trong danh sách trả lãi -> true
                        paysProfit: profitPayerIds ? profitPayerIds.includes(uid) : false,
                        // Người tạo mặc định là ĐỒNG Ý, người khác là CHƯA (false)
                        hasApproved: parseInt(uid) === creatorId
                    }))
                }
            }
        });
        return reply.send(expense);
    } catch (error) {
        console.error(error);
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