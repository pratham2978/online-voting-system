const mongoose = require('mongoose');
const Admin = require('./models/Admin');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bharat-evoting');
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await Admin.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('Super admin already exists');
      process.exit(0);
    }

    // Create super admin
    const superAdmin = await Admin.create({
      fullName: 'Super Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@bharatevoting.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'super_admin',
      permissions: [
        'manage_elections',
        'manage_candidates',
        'manage_voters',
        'view_results',
        'manage_admins',
        'system_settings',
        'audit_logs',
        'generate_reports'
      ],
      designation: 'System Administrator',
      department: 'Information Technology',
      isActive: true,
      isEmailVerified: true
    });

    console.log('Super admin created successfully:');
    console.log('Email:', superAdmin.email);
    console.log('Password:', process.env.ADMIN_PASSWORD || 'Admin@123');
    console.log('Role:', superAdmin.role);

    // Create sample election commissioner
    const electionCommissioner = await Admin.create({
      fullName: 'Election Commissioner',
      email: 'commissioner@bharatevoting.com',
      password: 'Commissioner@123',
      role: 'election_commissioner',
      permissions: [
        'manage_elections',
        'manage_candidates',
        'view_results',
        'generate_reports'
      ],
      designation: 'Chief Election Commissioner',
      department: 'Election Commission',
      isActive: true,
      isEmailVerified: true,
      createdBy: superAdmin._id
    });

    console.log('\nElection Commissioner created successfully:');
    console.log('Email:', electionCommissioner.email);
    console.log('Password: Commissioner@123');
    console.log('Role:', electionCommissioner.role);

    console.log('\n✅ Database seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeder
seedAdmin();