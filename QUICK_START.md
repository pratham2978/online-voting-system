# Bharat e-Voting System - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16+) - [Download here](https://nodejs.org/)
- **MongoDB** (v5+) - [Download here](https://www.mongodb.com/try/download/community)
- **Git** - [Download here](https://git-scm.com/)

### 1. Setup Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Set up environment variables
copy .env.example .env
# Edit .env file with your MongoDB connection string

# Start MongoDB (if running locally)
mongod

# Seed initial admin data
node seedAdmin.js

# Start the backend server
npm run dev
```

The backend will be running at `http://localhost:5000`

### 2. Setup Frontend

```bash
# Navigate to frontend directory
cd ../onlinevotingsystem

# Open index.html in your browser
# Or use a local server (recommended)
npx http-server -p 3000
```

The frontend will be accessible at `http://localhost:3000`

### 3. Default Admin Credentials

**Super Admin:**
- Email: `admin@bharatevoting.com`
- Password: `Admin@123`

**Election Commissioner:**
- Email: `commissioner@bharatevoting.com`
- Password: `Commissioner@123`

### 4. API Endpoints

Base URL: `http://localhost:5000/api`

**Authentication:**
- `POST /auth/register` - Voter registration
- `POST /auth/login` - Voter login
- `POST /auth/admin/login` - Admin login

**Elections:**
- `GET /elections` - List elections
- `GET /elections/:id` - Election details
- `GET /elections/:id/results` - Election results

**Candidates:**
- `GET /candidates` - List candidates
- `GET /candidates/election/:electionId` - Candidates by election

**Voting:**
- `POST /votes/cast` - Cast vote
- `GET /votes/verify/:code` - Verify vote

### 5. Testing the System

1. **Access the admin panel:**
   - Go to admin login page
   - Login with admin credentials
   - Create a new election
   - Add candidates to the election

2. **Register as a voter:**
   - Go to registration page
   - Fill out voter details
   - Complete registration

3. **Vote:**
   - Login as voter
   - Select election
   - Cast your vote
   - Verify vote with code

### 6. MongoDB Database Structure

The system will create these collections:
- `voters` - Voter accounts
- `admins` - Admin accounts
- `elections` - Election data
- `candidates` - Candidate profiles
- `votes` - Vote records (anonymized)

### 7. Security Notes

- Change default admin passwords in production
- Use strong JWT secrets
- Enable MongoDB authentication
- Use HTTPS in production
- Set up proper CORS policies

### 8. Production Deployment

**Environment Variables:**
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bharat-evoting
JWT_SECRET=your_super_secure_secret_key_here
PORT=5000
```

**Using PM2:**
```bash
npm install -g pm2
pm2 start server.js --name "voting-api"
pm2 startup
pm2 save
```

### 9. Troubleshooting

**Backend not starting:**
- Check MongoDB connection
- Verify environment variables
- Check port availability

**Database errors:**
- Ensure MongoDB is running
- Check connection string
- Verify database permissions

**Authentication issues:**
- Check JWT secret configuration
- Verify token format
- Check user credentials

### 10. Development Workflow

1. **Creating Elections:**
   - Login as admin
   - Navigate to elections management
   - Set election dates and details
   - Add candidates

2. **Managing Voters:**
   - Monitor voter registrations
   - Verify voter accounts
   - Handle voter issues

3. **Monitoring Votes:**
   - Track voting progress
   - View real-time statistics
   - Generate reports

### 11. API Authentication

Include JWT token in requests:
```javascript
headers: {
  'Authorization': 'Bearer ' + token,
  'Content-Type': 'application/json'
}
```

### 12. Frontend Integration

The frontend uses the `api.js` file for backend communication:

```javascript
// Login example
const response = await auth.login(email, password);

// Voting example
const voteResponse = await voting.castVote(electionId, candidateId);

// Get elections
const elections = await elections.getAll();
```

### 13. Support

For issues and questions:
- Check the documentation
- Review error logs
- Contact development team
- Create GitHub issues

---

🎉 **You're all set!** The Bharat e-Voting system is now ready for use.