const express = require('express');
const { body, validationResult } = require('express-validator');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');
const { authenticate, requireAdmin, requirePermission, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all elections
// @route   GET /api/elections
// @access  Public (with optional auth for additional info)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // Build query
    const query = { isActive: true };
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by constituency
    if (req.query.constituency) {
      query.constituency = { $regex: req.query.constituency, $options: 'i' };
    }

    // Filter by state
    if (req.query.state) {
      query.state = { $regex: req.query.state, $options: 'i' };
    }

    // Search functionality
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { constituency: { $regex: req.query.search, $options: 'i' } },
        { state: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get elections with pagination
    const elections = await Election.find(query)
      .populate('createdBy', 'fullName email')
      .populate('winner', 'fullName politicalParty')
      .sort({ votingStartDate: -1 })
      .limit(limit)
      .skip(startIndex);

    const total = await Election.countDocuments(query);

    // Add current phase to each election
    const electionsWithPhase = elections.map(election => ({
      ...election.toObject(),
      currentPhase: election.currentPhase
    }));

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
      count: elections.length,
      total,
      pagination,
      data: electionsWithPhase
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get elections by phase
// @route   GET /api/elections/phase/:phase
// @access  Public
router.get('/phase/:phase', async (req, res, next) => {
  try {
    const { phase } = req.params;
    const elections = await Election.findByPhase(phase)
      .populate('createdBy', 'fullName email')
      .populate('winner', 'fullName politicalParty');

    const electionsWithPhase = elections.map(election => ({
      ...election.toObject(),
      currentPhase: election.currentPhase
    }));

    res.status(200).json({
      success: true,
      count: elections.length,
      data: electionsWithPhase
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get single election
// @route   GET /api/elections/:id
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const election = await Election.findOne({ _id: req.params.id, isActive: true })
      .populate('createdBy', 'fullName email')
      .populate('winner', 'fullName politicalParty profilePhoto')
      .populate('electionOfficials.admin', 'fullName email');

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    // Get candidates for this election
    const candidates = await Candidate.find({
      election: req.params.id,
      isActive: true,
      isApproved: true
    }).select('fullName politicalParty profilePhoto voteCount');

    res.status(200).json({
      success: true,
      data: {
        ...election.toObject(),
        currentPhase: election.currentPhase,
        candidates
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Create new election
// @route   POST /api/elections
// @access  Private (Admin only - election commissioner or super admin)
router.post('/', 
  authenticate, 
  requireAdmin,
  [
    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('type')
      .isIn(['general', 'assembly', 'local', 'by-election', 'presidential'])
      .withMessage('Invalid election type'),
    body('scope')
      .isIn(['national', 'state', 'district', 'constituency', 'local'])
      .withMessage('Invalid election scope'),
    body('constituency')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Constituency is required'),
    body('state')
      .trim()
      .isLength({ min: 2 })
      .withMessage('State is required'),
    body('registrationStartDate')
      .isISO8601()
      .withMessage('Valid registration start date is required'),
    body('registrationEndDate')
      .isISO8601()
      .withMessage('Valid registration end date is required'),
    body('votingStartDate')
      .isISO8601()
      .withMessage('Valid voting start date is required'),
    body('votingEndDate')
      .isISO8601()
      .withMessage('Valid voting end date is required'),
    body('resultDate')
      .isISO8601()
      .withMessage('Valid result date is required')
  ],
  async (req, res, next) => {
    try {
      // Only election commissioner or super admin can create elections
      if (req.user.role !== 'super_admin' && req.user.role !== 'election_commissioner') {
        return res.status(403).json({
          success: false,
          message: 'Only election commissioner or super admin can create elections'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Validate date sequence
      const { registrationStartDate, registrationEndDate, votingStartDate, votingEndDate, resultDate } = req.body;
      
      const regStart = new Date(registrationStartDate);
      const regEnd = new Date(registrationEndDate);
      const voteStart = new Date(votingStartDate);
      const voteEnd = new Date(votingEndDate);
      const resultDt = new Date(resultDate);

      if (regStart >= regEnd) {
        return res.status(400).json({
          success: false,
          message: 'Registration end date must be after start date'
        });
      }

      if (voteStart >= voteEnd) {
        return res.status(400).json({
          success: false,
          message: 'Voting end date must be after start date'
        });
      }

      if (regEnd >= voteStart) {
        return res.status(400).json({
          success: false,
          message: 'Voting must start after registration ends'
        });
      }

      if (voteEnd >= resultDt) {
        return res.status(400).json({
          success: false,
          message: 'Result date must be after voting ends'
        });
      }

      const election = await Election.create({
        ...req.body,
        createdBy: req.user._id,
        status: regStart > new Date() ? 'upcoming' : 'registration'
      });

      await election.populate('createdBy', 'fullName email');

      res.status(201).json({
        success: true,
        message: 'Election created successfully',
        data: election
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update election
// @route   PUT /api/elections/:id
// @access  Private (Admin only)
router.put('/:id', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_elections'),
  async (req, res, next) => {
    try {
      const election = await Election.findById(req.params.id);

      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found'
        });
      }

      // Don't allow updating if voting has started
      if (election.status === 'active' || election.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify election after voting has started'
        });
      }

      // Fields that can be updated
      const allowedUpdates = [
        'title', 'description', 'registrationStartDate', 'registrationEndDate',
        'votingStartDate', 'votingEndDate', 'resultDate', 'maxVotesPerVoter',
        'allowEVMs', 'allowPaperBallots', 'requireVoterIdVerification'
      ];

      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const updatedElection = await Election.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate('createdBy', 'fullName email');

      res.status(200).json({
        success: true,
        message: 'Election updated successfully',
        data: updatedElection
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update election status
// @route   PATCH /api/elections/:id/status
// @access  Private (Admin only)
router.patch('/:id/status', 
  authenticate, 
  requireAdmin, 
  requirePermission('manage_elections'),
  async (req, res, next) => {
    try {
      const { status } = req.body;

      if (!['upcoming', 'registration', 'active', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      const election = await Election.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate('createdBy', 'fullName email');

      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Election status updated successfully',
        data: election
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get election results
// @route   GET /api/elections/:id/results
// @access  Public (only if results are declared)
router.get('/:id/results', async (req, res, next) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    // Check if results can be viewed
    const now = new Date();
    if (now < election.resultDate && !election.isResultDeclared) {
      return res.status(403).json({
        success: false,
        message: 'Results not yet available'
      });
    }

    const results = await Vote.getElectionResults(req.params.id);
    const totalVotes = await Vote.countVotesForElection(req.params.id);

    // Calculate vote percentages
    const resultsWithPercentage = results.map(result => ({
      ...result,
      percentage: totalVotes > 0 ? ((result.voteCount / totalVotes) * 100).toFixed(2) : 0
    }));

    res.status(200).json({
      success: true,
      data: {
        election: {
          id: election._id,
          title: election.title,
          constituency: election.constituency,
          state: election.state,
          totalVotes,
          turnoutPercentage: election.turnoutPercentage
        },
        results: resultsWithPercentage,
        winner: resultsWithPercentage.length > 0 ? resultsWithPercentage[0] : null,
        totalVotes,
        resultDeclaredAt: election.resultDeclaredAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Declare election results
// @route   POST /api/elections/:id/declare-results
// @access  Private (Admin only - election commissioner or super admin)
router.post('/:id/declare-results', 
  authenticate, 
  requireAdmin,
  async (req, res, next) => {
    try {
      // Only election commissioner or super admin can declare results
      if (req.user.role !== 'super_admin' && req.user.role !== 'election_commissioner') {
        return res.status(403).json({
          success: false,
          message: 'Only election commissioner or super admin can declare results'
        });
      }

      const election = await Election.findById(req.params.id);

      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found'
        });
      }

      if (election.status !== 'completed' && new Date() < election.votingEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot declare results before voting ends'
        });
      }

      // Get results to find winner
      const results = await Vote.getElectionResults(req.params.id);
      
      if (results.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No votes found for this election'
        });
      }

      const winner = results[0]._id; // Candidate with highest votes

      // Update election
      election.isResultDeclared = true;
      election.resultDeclaredAt = new Date();
      election.winner = winner;
      election.status = 'completed';
      
      await election.save();

      res.status(200).json({
        success: true,
        message: 'Election results declared successfully',
        data: {
          election: election._id,
          winner: results[0].candidate,
          totalVotes: results.reduce((sum, result) => sum + result.voteCount, 0)
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get election statistics
// @route   GET /api/elections/stats/overview
// @access  Private (Admin only)
router.get('/stats/overview', 
  authenticate, 
  requireAdmin, 
  requirePermission('view_results'),
  async (req, res, next) => {
    try {
      const stats = await Election.aggregate([
        {
          $group: {
            _id: null,
            totalElections: { $sum: 1 },
            upcomingElections: { $sum: { $cond: [{ $eq: ['$status', 'upcoming'] }, 1, 0] } },
            activeElections: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            completedElections: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }
        }
      ]);

      const typeStats = await Election.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: stats[0] || {
            totalElections: 0,
            upcomingElections: 0,
            activeElections: 0,
            completedElections: 0
          },
          typeDistribution: typeStats
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;