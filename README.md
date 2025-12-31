# HALOmed - Pharmacy Management System
## Complete End-to-End Implementation

A comprehensive pharmacy management system with React frontend, Node.js backend, MySQL database, and Flask ML module for disease outbreak predictions.

## 📁 Project Structure

```
newHalomed/
├── frontend/                 # React + Tailwind CSS
│   ├── src/
│   │   ├── pages/           # Application pages
│   │   ├── components/      # Reusable components
│   │   ├── services/        # API integration
│   │   ├── context/         # React context
│   │   └── styles/          # Tailwind CSS
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                  # Node.js + Express
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth & error handling
│   │   ├── models/          # Data models
│   │   ├── config/          # Configuration
│   │   └── utils/           # Helper functions
│   ├── database/
│   │   └── schema.sql       # MySQL database schema
│   ├── package.json
│   └── .env.example
│
└── ml-module/               # Flask + Python
    ├── src/
    │   └── app.py           # Flask application
    ├── models/              # ML models
    ├── data/                # Training data
    ├── requirements.txt
    └── .env.example
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- MySQL 8.0+
- Git

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

**Demo Credentials:**
- Username: `admin`
- Password: `admin123`

### 2. Backend Setup

```bash
cd backend

# Create .env file from example
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=halomed_db

# Install dependencies
npm install

# Start the server
npm run dev
```

The backend will run on `http://localhost:5000`

### 3. Database Setup

```bash
# Create database
mysql -u root -p < backend/database/schema.sql

# Or manually:
mysql -u root -p
mysql> CREATE DATABASE halomed_db;
mysql> USE halomed_db;
mysql> source backend/database/schema.sql;
```

### 4. ML Module Setup

```bash
cd ml-module

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Create .env file
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Start Flask server
python src/app.py
```

The ML module will run on `http://localhost:5001`

## 📊 Database Schema

The system uses 16 normalized tables (all in BCNF):

1. **users** - User authentication & roles
2. **customers** - Customer information
3. **medicines** - Medicine master data
4. **medicine_batches** - Batch tracking with expiry dates
5. **suppliers** - Supplier details
6. **orders** - Purchase orders
7. **order_details** - Order line items
8. **inventory_logs** - Stock movement history
9. **sales** - Sales transactions
10. **sale_details** - Sale line items
11. **prescriptions** - Prescription records
12. **payment_transactions** - Payment details
13. **disease_outbreak_predictions** - ML predictions
14. **medicine_recommendations** - Recommended medicines for diseases
15. **demand_analytics** - Sales trend analysis
16. **reports** - Generated reports

## 🔐 Authentication & Authorization

- JWT token-based authentication
- Role-based access control (Admin, Staff, Customer)
- Secure password hashing with bcryptjs
- Token expiry: 7 days (configurable)

### User Roles & Permissions

| Feature | Admin | Staff | Customer |
|---------|-------|-------|----------|
| Manage Users | ✓ | ✗ | ✗ |
| Manage Medicines | ✓ | ✓ | ✗ |
| View Inventory | ✓ | ✓ | ✗ |
| Process Sales | ✓ | ✓ | ✗ |
| View Own Profile | ✓ | ✓ | ✓ |
| Change Password | ✓ | ✓ | ✓ |
| Manage Predictions | ✓ | ✗ | ✗ |
| View Analytics | ✓ | ✓ | ✗ |

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user
- `POST /auth/change-password` - Change password

### Medicines
- `GET /medicines` - List all medicines
- `GET /medicines/:id` - Get medicine details
- `POST /medicines` - Create medicine
- `PUT /medicines/:id` - Update medicine
- `DELETE /medicines/:id` - Delete medicine
- `GET /medicines/stock/low` - Get low stock medicines

### Inventory
- `GET /inventory` - Get inventory logs
- `POST /inventory` - Add inventory log
- `GET /inventory/summary` - Get inventory summary
- `GET /inventory/expired` - Get expired medicines

### Sales
- `POST /sales` - Create sale
- `GET /sales` - List sales
- `GET /sales/:id` - Get sale details
- `GET /sales/summary/stats` - Get sales statistics

### Prescriptions
- `POST /prescriptions` - Create prescription
- `GET /prescriptions` - List prescriptions
- `PUT /prescriptions/:id/fulfill` - Mark as fulfilled
- `GET /prescriptions/unfulfilled` - Get pending prescriptions

### Suppliers
- `GET /suppliers` - List suppliers
- `POST /suppliers` - Create supplier
- `GET /suppliers/:id` - Get supplier details
- `PUT /suppliers/:id` - Update supplier

