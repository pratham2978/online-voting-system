const express = require('express');
const { body, validationResult } = require('express-validator');
const Candidate = require('../models/Candidate');
const Election = require('../models/Election');
const { authenticate, requireAdmin, requirePermission, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all candidates
// @route   GET /api/candidates
// @access  Public (with optional auth for additional info)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // Build query
    const query = { isActive: true };
    
    // For public access, only show approved candidates
    if (req.userType !== 'admin') {
      query.isApproved = true;
    }

    // Filter by election
    if (req.query.election) {
      query.election = req.query.election;
    }

    // Filter by constituency
    if (req.query.constituency) {
      query.constituency = { $regex: req.query.constituency, $options: 'i' };
    }

    // Filter by political party
    if (req.query.party) {
      query.politicalParty = { $regex: req.query.party, $options: 'i' };
    }

    // Search functionality
    if (req.query.search) {
      query.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { politicalParty: { $regex: req.query.search, $options: 'i' } },
        { constituency: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get candidates with pagination
    const candidates = await Candidate.find(query)
      .populate('election', 'title type votingStartDate votingEndDate status')
      .sort({ voteCount: -1, fullName: 1 })
      .limit(limit)
      .skip(startIndex);

    const total = await Candidate.countDocuments(query);

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
      count: candidates.length,
      total,
      pagination,
      data: candidates
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get candidates by election
// @route   GET /api/candidates/election/:electionId
// @access  Public
router.get('/election/:electionId', async (req, res, next) => {
  try {
    const candidates = await Candidate.findByElection(req.params.electionId)
      .populate('election', 'title type votingStartDate votingEndDate status');

    res.status(200).json({
      success: true,
      count: candidates.length,
      data: candidates
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get single candidate
// @route   GET /api/candidates/:id
// @access  Public
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const query = { _id: req.params.id, isActive: true };
    
    // For public access, only show approved candidates
    if (req.userType !== 'admin') {
      query.isApproved = true;
    }

    const candidate = await Candidate.findOne(query)
      .populate('election', 'title type votingStartDate votingEndDate status');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.status(200).json({
      success: true,
      data: candidate
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Create new candidate
// @route   POST /api/candidates
// @access  Private (Admin only)
router.post('/', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_candidates'),
  [
    body('fullName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('age')
      .isInt({ min: 25, max: 100 })
      .withMessage('Age must be between 25 and 100'),
    body('politicalParty')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Political party is required'),
    body('election')
      .isMongoId()
      .withMessage('Valid election ID is required'),
    body('constituency')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Constituency is required')
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

      // Check if election exists
      const election = await Election.findById(req.body.election);
      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found'
        });
      }

      // Check if candidate already exists for this election and constituency
      const existingCandidate = await Candidate.findOne({
        fullName: req.body.fullName,
        election: req.body.election,
        constituency: req.body.constituency,
        isActive: true
      });

      if (existingCandidate) {
        return res.status(400).json({
          success: false,
          message: 'Candidate with this name already exists for this election and constituency'
        });
      }

      const candidate = await Candidate.create({
        ...req.body,
        nominatedBy: req.user._id,
        isApproved: req.user.role === 'super_admin' || req.user.role === 'election_commissioner'
      });

      await candidate.populate('election', 'title type');

      // Update election's total candidates count
      await Election.findByIdAndUpdate(
        req.body.election,
        { $inc: { totalCandidates: 1 } }
      );

      res.status(201).json({
        success: true,
        message: 'Candidate created successfully',
        data: candidate
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update candidate
// @route   PUT /api/candidates/:id
// @access  Private (Admin only)
router.put('/:id', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_candidates'),
  async (req, res, next) => {
    try {
      const candidate = await Candidate.findById(req.params.id);

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found'
        });
      }

      // Don't allow updating certain fields after voting has started
      if (req.body.election) {
        const election = await Election.findById(candidate.election);
        if (election && election.isVotingActive()) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify candidate details after voting has started'
          });
        }
      }

      // Fields that can be updated
      const allowedUpdates = [
        'fullName', 'age', 'politicalParty', 'constituency', 'profilePhoto', 
        'partySymbol', 'education', 'occupation', 'experience', 'manifesto', 
        'campaignSlogan', 'contactInfo'
      ];

      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const updatedCandidate = await Candidate.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate('election', 'title type');

      res.status(200).json({
        success: true,
        message: 'Candidate updated successfully',
        data: updatedCandidate
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update candidate approval status
// @route   PATCH /api/candidates/:id/approval
// @access  Private (Admin only - election commissioner or super admin)
router.patch('/:id/approval', 
  authenticate, 
  requireAdmin,
  async (req, res, next) => {
    try {
      // Only election commissioner or super admin can approve candidates
      if (req.user.role !== 'super_admin' && req.user.role !== 'election_commissioner') {
        return res.status(403).json({
          success: false,
          message: 'Only election commissioner or super admin can approve candidates'
        });
      }

      const { isApproved } = req.body;

      const candidate = await Candidate.findByIdAndUpdate(
        req.params.id,
        { isApproved },
        { new: true }
      ).populate('election', 'title type');

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found'
        });
      }

      res.status(200).json({
        success: true,
        message: `Candidate ${isApproved ? 'approved' : 'rejected'} successfully`,
        data: candidate
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete candidate
// @route   DELETE /api/candidates/:id
// @access  Private (Admin only)
router.delete('/:id', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_candidates'),
  async (req, res, next) => {
    try {
      const candidate = await Candidate.findById(req.params.id);

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found'
        });
      }

      // Check if voting has started
      const election = await Election.findById(candidate.election);
      if (election && election.isVotingActive()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete candidate after voting has started'
        });
      }

      // If candidate has received votes, just deactivate instead of deleting
      if (candidate.voteCount > 0) {
        candidate.isActive = false;
        await candidate.save();
        
        return res.status(200).json({
          success: true,
          message: 'Candidate deactivated successfully (had received votes)'
        });
      }

      await Candidate.findByIdAndDelete(req.params.id);

      // Update election's total candidates count
      await Election.findByIdAndUpdate(
        candidate.election,
        { $inc: { totalCandidates: -1 } }
      );

      res.status(200).json({
        success: true,
        message: 'Candidate deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get candidate statistics
// @route   GET /api/candidates/stats/overview
// @access  Private (Admin only)
router.get('/stats/overview', 
  authenticate, 
  requireAdmin, 
  requirePermission('view_results'),
  async (req, res, next) => {
    try {
      const stats = await Candidate.aggregate([
        {
          $group: {
            _id: null,
            totalCandidates: { $sum: 1 },
            activeCandidates: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            approvedCandidates: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] } }
          }
        }
      ]);

      const partyStats = await Candidate.aggregate([
        { $match: { isActive: true, isApproved: true } },
        {
          $group: {
            _id: '$politicalParty',
            count: { $sum: 1 },
            totalVotes: { $sum: '$voteCount' }
          }
        },
        { $sort: { totalVotes: -1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: stats[0] || {
            totalCandidates: 0,
            activeCandidates: 0,
            approvedCandidates: 0
          },
          partyDistribution: partyStats
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;