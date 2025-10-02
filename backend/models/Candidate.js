const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  // Personal Information
  fullName: {
    type: String,
    required: [true, 'Candidate name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [25, 'Candidate must be at least 25 years old'],
    max: [100, 'Age cannot exceed 100 years']
  },
  
  // Political Information
  politicalParty: {
    type: String,
    required: [true, 'Political party is required'],
    trim: true
  },
  partySymbol: {
    type: String, // URL or path to party symbol image
    default: null
  },
  
  // Election Information
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: [true, 'Election reference is required']
  },
  constituency: {
    type: String,
    required: [true, 'Constituency is required'],
    trim: true
  },
  
  // Media
  profilePhoto: {
    type: String, // URL or path to profile photo
    default: null
  },
  
  // Background Information
  education: {
    type: String,
    trim: true
  },
  occupation: {
    type: String,
    trim: true
  },
  experience: {
    type: String,
    trim: true
  },
  
  // Manifesto and Promises
  manifesto: [{
    point: {
      type: String,
      required: true,
      trim: true
    }
  }],
  
  // Campaign Information
  campaignSlogan: {
    type: String,
    trim: true,
    maxlength: [200, 'Campaign slogan cannot exceed 200 characters']
  },
  
  // Contact Information (Optional for public display)
  contactInfo: {
    email: {
      type: String,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid phone number']
    },
    website: {
      type: String,
      trim: true
    }
  },
  
  // Voting Statistics
  voteCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  
  // Nomination Details
  nominationDate: {
    type: Date,
    default: Date.now
  },
  nominatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Additional Information
  criminalRecord: {
    type: String,
    enum: ['none', 'minor', 'major'],
    default: 'none'
  },
  assetsValue: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
candidateSchema.index({ election: 1 });
candidateSchema.index({ constituency: 1 });
candidateSchema.index({ politicalParty: 1 });
candidateSchema.index({ isActive: 1, isApproved: 1 });

// Virtual for vote percentage (will be calculated at query time)
candidateSchema.virtual('votePercentage').get(function() {
  // This will be calculated in the application logic based on total votes
  return 0;
});

// Method to increment vote count
candidateSchema.methods.incrementVote = async function() {
  this.voteCount += 1;
  return this.save();
};

// Static method to get candidates by election
candidateSchema.statics.findByElection = function(electionId) {
  return this.find({ 
    election: electionId, 
    isActive: true, 
    isApproved: true 
  }).populate('election');
};

// Static method to get election results
candidateSchema.statics.getElectionResults = function(electionId) {
  return this.find({ 
    election: electionId, 
    isActive: true 
  })
  .sort({ voteCount: -1 })
  .populate('election');
};

module.exports = mongoose.model('Candidate', candidateSchema);