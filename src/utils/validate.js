// This utility function is responsible for performing basic validation
// on the incoming request body for user registration.
// It checks for the presence of essential fields like firstName and lastName.
const ValidateRegisterData = (req) => {
    // Destructure firstName and lastName from the request body (req.body).
    // These fields are expected to be sent by the client during registration.
    const {firstName, lastName} = req.body;

    // Check if either firstName or lastName is missing (i.e., undefined, null, or an empty string).
    // If either is not provided, it indicates incomplete data for registration.
    if (!firstName || !lastName) {
        // If validation fails, throw an Error.
        // This error will typically be caught by the route's try-catch block,
        // which then sends an appropriate error response to the client.
        throw new Error("Firstname or Lastname should be present");
    }
}

// Export the ValidateRegisterData function so it can be imported and used
// in your user registration route to ensure incoming data meets basic requirements
// before further processing or database operations.
module.exports = ValidateRegisterData;
