
// Import the Mongoose library, an ODM (Object Data Modeling) library
// for MongoDB and Node.js. It simplifies interactions with the database.
const mongoose = require('mongoose');

/**
 * @function connectDB
 * @description Establishes a connection to the MongoDB database using Mongoose.
 * It uses the DATABASE_URL found in the environment variables.
 * @returns {Promise<void>} A Promise that resolves if the connection is successful,
 * and rejects if there's an error during connection.
 */
const connectDB = async () => {
    try {
        // Attempt to connect to the MongoDB database using the URL from process.env.
        // `await` ensures that the connection promise resolves before moving on.
        await mongoose.connect(process.env.DATABASE_URL);
        // Console log for successful connection can be added here or in the calling file.
        // console.log("MongoDB connected successfully!");
    } catch (err) {
        // If an error occurs during connection, log it and re-throw to be caught
        // by the calling function (e.g., in app.js).
        //console.error("MongoDB connection error:", err);
        throw err; // Re-throw the error to indicate connection failure upstream.
    }
}

// Export the connectDB function so it can be imported and called
// from your main application file (e.g., app.js) to initialize the database connection.
module.exports = connectDB;
