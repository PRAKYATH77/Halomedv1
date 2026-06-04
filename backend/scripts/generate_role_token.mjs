import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
const role = process.env.USER_ROLE || 'staff';
const id = process.env.USER_ID || 2;
const token = jwt.sign({ userId: Number(id), user_id: Number(id), role }, secret, { expiresIn: '1h' });
console.log(token);
