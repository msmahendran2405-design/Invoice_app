const jwt = require('jsonwebtoken');
const { getConfig } = require('../config');

/**
 * Middleware to verify JWT token in Authorization header
 * Expected format: Bearer <token>
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No authentication token provided.',
      code: 'NO_TOKEN',
    });
  }

  const token = authHeader.split(' ')[1];
  const config = getConfig();

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Optional authentication middleware:
 * Attaches user to req.user if a valid token is present, but does not block if absent.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const config = getConfig();

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // Ignore invalid/expired token for optional routes
  }
  next();
}

/**
 * Middleware to require Administrator role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden. Administrator access required.',
    });
  }
  next();
}

module.exports = {
  authenticateJWT,
  optionalAuth,
  requireAdmin,
};