### Orders
- `POST /orders` - Create order
- `GET /orders` - List orders
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id/status` - Update order status

### Analytics
- `GET /analytics/demand` - Get demand analytics
- `GET /analytics/sales` - Get sales analytics
- `GET /analytics/top-medicines` - Top selling medicines
- `GET /analytics/dashboard/stats` - Dashboard statistics

### Predictions
- `GET /predictions` - List predictions
- `GET /predictions/recommendations/:id` - Get recommendations
- `POST /predictions/trigger` - Trigger ML prediction
- `POST /predictions` - Create prediction

### ML Module
- `GET /health` - Health check
- `POST /predict` - Generate prediction
- `POST /analyze-trends` - Analyze sales trends
- `POST /recommend-medicines` - Get medicine recommendations
- `GET /model-info` - Get model information

## 🎨 Frontend Features

### Dashboard
- Key statistics and metrics
- Quick access to main features
- Sales and inventory overview

### Medicines Management
- Add/Edit/Delete medicines
- Track stock levels
- Search and filter
- Category management
- Automatic low stock alerts

### Inventory Management
- Real-time stock tracking
- Inventory logs and history
- Expiry date monitoring
- Stock movement analysis
- Low stock alerts

### Sales Processing
- Quick sales entry
- Multiple payment methods
- Automatic invoice generation
- Discount application
- Transaction history

### Prescription Management
- Record prescriptions
- Track fulfillment status
- Prescription validation
- Expiry tracking

### Supplier & Orders
- Supplier management
- Purchase order creation
- Order status tracking
- Delivery management
- Order history

### Analytics & Reports
- Sales trends
- Top-selling medicines
- Demand forecasting
- Revenue analysis
- Custom reports

### Disease Predictions
- ML-based outbreak predictions
- Risk level indicators
- Recommended medicines
- Confidence scores
- Regional analysis

## 🔧 Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=halomed_db
DB_PORT=3306
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRE=7d
ML_API_URL=http://localhost:5001
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

### ML Module (.env)
```
PORT=5001
FLASK_ENV=development
ML_PORT=5001
```

## 📦 Dependencies

### Frontend
- React 18.2
- React Router 6.20
- Axios 1.6
- Chart.js 4.4
- Tailwind CSS 3.3
- Lucide React (icons)

### Backend
- Express 4.18
- MySQL2 3.6
- JWT 9.1
- bcryptjs 2.4
- CORS 2.8
- Dotenv 16.3

### ML Module
- Flask 3.0
- scikit-learn 1.3
- pandas 2.1
- numpy 1.26
- requests 2.31

## 🧪 Testing

### Manual Testing Credentials
- Username: `admin`
- Password: `admin123`
- Role: Admin (Full access)

### API Testing with Curl
```bash
# Login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get medicines (requires token)
curl -X GET http://localhost:5000/medicines \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚀 Deployment

### Frontend Deployment
```bash
cd frontend
npm run build
# Deploy dist/ folder to Vercel, Netlify, or any static host
```

### Backend Deployment
```bash
# Deploy to Heroku, AWS, Azure, or any Node.js host
# Update environment variables for production
```

### ML Module Deployment
```bash
# Deploy to Heroku, AWS Lambda, or any Python host
# Install dependencies: pip install -r requirements.txt
```

## 🔒 Security Features

- ✅ JWT authentication
- ✅ Role-based access control (RBAC)
- ✅ Password hashing with bcryptjs
- ✅ HTTPS/SSL support
- ✅ CORS configuration
- ✅ SQL injection prevention with parameterized queries
- ✅ XSS protection
- ✅ Environment variable management
- ✅ Input validation
- ✅ Rate limiting (recommended to add)

## 📝 Future Enhancements

- [ ] Mobile app (React Native/Flutter)
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced ML models
- [ ] Blockchain for drug traceability
- [ ] Integration with telemedicine platforms
- [ ] AI chatbot support
- [ ] Advanced reporting and visualization
- [ ] Integration with PBM systems
- [ ] Multi-language support
- [ ] Docker containerization

## 🐛 Troubleshooting

### Database Connection Error
- Check MySQL is running
- Verify credentials in .env
- Ensure halomed_db exists

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### Frontend Can't Connect to Backend
- Ensure backend is running on port 5000
- Check CORS is enabled
- Verify API URL in frontend .env

### ML Module Issues
- Ensure Python 3.8+ is installed
- Check Flask is running on port 5001
- Verify requirements.txt is installed

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check console logs for errors
4. Create an issue on GitHub

## 📄 License

This project is part of an academic assignment at Manipal Institute of Technology.

## 👥 Contributors

- Advait Gujar (230911404)
- Prakyath S Kumar (230911392)
- Atharva Agrawal (230911348)

---

**Last Updated:** January 2025
**Version:** 1.0.0
