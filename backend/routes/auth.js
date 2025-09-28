const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Voter = require('../models/Voter');
const Admin = require('../models/Admin');
const { generateToken } = require('../utils/jwt');

const router = express.Router();

// @desc    Register new voter
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phoneNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid Indian phone number'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('dateOfBirth')
    .isDate()
    .withMessage('Please provide a valid date of birth'),
  body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('aadhaarNumber')
    .matches(/^\d{4}\s\d{4}\s\d{4}$/)
    .withMessage('Please provide a valid Aadhaar number in format: XXXX XXXX XXXX')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      fullName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      aadhaarNumber,
      address,
      password
    } = req.body;

    // Check if voter already exists
    const existingVoter = await Voter.findOne({
      $or: [
        { email },
        { phoneNumber },
        { aadhaarNumber }
      ]
    });

    if (existingVoter) {
      return res.status(400).json({
        success: false,
        message: 'Voter with this email, phone number, or Aadhaar number already exists'
      });
    }

    // Check age eligibility
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(400).json({
        success: false,
        message: 'You must be at least 18 years old to register as a voter'
      });
    }

    // Create new voter
    const voter = await Voter.create({
      fullName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      aadhaarNumber,
      address,
      password
    });

    // Generate token
    const token = generateToken(voter._id, 'voter');

    res.status(201).json({
      success: true,
      message: 'Voter registered successfully',
      token,
      voter: {
        id: voter._id,
        fullName: voter.fullName,
        email: voter.email,
        phoneNumber: voter.phoneNumber,
        isVerified: voter.isVerified,
        registeredAt: voter.registeredAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Login voter
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('identifier')
    .notEmpty()
    .withMessage('Email or phone number is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { identifier, password } = req.body;

    // Find voter by email or phone number
    const voter = await Voter.findOne({
      $or: [
        { email: identifier },
        { phoneNumber: identifier }
      ]
    });

    if (!voter) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!voter.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await voter.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    voter.lastLogin = new Date();
    await voter.save();

    // Generate token
    const token = generateToken(voter._id, 'voter');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      voter: {
        id: voter._id,
        fullName: voter.fullName,
        email: voter.email,
        phoneNumber: voter.phoneNumber,
        hasVoted: voter.hasVoted,
        isVerified: voter.isVerified,
        lastLogin: voter.lastLogin
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
router.post('/admin/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (admin.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts'
      });
    }

    // Check if account is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      await admin.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts and update last login
    await admin.resetLoginAttempts();
    admin.lastLogin = new Date();
    await admin.save();

    // Log activity
    await admin.logActivity('login', req.ip, req.get('User-Agent'));

    // Generate token
    const token = generateToken(admin._id, 'admin');

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin
      }
    });

  } catch (error) {
    next(error);
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', require('../middleware/auth').authenticate, async (req, res, next) => {
  try {
    if (req.userType === 'voter') {
      res.status(200).json({
        success: true,
        profile: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phoneNumber: req.user.phoneNumber,
          dateOfBirth: req.user.dateOfBirth,
          gender: req.user.gender,
          address: req.user.address,
          hasVoted: req.user.hasVoted,
          isVerified: req.user.isVerified,
          registeredAt: req.user.registeredAt,
          userType: 'voter'
        }
      });
    } else if (req.userType === 'admin') {
      res.status(200).json({
        success: true,
        profile: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          role: req.user.role,
          permissions: req.user.permissions,
          department: req.user.department,
          designation: req.user.designation,
          lastLogin: req.user.lastLogin,
          userType: 'admin'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;