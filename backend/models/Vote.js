const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  // Voter Information (encrypted/anonymized)
  voter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voter',
    required: [true, 'Voter reference is required']
  },
  voterHash: {
    type: String,
    required: [true, 'Voter hash is required'], // Anonymized voter identifier
    unique: true
  },
  
  // Election Information
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: [true, 'Election reference is required']
  },
  
  // Candidate Information
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: [true, 'Candidate reference is required']
  },
  
  // Voting Details
  votedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Security and Verification
  voteHash: {
    type: String,
    required: [true, 'Vote hash is required'],
    unique: true
  },
  
  // Device/Location Information (for security)
  deviceInfo: {
    userAgent: String,
    ipAddress: String, // This should be encrypted/hashed for privacy
    location: {
      city: String,
      state: String,
      country: String
    }
  },
  
  // Vote Verification
  isVerified: {
    type: Boolean,
    default: true
  },
  verificationCode: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },
  
  // Status
  status: {
    type: String,
    enum: ['valid', 'invalid', 'disputed', 'under_review'],
    default: 'valid'
  },
  
  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String
  }]
}, {
  timestamps: true
});

// Compound indexes for unique voting constraints
voteSchema.index({ voter: 1, election: 1 }, { unique: true }); // One vote per voter per election
voteSchema.index({ election: 1, candidate: 1 }); // For counting votes per candidate
voteSchema.index({ votedAt: 1 }); // For time-based queries
voteSchema.index({ voteHash: 1 }, { unique: true }); // For vote verification
voteSchema.index({ voterHash: 1 }, { unique: true }); // For anonymized tracking

// Pre-save middleware to generate hashes
voteSchema.pre('save', async function(next) {
  if (this.isNew) {
    const crypto = require('crypto');
    
    // Generate voter hash (anonymized identifier)
    if (!this.voterHash) {
      const voterString = `${this.voter}_${this.election}_${Date.now()}`;
      this.voterHash = crypto.createHash('sha256').update(voterString).digest('hex');
    }
    
    // Generate vote hash for verification
    if (!this.voteHash) {
      const voteString = `${this.voter}_${this.candidate}_${this.election}_${this.votedAt}`;
      this.voteHash = crypto.createHash('sha256').update(voteString).digest('hex');
    }
    
    // Generate verification code
    if (!this.verificationCode) {
      this.verificationCode = crypto.randomBytes(16).toString('hex').toUpperCase();
    }
  }
  next();
});

// Method to verify vote integrity
voteSchema.methods.verifyIntegrity = function() {
  const crypto = require('crypto');
  const voteString = `${this.voter}_${this.candidate}_${this.election}_${this.votedAt}`;
  const expectedHash = crypto.createHash('sha256').update(voteString).digest('hex');
  return this.voteHash === expectedHash;
};

// Method to add audit log entry
voteSchema.methods.addAuditEntry = function(action, performedBy, reason = null) {
  this.auditLog.push({
    action,
    performedBy,
    reason,
    timestamp: new Date()
  });
  return this.save();
};

// Static method to get vote count for a candidate
voteSchema.statics.countVotesForCandidate = function(candidateId) {
  return this.countDocuments({ 
    candidate: candidateId, 
    status: 'valid' 
  });
};

// Static method to get total votes for an election
voteSchema.statics.countVotesForElection = function(electionId) {
  return this.countDocuments({ 
    election: electionId, 
    status: 'valid' 
  });
};

// Static method to get election results
voteSchema.statics.getElectionResults = function(electionId) {
  return this.aggregate([
    { 
      $match: { 
        election: mongoose.Types.ObjectId(electionId), 
        status: 'valid' 
      } 
    },
    { 
      $group: { 
        _id: '$candidate', 
        voteCount: { $sum: 1 } 
      } 
    },
    { 
      $lookup: {
        from: 'candidates',
        localField: '_id',
        foreignField: '_id',
        as: 'candidate'
      }
    },
    { 
      $unwind: '$candidate' 
    },
    { 
      $sort: { voteCount: -1 } 
    },
    {
      $project: {
        _id: 1,
        voteCount: 1,
        'candidate.fullName': 1,
        'candidate.politicalParty': 1,
        'candidate.profilePhoto': 1
      }
    }
  ]);
};

// Static method to check if voter has already voted in election
voteSchema.statics.hasVoterVoted = function(voterId, electionId) {
  return this.findOne({ 
    voter: voterId, 
    election: electionId 
  });
};

// Static method to get voting statistics
voteSchema.statics.getVotingStats = function(electionId) {
  return this.aggregate([
    { 
      $match: { 
        election: mongoose.Types.ObjectId(electionId), 
        status: 'valid' 
      } 
    },
    {
      $group: {
        _id: null,
        totalVotes: { $sum: 1 },
        votingStartTime: { $min: '$votedAt' },
        votingEndTime: { $max: '$votedAt' },
        hourlyBreakdown: {
          $push: {
            hour: { $hour: '$votedAt' },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$votedAt' } }
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Vote', voteSchema);