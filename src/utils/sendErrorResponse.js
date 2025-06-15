// Helper function for sending consistent error responses
const sendErrorResponse = (res, statusCode, message, error = null) => {
    console.error(`Error ${statusCode}: ${message}`, error);
    res.status(statusCode).json({
        success: false,
        message: message,
        error: error ? error.message : null
    });
};

module.exports = sendErrorResponse;