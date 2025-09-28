const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id, userType, expiresIn = process.env.JWT_EXPIRE) => {
  return jwt.sign(
    { id, userType },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken
};