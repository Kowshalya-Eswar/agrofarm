// Helper function for sending consistent error responses to the client.
// This function centralizes error handling logic, ensuring all error responses
// from your API have a consistent structure and logging.
const sendErrorResponse = (res, statusCode, message, error = null) => {
    // Log the error to the console for debugging purposes.
    // This includes the HTTP status code, a human-readable message, and the actual error object (if provided).
    console.error(`Error ${statusCode}: ${message}`, error);

    // Send the HTTP status code and a JSON response to the client.
    res.status(statusCode).json({
        success: false, // Indicates that the operation was not successful.
        message: message, // A descriptive message explaining the error to the client.
        // Include the error message from the actual error object if it exists, otherwise null.
        // This helps clients understand the specific nature of the error without exposing sensitive details.
        error: error ? error.message : null
    });
};

// Export the sendErrorResponse function so it can be imported and reused
// across different route handlers in your Express application.
module.exports = sendErrorResponse;
