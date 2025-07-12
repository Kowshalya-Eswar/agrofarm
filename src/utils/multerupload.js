
// This file centralizes the Multer configuration for file uploads.

const multer = require('multer');
const path = require('path');     
const fs = require('fs');      

// Define the directory where uploaded files will be stored.
// It creates an 'uploads' folder in the root of your project.
const uploadsDir = path.join(__dirname, '../..', 'public/uploads');

// Ensure the 'uploads' directory exists. If not, create it synchronously.
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    //console.log(`Created uploads directory at: ${uploadsDir}`);
}

// --- Multer Disk Storage Configuration ---
// This strategy stores the files on the server's local disk.
const storage = multer.diskStorage({
    // `destination` function determines where the file should be stored.
    // `cb` (callback) takes an error (if any) and the destination path.
    destination: function (req, file, cb) {
        cb(null, uploadsDir); // Store files in the 'uploads' directory.
    },
    // `filename` function determines what the file should be named inside the destination folder.
    // It's crucial to give unique names to prevent overwriting.
    filename: function (req, file, cb) {
        // Generate a unique suffix using a timestamp and a random number.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Combine the fieldname, unique suffix, and original file extension for the new filename.
        cb(null, req.body.product_id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// --- Multer File Filter Configuration (Optional but Recommended) ---
// This function validates the file type before accepting the upload.
const fileFilter = (req, file, cb) => {
    // Check the file's MIME type to ensure it's an image.
    if (file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/gif') {
        cb(null, true); // Accept the file (no error, true to accept).
    } else {
        // Reject the file if it's not an allowed image type.
        // Pass an Error object and false to the callback. This error will be
        // caught by the route handler.
        cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed!'), false);
    }
};

// --- Multer Upload Instance ---
// Configure the Multer instance with the storage settings, file size limits, and file filter.
const upload = multer({
    storage: storage, // Use the disk storage defined above.
    limits: {
        fileSize: 5 * 1024 * 1024 // Limit file size to 5MB (5 megabytes).
    },
    fileFilter: fileFilter // Apply the custom file type filter.
});

// Export the configured `upload` instance.
// This instance can now be imported and used as middleware in your Express routes.
// For example, `upload.single('fieldName')` or `upload.array('fieldName', maxCount)`.
module.exports = upload;
