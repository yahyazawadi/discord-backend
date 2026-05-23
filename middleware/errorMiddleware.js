// Global Error Handler Middleware
export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR]: ${err.message}` || err);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let errorMsg = err.message || 'Internal Server Error';

  // Handle Mongoose Duplicate Key Error (11000)
  if (err.code === 11000) {
    statusCode = 400;
    const duplicatedField = err.keyValue ? Object.keys(err.keyValue)[0] : '';
    if (duplicatedField === 'username') {
      errorMsg = 'Username is already taken';
    } else if (duplicatedField === 'email') {
      errorMsg = 'Email is already registered';
    } else {
      errorMsg = 'A record with this unique value already exists';
    }
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMsg = Object.values(err.errors).map(val => val.message).join(', ');
  }

  res.status(statusCode).json({
    success: false,
    error: errorMsg,
    message: errorMsg,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

// Route Not Found Middleware
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
