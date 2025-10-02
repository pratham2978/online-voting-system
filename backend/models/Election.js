const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Election title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Election Type
  type: {
    type: String,
    required: [true, 'Election type is required'],
    enum: ['general', 'assembly', 'local', 'by-election', 'presidential'],
    default: 'general'
  },
  
  // Location/Scope
  scope: {
    type: String,
    required: [true, 'Election scope is required'],
    enum: ['national', 'state', 'district', 'constituency', 'local'],
    default: 'constituency'
  },
  constituency: {
    type: String,
    required: [true, 'Constituency is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  
  // Timeline
  registrationStartDate: {
    type: Date,
    required: [true, 'Registration start date is required']
  },
  registrationEndDate: {
    type: Date,
    required: [true, 'Registration end date is required']
  },
  votingStartDate: {
    type: Date,
    required: [true, 'Voting start date is required']
  },
  votingEndDate: {
    type: Date,
    required: [true, 'Voting end date is required']
  },
  resultDate: {
    type: Date,
    required: [true, 'Result announcement date is required']
  },
  
  // Election Configuration
  maxVotesPerVoter: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  allowedVoterAgeMin: {
    type: Number,
    default: 18,
    min: 18
  },
  
  // Status
  status: {
    type: String,
    enum: ['upcoming', 'registration', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Statistics
  totalRegisteredVoters: {
    type: Number,
    default: 0
  },
  totalVotesCast: {
    type: Number,
    default: 0
  },
  totalCandidates: {
    type: Number,
    default: 0
  },
  turnoutPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Election Officials
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Election creator is required']
  },
  electionOfficials: [{
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    role: {
      type: String,
      enum: ['chief', 'returning_officer', 'assistant', 'observer'],
      default: 'assistant'
    }
  }],
  
  // Additional Settings
  allowEVMs: {
    type: Boolean,
    default: true
  },
  allowPaperBallots: {
    type: Boolean,
    default: false
  },
  requireVoterIdVerification: {
    type: Boolean,
    default: true
  },
  
  // Results
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    default: null
  },
  isResultDeclared: {
    type: Boolean,
    default: false
  },
  resultDeclaredAt: Date
}, {
  timestamps: true
});

// Indexes
electionSchema.index({ status: 1 });
electionSchema.index({ constituency: 1 });
electionSchema.index({ state: 1 });
electionSchema.index({ votingStartDate: 1 });
electionSchema.index({ votingEndDate: 1 });

// Virtual for election phase
electionSchema.virtual('currentPhase').get(function() {
  const now = new Date();
  
  if (now < this.registrationStartDate) {
    return 'upcoming';
  } else if (now >= this.registrationStartDate && now <= this.registrationEndDate) {
    return 'registration';
  } else if (now >= this.votingStartDate && now <= this.votingEndDate) {
    return 'voting';
  } else if (now > this.votingEndDate && now < this.resultDate) {
    return 'counting';
  } else if (now >= this.resultDate) {
    return 'completed';
  } else {
    return 'waiting';
  }
});

// Method to check if election is in voting phase
electionSchema.methods.isVotingActive = function() {
  const now = new Date();
  return now >= this.votingStartDate && now <= this.votingEndDate && this.status === 'active';
};

// Method to check if registration is open
electionSchema.methods.isRegistrationOpen = function() {
  const now = new Date();
  return now >= this.registrationStartDate && now <= this.registrationEndDate;
};

// Method to update turnout percentage
electionSchema.methods.updateTurnout = function() {
  if (this.totalRegisteredVoters > 0) {
    this.turnoutPercentage = (this.totalVotesCast / this.totalRegisteredVoters) * 100;
  }
  return this.save();
};

// Static method to get active elections
electionSchema.statics.findActive = function() {
  return this.find({ 
    isActive: true,
    status: { $in: ['registration', 'active', 'upcoming'] }
  }).sort({ votingStartDate: 1 });
};

// Static method to get elections by phase
electionSchema.statics.findByPhase = function(phase) {
  const now = new Date();
  let query = {};
  
  switch(phase) {
    case 'upcoming':
      query = { registrationStartDate: { $gt: now } };
      break;
    case 'registration':
      query = { 
        registrationStartDate: { $lte: now },
        registrationEndDate: { $gte: now }
      };
      break;
    case 'voting':
      query = { 
        votingStartDate: { $lte: now },
        votingEndDate: { $gte: now },
        status: 'active'
      };
      break;
    case 'completed':
      query = { status: 'completed' };
      break;
  }
  
  return this.find(query).sort({ votingStartDate: 1 });
};

module.exports = mongoose.model('Election', electionSchema);