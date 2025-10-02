const express = require('express');
const { body, validationResult } = require('express-validator');
const Voter = require('../models/Voter');
const { authenticate, requireAdmin, requirePermission } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all voters
// @route   GET /api/voters
// @access  Private (Admin only)
router.get('/', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_voters'),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const startIndex = (page - 1) * limit;

      // Build query
      const query = {};
      
      // Search functionality
      if (req.query.search) {
        query.$or = [
          { fullName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phoneNumber: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Filter by verification status
      if (req.query.verified !== undefined) {
        query.isVerified = req.query.verified === 'true';
      }

      // Filter by active status
      if (req.query.active !== undefined) {
        query.isActive = req.query.active === 'true';
      }

      // Filter by voting status
      if (req.query.hasVoted !== undefined) {
        query.hasVoted = req.query.hasVoted === 'true';
      }

      // Get voters with pagination
      const voters = await Voter.find(query)
        .select('-password')
        .sort({ registeredAt: -1 })
        .limit(limit)
        .skip(startIndex);

      const total = await Voter.countDocuments(query);

      // Pagination result
      const pagination = {};
      if (startIndex + limit < total) {
        pagination.next = {
          page: page + 1,
          limit
        };
      }

      if (startIndex > 0) {
        pagination.prev = {
          page: page - 1,
          limit
        };
      }

      res.status(200).json({
        success: true,
        count: voters.length,
        total,
        pagination,
        data: voters
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get single voter
// @route   GET /api/voters/:id
// @access  Private (Admin only)
router.get('/:id', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_voters'),
  async (req, res, next) => {
    try {
      const voter = await Voter.findById(req.params.id)
        .select('-password')
        .populate('votedElections.election', 'title type votingStartDate votingEndDate');

      if (!voter) {
        return res.status(404).json({
          success: false,
          message: 'Voter not found'
        });
      }

      res.status(200).json({
        success: true,
        data: voter
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update voter status
// @route   PATCH /api/voters/:id/status
// @access  Private (Admin only)
router.patch('/:id/status', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_voters'),
  [
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('isVerified')
      .optional()
      .isBoolean()
      .withMessage('isVerified must be a boolean')
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

      const { isActive, isVerified } = req.body;
      const updateData = {};

      if (isActive !== undefined) updateData.isActive = isActive;
      if (isVerified !== undefined) updateData.isVerified = isVerified;

      const voter = await Voter.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, select: '-password' }
      );

      if (!voter) {
        return res.status(404).json({
          success: false,
          message: 'Voter not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Voter status updated successfully',
        data: voter
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get voter statistics
// @route   GET /api/voters/stats
// @access  Private (Admin only)
router.get('/stats/overview', 
  authenticate, 
  requireAdmin, 
  requirePermission('view_results'),
  async (req, res, next) => {
    try {
      const stats = await Voter.aggregate([
        {
          $group: {
            _id: null,
            totalVoters: { $sum: 1 },
            activeVoters: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            verifiedVoters: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } },
            votersWhoVoted: { $sum: { $cond: [{ $eq: ['$hasVoted', true] }, 1, 0] } }
          }
        }
      ]);

      const genderStats = await Voter.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$gender',
            count: { $sum: 1 }
          }
        }
      ]);

      const ageStats = await Voter.aggregate([
        { $match: { isActive: true } },
        {
          $addFields: {
            age: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$dateOfBirth'] },
                  365.25 * 24 * 60 * 60 * 1000
                ]
              }
            }
          }
        },
        {
          $bucket: {
            groupBy: '$age',
            boundaries: [18, 25, 35, 45, 55, 65, 100],
            default: 'Other',
            output: { count: { $sum: 1 } }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: stats[0] || {
            totalVoters: 0,
            activeVoters: 0,
            verifiedVoters: 0,
            votersWhoVoted: 0
          },
          genderDistribution: genderStats,
          ageDistribution: ageStats
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete voter account
// @route   DELETE /api/voters/:id
// @access  Private (Admin only - super admin or election commissioner)
router.delete('/:id', 
  authenticate, 
  requireAdmin,
  async (req, res, next) => {
    try {
      // Only super admin or election commissioner can delete voters
      if (req.user.role !== 'super_admin' && req.user.role !== 'election_commissioner') {
        return res.status(403).json({
          success: false,
          message: 'Only super admin or election commissioner can delete voter accounts'
        });
      }

      const voter = await Voter.findById(req.params.id);

      if (!voter) {
        return res.status(404).json({
          success: false,
          message: 'Voter not found'
        });
      }

      // Check if voter has voted - if yes, don't allow deletion
      if (voter.hasVoted) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete voter account that has cast votes. Deactivate instead.'
        });
      }

      await Voter.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Voter account deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;