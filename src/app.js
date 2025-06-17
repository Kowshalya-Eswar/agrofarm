
require('dotenv').config();
const express = require("express");
const userRouter = require("./routes/user");
const productRouter = require("./routes/product");
const productImageRouter = require('./routes/productImage');
const orderRouter = require("./routes/order");
// Import 'cookie-parser' middleware for parsing cookies attached to the client request object.
const cookieParser = require("cookie-parser");

// Create an instance of the Express application.
const app = express();
const PORT = process.env.PORT || 7777;
const connectDB = require("./config/database");


const path = require('path'); // For serving static files
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log(`Created uploads directory at: ${uploadsDir}`);
}
app.use(express.urlencoded({ extended: true })); // for URL-encoded bodies
app.use('/uploads', express.static(uploadsDir)); // Serve static files from /uploads
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

app.use("/", userRouter);

app.use("/", productRouter);

app.use("/", productImageRouter);

app.use("/", orderRouter);

// Start the Express server and make it listen for incoming requests on the specified port.
app.listen(PORT, () => {
    console.log(`server is start running on port ${PORT}`);
});
