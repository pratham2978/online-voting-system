# Bharat e-Voting Backend

A comprehensive backend API for the Bharat e-Voting system built with Node.js, Express.js, and MongoDB.

## 🚀 Features

- **User Authentication & Authorization**
  - Voter registration and login
  - Admin authentication with role-based access control
  - JWT token-based authentication
  - Password hashing with bcrypt

- **Election Management**
  - Create and manage elections
  - Multiple election types (general, assembly, local, etc.)
  - Election phases (registration, voting, results)
  - Real-time status tracking

- **Candidate Management**
  - Add/edit candidates for elections
  - Candidate approval workflow
  - Profile and manifesto management
  - Vote counting and statistics

- **Secure Voting System**
  - One vote per voter per election
  - Vote verification with unique codes
  - Anonymous vote tracking with hashing
  - Audit trail and integrity checks

- **Admin Dashboard**
  - Comprehensive analytics and reports
  - User management (voters and admins)
  - System monitoring and health checks
  - Audit logs and activity tracking

- **Security Features**
  - Rate limiting
  - Input validation and sanitization
  - CORS configuration
  - Error handling middleware
  - Account lockout protection

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/bharat-evoting
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   ADMIN_EMAIL=admin@bharatevoting.com
   ADMIN_PASSWORD=Admin@123
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   
   # Or start MongoDB service (Linux)
   sudo systemctl start mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📁 Project Structure

```
backend/
├── middleware/          # Custom middleware
│   ├── auth.js         # Authentication & authorization
│   └── errorHandler.js # Global error handling
├── models/             # MongoDB schemas
│   ├── Admin.js        # Admin user model
│   ├── Candidate.js    # Candidate model
│   ├── Election.js     # Election model
│   ├── Vote.js         # Vote model
│   └── Voter.js        # Voter model
├── routes/             # API routes
│   ├── admin.js        # Admin management routes
│   ├── auth.js         # Authentication routes
│   ├── candidates.js   # Candidate management
│   ├── elections.js    # Election management
│   ├── voters.js       # Voter management
│   └── votes.js        # Voting routes
├── utils/              # Utility functions
│   └── jwt.js          # JWT helper functions
├── .env                # Environment variables
├── package.json        # Dependencies and scripts
└── server.js           # Main server file
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Voter registration
- `POST /api/auth/login` - Voter login
- `POST /api/auth/admin/login` - Admin login
- `GET /api/auth/profile` - Get user profile

### Elections
- `GET /api/elections` - Get all elections
- `POST /api/elections` - Create new election (Admin)
- `GET /api/elections/:id` - Get election details
- `PUT /api/elections/:id` - Update election (Admin)
- `GET /api/elections/:id/results` - Get election results

### Candidates
- `GET /api/candidates` - Get all candidates
- `POST /api/candidates` - Add new candidate (Admin)
- `GET /api/candidates/:id` - Get candidate details
- `PUT /api/candidates/:id` - Update candidate (Admin)
- `DELETE /api/candidates/:id` - Delete candidate (Admin)

### Voting
- `POST /api/votes/cast` - Cast a vote
- `GET /api/votes/verify/:code` - Verify vote
- `GET /api/votes/history` - Voter's voting history
- `GET /api/votes/stats/overview` - Voting statistics (Admin)

### Admin
- `GET /api/admin/dashboard` - Admin dashboard data
- `GET /api/admin/admins` - Manage admin users
- `POST /api/admin/admins` - Create admin user
- `GET /api/admin/reports` - Generate reports
- `GET /api/admin/audit-logs` - View audit logs

### Voters
- `GET /api/voters` - Get all voters (Admin)
- `GET /api/voters/:id` - Get voter details (Admin)
- `PATCH /api/voters/:id/status` - Update voter status (Admin)

## 🔐 Authentication & Authorization

The system uses JWT tokens for authentication with role-based access control:

### Roles
- **Super Admin** - Full system access
- **Election Commissioner** - Election management
- **Returning Officer** - Election oversight
- **Admin Officer** - Basic admin functions

### Permissions
- `manage_elections` - Create/update elections
- `manage_candidates` - Add/edit candidates
- `manage_voters` - Voter management
- `view_results` - Access election results
- `manage_admins` - Admin user management
- `system_settings` - System configuration
- `audit_logs` - View audit trails
- `generate_reports` - Create reports

## 🗄️ Database Schema

### Collections
- **voters** - Voter registration data
- **admins** - Admin user accounts
- **elections** - Election information
- **candidates** - Candidate profiles
- **votes** - Vote records (anonymized)

## 🔒 Security Features

1. **Input Validation** - Express-validator for request validation
2. **Rate Limiting** - Prevent brute force attacks
3. **CORS** - Cross-origin resource sharing configuration
4. **Helmet** - Security headers
5. **Password Hashing** - bcrypt for password security
6. **JWT Tokens** - Secure authentication
7. **Account Lockout** - Protection against failed login attempts
8. **Audit Logging** - Activity tracking for admins

## 📊 Monitoring & Analytics

- Real-time voting statistics
- Election turnout tracking
- Candidate performance metrics
- System health monitoring
- Activity audit logs
- Custom report generation

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bharat-evoting
JWT_SECRET=your_production_secret_key_here
PORT=5000
```

### PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Start application with PM2
pm2 start server.js --name "bharat-evoting-api"

# Monitor application
pm2 monit
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 📝 API Documentation

For detailed API documentation, visit `/api/health` endpoint when the server is running to check API status.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔧 Development

### Code Style
- Use ESLint for code linting
- Follow JavaScript best practices
- Use async/await for asynchronous operations
- Implement proper error handling

### Database
- Use Mongoose for MongoDB interaction
- Implement proper indexing for performance
- Use aggregation pipelines for complex queries
- Maintain data consistency

### API Design
- RESTful API principles
- Consistent response formats
- Proper HTTP status codes
- Comprehensive error messages