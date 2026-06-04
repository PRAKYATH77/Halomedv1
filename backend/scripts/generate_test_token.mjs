import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
const token = jwt.sign({ userId: 999, user_id: 999, role: 'customer' }, secret, { expiresIn: '1h' });
console.log(token);
