const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error Stack:', err.stack);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      statusCode: 404,
      message,
      success: false
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    let message = 'Duplicate field value entered';
    const field = Object.keys(err.keyValue)[0];
    
    // Provide more specific messages for common duplicates
    if (field === 'email') {
      message = 'Email address is already registered';
    } else if (field === 'phoneNumber') {
      message = 'Phone number is already registered';
    } else if (field === 'aadhaarNumber') {
      message = 'Aadhaar number is already registered';
    }
    
    error = {
      statusCode: 400,
      message,
      success: false,
      field
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      statusCode: 400,
      message,
      success: false,
      validationErrors: Object.values(err.errors).map(val => ({
        field: val.path,
        message: val.message,
        value: val.value
      }))
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      statusCode: 401,
      message,
      success: false
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      statusCode: 401,
      message,
      success: false
    };
  }

  // Rate limit exceeded
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = {
      statusCode: 429,
      message,
      success: false
    };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = {
      statusCode: 400,
      message,
      success: false
    };
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    }),
    ...(error.field && { field: error.field }),
    ...(error.validationErrors && { validationErrors: error.validationErrors })
  });
};

module.exports = errorHandler;