const express = require('express');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const Voter = require('../models/Voter');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');

const router = express.Router();

// @desc    Get admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', authenticate, requireAdmin, async (req, res, next) => {
  try {
    // Get overview statistics
    const [voterStats, electionStats, candidateStats, voteStats] = await Promise.all([
      Voter.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            verified: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
          }
        }
      ]),
      Election.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            upcoming: { $sum: { $cond: [{ $eq: ['$status', 'upcoming'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }
        }
      ]),
      Candidate.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] } }
          }
        }
      ]),
      Vote.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            valid: { $sum: { $cond: [{ $eq: ['$status', 'valid'] }, 1, 0] } }
          }
        }
      ])
    ]);

    // Recent activity - last 10 elections
    const recentElections = await Election.find()
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(10);

    // Recent votes - last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentVotes = await Vote.countDocuments({
      votedAt: { $gte: yesterday },
      status: 'valid'
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          voters: voterStats[0] || { total: 0, active: 0, verified: 0 },
          elections: electionStats[0] || { total: 0, active: 0, upcoming: 0, completed: 0 },
          candidates: candidateStats[0] || { total: 0, approved: 0 },
          votes: voteStats[0] || { total: 0, valid: 0 },
          recentVotes24h: recentVotes
        },
        recentElections: recentElections.slice(0, 5), // Top 5 recent elections
        systemHealth: {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date()
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get all admins
// @route   GET /api/admin/admins
// @access  Private (Admin only - super admin)
router.get('/admins', 
  authenticate, 
  requireAdmin, 
  requireRole('super_admin'),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const startIndex = (page - 1) * limit;

      const query = {};
      
      // Filter by role
      if (req.query.role) {
        query.role = req.query.role;
      }

      // Filter by active status
      if (req.query.active !== undefined) {
        query.isActive = req.query.active === 'true';
      }

      // Search functionality
      if (req.query.search) {
        query.$or = [
          { fullName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const admins = await Admin.find(query)
        .select('-password')
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(startIndex);

      const total = await Admin.countDocuments(query);

      const pagination = {};
      if (startIndex + limit < total) {
        pagination.next = { page: page + 1, limit };
      }
      if (startIndex > 0) {
        pagination.prev = { page: page - 1, limit };
      }

      res.status(200).json({
        success: true,
        count: admins.length,
        total,
        pagination,
        data: admins
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Create new admin
// @route   POST /api/admin/admins
// @access  Private (Admin only - super admin)
router.post('/admins', 
  authenticate, 
  requireAdmin, 
  requireRole('super_admin'),
  [
    body('fullName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('role')
      .isIn(['super_admin', 'election_commissioner', 'returning_officer', 'admin_officer'])
      .withMessage('Invalid role'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { fullName, email, password, role, permissions, phoneNumber, designation, department } = req.body;

      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Admin with this email already exists'
        });
      }

      const admin = await Admin.create({
        fullName,
        email,
        password,
        role,
        permissions: permissions || [],
        phoneNumber,
        designation,
        department,
        createdBy: req.user._id,
        isEmailVerified: true // Auto-verify for admin-created accounts
      });

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
          createdAt: admin.createdAt
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update admin
// @route   PUT /api/admin/admins/:id
// @access  Private (Admin only - super admin)
router.put('/admins/:id', 
  authenticate, 
  requireAdmin, 
  requireRole('super_admin'),
  async (req, res, next) => {
    try {
      const admin = await Admin.findById(req.params.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Prevent modifying super admin (except by super admin themselves)
      if (admin.role === 'super_admin' && admin._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify super admin account'
        });
      }

      const allowedUpdates = [
        'fullName', 'phoneNumber', 'designation', 'department', 
        'role', 'permissions', 'isActive'
      ];

      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const updatedAdmin = await Admin.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).select('-password');

      res.status(200).json({
        success: true,
        message: 'Admin updated successfully',
        data: updatedAdmin
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete admin
// @route   DELETE /api/admin/admins/:id
// @access  Private (Admin only - super admin)
router.delete('/admins/:id', 
  authenticate, 
  requireAdmin, 
  requireRole('super_admin'),
  async (req, res, next) => {
    try {
      const admin = await Admin.findById(req.params.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Prevent deleting super admin
      if (admin.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete super admin account'
        });
      }

      // Prevent self-deletion
      if (admin._id.toString() === req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      await Admin.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Admin deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get system reports
// @route   GET /api/admin/reports
// @access  Private (Admin only)
router.get('/reports', 
  authenticate, 
  requireAdmin,
  async (req, res, next) => {
    try {
      const { type, startDate, endDate, electionId } = req.query;

      let report = {};

      if (type === 'election' && electionId) {
        // Election-specific report
        const election = await Election.findById(electionId)
          .populate('createdBy', 'fullName');
        
        if (!election) {
          return res.status(404).json({
            success: false,
            message: 'Election not found'
          });
        }

        const candidates = await Candidate.find({ election: electionId, isActive: true });
        const votes = await Vote.find({ election: electionId, status: 'valid' });
        const results = await Vote.getElectionResults(electionId);

        report = {
          type: 'election',
          election: election,
          summary: {
            totalCandidates: candidates.length,
            totalVotes: votes.length,
            turnoutPercentage: election.turnoutPercentage
          },
          candidates: candidates,
          results: results,
          timeline: {
            registrationPeriod: `${election.registrationStartDate} - ${election.registrationEndDate}`,
            votingPeriod: `${election.votingStartDate} - ${election.votingEndDate}`,
            resultDate: election.resultDate
          }
        };

      } else if (type === 'voter') {
        // Voter statistics report
        const dateFilter = {};
        if (startDate && endDate) {
          dateFilter.registeredAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }

        const voterStats = await Voter.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              verified: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } },
              voted: { $sum: { $cond: [{ $eq: ['$hasVoted', true] }, 1, 0] } }
            }
          }
        ]);

        const genderDistribution = await Voter.aggregate([
          { $match: { isActive: true, ...dateFilter } },
          { $group: { _id: '$gender', count: { $sum: 1 } } }
        ]);

        report = {
          type: 'voter',
          period: startDate && endDate ? `${startDate} - ${endDate}` : 'All time',
          summary: voterStats[0] || { total: 0, active: 0, verified: 0, voted: 0 },
          demographics: {
            gender: genderDistribution
          }
        };

      } else {
        // General system report
        const [voters, elections, candidates, votes] = await Promise.all([
          Voter.countDocuments({ isActive: true }),
          Election.countDocuments({ isActive: true }),
          Candidate.countDocuments({ isActive: true }),
          Vote.countDocuments({ status: 'valid' })
        ]);

        report = {
          type: 'system',
          timestamp: new Date(),
          summary: {
            totalVoters: voters,
            totalElections: elections,
            totalCandidates: candidates,
            totalVotes: votes
          },
          systemHealth: {
            status: 'operational',
            uptime: process.uptime()
          }
        };
      }

      res.status(200).json({
        success: true,
        data: report
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Admin only)
router.get('/audit-logs', 
  authenticate, 
  requireAdmin,
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const startIndex = (page - 1) * limit;

      // Get admin activity logs
      const admins = await Admin.find({ isActive: true })
        .select('fullName email role activityLog')
        .sort({ 'activityLog.timestamp': -1 })
        .limit(limit)
        .skip(startIndex);

      // Flatten activity logs
      let auditLogs = [];
      admins.forEach(admin => {
        admin.activityLog.forEach(log => {
          auditLogs.push({
            adminId: admin._id,
            adminName: admin.fullName,
            adminEmail: admin.email,
            adminRole: admin.role,
            action: log.action,
            timestamp: log.timestamp,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent
          });
        });
      });

      // Sort by timestamp desc
      auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.status(200).json({
        success: true,
        count: auditLogs.length,
        data: auditLogs.slice(0, limit)
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;