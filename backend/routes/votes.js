const express = require('express');
const { body, validationResult } = require('express-validator');
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const { authenticate, requireVoter, requireAdmin, requirePermission } = require('../middleware/auth');

const router = express.Router();

// @desc    Cast a vote
// @route   POST /api/votes/cast
// @access  Private (Voter only)
router.post('/cast', 
  authenticate, 
  requireVoter,
  [
    body('electionId')
      .isMongoId()
      .withMessage('Valid election ID is required'),
    body('candidateId')
      .isMongoId()
      .withMessage('Valid candidate ID is required')
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

      const { electionId, candidateId } = req.body;
      const voterId = req.user._id;

      // Check if election exists and is in voting phase
      const election = await Election.findById(electionId);
      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found'
        });
      }

      if (!election.isVotingActive()) {
        return res.status(400).json({
          success: false,
          message: 'Voting is not currently active for this election'
        });
      }

      // Check if voter has already voted in this election
      const existingVote = await Vote.hasVoterVoted(voterId, electionId);
      if (existingVote) {
        return res.status(400).json({
          success: false,
          message: 'You have already voted in this election'
        });
      }

      // Check if candidate exists and is approved for this election
      const candidate = await Candidate.findOne({
        _id: candidateId,
        election: electionId,
        isActive: true,
        isApproved: true
      });

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found or not approved for this election'
        });
      }

      // Check if voter is eligible (verified and active)
      if (!req.user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Your account must be verified to vote'
        });
      }

      if (!req.user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account is not active'
        });
      }

      // Create the vote
      const vote = await Vote.create({
        voter: voterId,
        election: electionId,
        candidate: candidateId,
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          // Location can be added here if available
        }
      });

      // Update candidate vote count
      await candidate.incrementVote();

      // Update voter's voting status
      await Voter.findByIdAndUpdate(voterId, {
        hasVoted: true,
        $push: {
          votedElections: {
            election: electionId,
            votedAt: new Date()
          }
        }
      });

      // Update election statistics
      await Election.findByIdAndUpdate(electionId, {
        $inc: { totalVotesCast: 1 }
      });

      // Update turnout percentage
      await election.updateTurnout();

      res.status(201).json({
        success: true,
        message: 'Vote cast successfully',
        data: {
          voteId: vote._id,
          verificationCode: vote.verificationCode,
          votedAt: vote.votedAt,
          election: election.title,
          candidate: candidate.fullName
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Verify a vote
// @route   GET /api/votes/verify/:verificationCode
// @access  Public
router.get('/verify/:verificationCode', async (req, res, next) => {
  try {
    const { verificationCode } = req.params;

    const vote = await Vote.findOne({ verificationCode })
      .populate('election', 'title constituency state')
      .populate('candidate', 'fullName politicalParty');

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Verify vote integrity
    const isIntegrityValid = vote.verifyIntegrity();

    res.status(200).json({
      success: true,
      message: 'Vote verification successful',
      data: {
        voteId: vote._id,
        votedAt: vote.votedAt,
        status: vote.status,
        isVerified: vote.isVerified,
        integrityCheck: isIntegrityValid,
        election: {
          title: vote.election.title,
          constituency: vote.election.constituency,
          state: vote.election.state
        },
        candidate: {
          name: vote.candidate.fullName,
          party: vote.candidate.politicalParty
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get voter's voting history
// @route   GET /api/votes/history
// @access  Private (Voter only)
router.get('/history', authenticate, requireVoter, async (req, res, next) => {
  try {
    const votes = await Vote.find({ voter: req.user._id })
      .populate('election', 'title type constituency state votingStartDate votingEndDate')
      .populate('candidate', 'fullName politicalParty profilePhoto')
      .sort({ votedAt: -1 });

    res.status(200).json({
      success: true,
      count: votes.length,
      data: votes.map(vote => ({
        voteId: vote._id,
        verificationCode: vote.verificationCode,
        votedAt: vote.votedAt,
        status: vote.status,
        election: vote.election,
        candidate: vote.candidate
      }))
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get all votes (Admin only)
// @route   GET /api/votes
// @access  Private (Admin only)
router.get('/', 
  authenticate, 
  requireAdmin, 
  requirePermission('audit_logs'),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const startIndex = (page - 1) * limit;

      // Build query
      const query = {};
      
      // Filter by election
      if (req.query.election) {
        query.election = req.query.election;
      }

      // Filter by candidate
      if (req.query.candidate) {
        query.candidate = req.query.candidate;
      }

      // Filter by status
      if (req.query.status) {
        query.status = req.query.status;
      }

      // Filter by date range
      if (req.query.startDate && req.query.endDate) {
        query.votedAt = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate)
        };
      }

      const votes = await Vote.find(query)
        .populate('voter', 'fullName email phoneNumber')
        .populate('election', 'title constituency state')
        .populate('candidate', 'fullName politicalParty')
        .sort({ votedAt: -1 })
        .limit(limit)
        .skip(startIndex);

      const total = await Vote.countDocuments(query);

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
        count: votes.length,
        total,
        pagination,
        data: votes
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get votes for specific election (Admin only)
// @route   GET /api/votes/election/:electionId
// @access  Private (Admin only)
router.get('/election/:electionId', 
  authenticate, 
  requireAdmin, 
  requirePermission('view_results'),
  async (req, res, next) => {
    try {
      const { electionId } = req.params;

      // Check if election exists
      const election = await Election.findById(electionId);
      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found'
        });
      }

      // Get vote count by candidate
      const results = await Vote.getElectionResults(electionId);
      const totalVotes = await Vote.countVotesForElection(electionId);
      const votingStats = await Vote.getVotingStats(electionId);

      res.status(200).json({
        success: true,
        data: {
          election: {
            id: election._id,
            title: election.title,
            constituency: election.constituency,
            state: election.state
          },
          results,
          totalVotes,
          statistics: votingStats[0] || {}
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update vote status (Admin only)
// @route   PATCH /api/votes/:id/status
// @access  Private (Admin only)
router.patch('/:id/status', 
  authenticate, 
  requireAdmin, 
  requirePermission('audit_logs'),
  [
    body('status')
      .isIn(['valid', 'invalid', 'disputed', 'under_review'])
      .withMessage('Invalid status'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string')
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

      const { status, reason } = req.body;

      const vote = await Vote.findById(req.params.id);
      if (!vote) {
        return res.status(404).json({
          success: false,
          message: 'Vote not found'
        });
      }

      // Update vote status
      vote.status = status;
      await vote.save();

      // Add audit log entry
      await vote.addAuditEntry(`Status changed to ${status}`, req.user._id, reason);

      res.status(200).json({
        success: true,
        message: 'Vote status updated successfully',
        data: {
          voteId: vote._id,
          newStatus: status,
          updatedAt: new Date(),
          updatedBy: req.user.fullName
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get voting statistics
// @route   GET /api/votes/stats/overview
// @access  Private (Admin only)
router.get('/stats/overview', 
  authenticate, 
  requireAdmin, 
  requirePermission('view_results'),
  async (req, res, next) => {
    try {
      const stats = await Vote.aggregate([
        {
          $group: {
            _id: null,
            totalVotes: { $sum: 1 },
            validVotes: { $sum: { $cond: [{ $eq: ['$status', 'valid'] }, 1, 0] } },
            invalidVotes: { $sum: { $cond: [{ $eq: ['$status', 'invalid'] }, 1, 0] } },
            disputedVotes: { $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] } }
          }
        }
      ]);

      // Votes by hour (last 24 hours)
      const hoursAgo24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hourlyStats = await Vote.aggregate([
        { $match: { votedAt: { $gte: hoursAgo24 }, status: 'valid' } },
        {
          $group: {
            _id: { $hour: '$votedAt' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: stats[0] || {
            totalVotes: 0,
            validVotes: 0,
            invalidVotes: 0,
            disputedVotes: 0
          },
          hourlyVoting: hourlyStats
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;