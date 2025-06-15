// Load environment variables from a .env file into process.env.
// This should typically be at the very top of your main application file
// to ensure environment variables are available throughout the app.
require('dotenv').config();

// Import the Express library to create and configure your web server.
const express = require("express");
// Import the user-related routes defined in './routes/user.js'.
const userRouter = require("./routes/user");
// Import the product-related routes defined in './routes/product.js'.
const productRouter = require("./routes/product");
// Import 'cookie-parser' middleware for parsing cookies attached to the client request object.
const cookieParser = require("cookie-parser");

// Create an instance of the Express application.
const app = express();
// Define the port for the server to listen on. It tries to use the PORT
// environment variable first, otherwise defaults to 7777.
const PORT = process.env.PORT || 7777;
// Import the database connection function from './config/database.js'.
const connectDB = require("./config/database");

// Call the connectDB function to establish a connection to the database.
// Use .then() for a successful connection and .catch() for connection errors.
connectDB().then(() => {
    console.log("database connection established");
}).catch(() => {
    console.log("database not connected")
})

// --- Middleware Setup ---
// Use built-in Express middleware to parse incoming JSON payloads in request bodies.
// This populates `req.body` with the parsed JSON data.
app.use(express.json());
// Use built-in Express middleware to parse URL-encoded payloads (e.g., from HTML forms).
// `extended: true` allows for rich objects and arrays to be encoded into the URL-encoded format.
app.use(express.urlencoded({ extended: true }));
// Use the cookie-parser middleware to parse cookies. This populates `req.cookies`.
app.use(cookieParser());

// --- Route Mounting ---
// Mount the userRouter. All routes defined in userRouter will be prefixed with '/'.
// For example, if userRouter has '/api/user/register', it will be accessible at '/api/user/register'.
app.use("/", userRouter);
// Mount the productRouter. All routes defined in productRouter will also be prefixed with '/'.
// This setup implies that user and product routes share the root path.
app.use("/", productRouter);

// Start the Express server and make it listen for incoming requests on the specified port.
app.listen(PORT, () => {
    console.log(`server is start running on port ${PORT}`);
});
