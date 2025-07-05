const rateLimit = require("express-rate-limit")

// --- Global Rate Limiter ---
// This limiter will apply to ALL routes that come after it.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  message: {
    status: false,
    code: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// --- Specific Route Limiter (e.g., for login attempts) ---
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  message: {
    status: false,
    code: 429,
    message: 'Too many login attempts from this IP, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Specific Route Limiter (e.g., for creating new accounts) ---
const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // Limit each IP to 10 signup attempts per day
  message: {
    status: false,
    code: 429,
    message: 'Too many account creation attempts from this IP. Please try again after 24 hours.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {globalLimiter, loginLimiter, signupLimiter}