
// This file defines the Express router for handling product image API endpoints.

const express = require("express");
const productImageRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const ProductImage = require("../models/productImage");
const Product = require("../models/product"); 
const { userAuth, adminAuth } = require('../middleware/auth'); 
const upload = require('../utils/multerupload');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');

/**
 * @route POST /api/productimages
 * @description Adds a new image for an existing product, including file upload.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth, upload.single('productImageFile')
 * @body {multipart/form-data} - Contains fields:
 * - `id`: string (text field)
 * - `isMain`: boolean (text field, 'true' or 'false')
 * - `productImageFile`: file (the image file itself)
 */
productImageRouter.post(
    '/api/productimages',
    userAuth,
    adminAuth,
    upload.single('productImageFile'),
    async (req, res) => {
        try {
            const { product_id, isMain } = req.body;
            const uploadedFile = req.file;

            if (!product_id) {
                // If Multer processed the file but id is missing, clean up the file.
                if (uploadedFile && fs.existsSync(uploadedFile.path)) {
                    fs.unlinkSync(uploadedFile.path);
                }
                return sendErrorResponse(res, 400, "Product id is required.");
            }

            if (!uploadedFile) {
                return sendErrorResponse(res, 400, "No image file uploaded or file type not allowed.");
            }

            const isMainBoolean = isMain === 'true';

            const imageUrl = `/uploads/${uploadedFile.filename}`;

            const newImage = new ProductImage({ product_id, imageUrl, isMain: isMainBoolean });
            await newImage.save();

            res.status(201).json({
                message: "Product image added successfully",
                success: true,
                data: newImage,
                uploadedFileUrl: imageUrl
            });
        } catch (err) { // 'err' is correctly defined as the catch block parameter
            // Multer-specific errors
            if (err instanceof multer.MulterError) {
                return sendErrorResponse(res, 400, err.message, err);
            }
            // Mongoose validation errors
            if (err.name === 'ValidationError') {
                // Clean up file if validation failed after upload
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                const errors = Object.keys(err.errors).map(key => err.errors[key].message);
                return sendErrorResponse(res, 400, `Validation failed: ${errors.join(', ')}`, err);
            }
            // Custom file filter error
            if (err.message.includes('Only image files')) {
                 // Clean up file if validation failed after upload
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return sendErrorResponse(res, 400, err.message, err);
            }
            // Generic server error
            sendErrorResponse(res, 500, "Failed to add product image due to server error.", err);
        }
    }
);

/**
 * @route GET /api/productimages/:product_id
 * @description Retrieves all images associated with a specific product id.
 * @access Private (Authenticated User)
 * @middleware userAuth
 * @param {string} product_id - The product id of the product whose images are to be retrieved.
 */
productImageRouter.get('/api/productimages/:product_id', userAuth, async (req, res) => {
    try {
        const { product_id } = req.params;
        if (!product_id) {
            return sendErrorResponse(res, 400, "Product id is required.");
        }
        const images = await ProductImage.find({ product_id }).sort({ isMain: -1, createdAt: 1 }).select('-__v');
        if (images.length === 0) {
            return sendErrorResponse(res, 404, `No images found for product id '${product_id}'.`);
        }
        res.status(200).json({
            message: `Images for product product_id '${product_id}' retrieved successfully`,
            success: true,
            data: images
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve product images.", err);
    }
});

/**
 * @route GET /api/productimages/image/:id
 * @description Retrieves a single product image by its unique MongoDB ID.
 * @access Private (Authenticated User)
 * @middleware userAuth
 * @param {string} id - The MongoDB _id of the image to retrieve.
 */
productImageRouter.get('/api/productimages/image/:id', userAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, 'Invalid image ID format.');
        }
        const image = await ProductImage.findById(id).select('-__v');
        if (!image) {
            return sendErrorResponse(res, 404, 'Product image not found.');
        }
        res.status(200).json({
            message: "Product image retrieved successfully",
            success: true,
            data: image
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve product image.", err);
    }
});


/**
 * @route PATCH /api/productimages/image/:id
 * @description Updates an existing product image identified by its ID.
 * Allows updating `imageUrl`, `isMain`, and the actual image *file*.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth, upload.single('productImageFile') - accepts file uploads
 * @param {string} id - The MongoDB _id of the image to update.
 * @body {multipart/form-data} - Can contain:
 * - `productImageFile`: file (the new image file)
 * - `imageUrl`: string (if manually updating URL without new file, or to override file-generated URL)
 * - `isMain`: boolean (text field, 'true' or 'false')
 * Note: If `productImageFile` is provided, `imageUrl` in the database will be updated based on the new file.
 */
productImageRouter.patch(
    '/api/productimages/image/:id',
    userAuth,
    adminAuth,
    upload.single('productImageFile'), // NEW: Add Multer middleware to handle file uploads for PATCH
    async (req, res) => {
        try {
            const { id } = req.params;
            // `req.body` will now contain non-file fields from multipart/form-data
            // If a file is uploaded, req.file will be populated.
            const { imageUrl: manualImageUrl, isMain } = req.body;
            const newUploadedFile = req.file;

            // Start building the update object for Mongoose
            const updateFields = {};

            if (!mongoose.Types.ObjectId.isValid(id)) {
                // If ID is invalid, clean up any uploaded file immediately.
                if (newUploadedFile && fs.existsSync(newUploadedFile.path)) {
                    fs.unlinkSync(newUploadedFile.path);
                }
                return sendErrorResponse(res, 400, 'Invalid image ID format.');
            }

            // Find the existing image document *before* updating
            const existingImage = await ProductImage.findById(id);
            if (!existingImage) {
                // If image not found, clean up any new uploaded file.
                if (newUploadedFile && fs.existsSync(newUploadedFile.path)) {
                    fs.unlinkSync(newUploadedFile.path);
                }
                return sendErrorResponse(res, 404, 'Product image not found.');
            }

            // --- Handle Image File Update ---
            if (newUploadedFile) {
                // A new file was uploaded.
                // 1. Set the new image URL based on the uploaded file.
                updateFields.imageUrl = `/uploads/${newUploadedFile.filename}`;

                // 2. Delete the old image file from disk.
                const oldFilename = path.basename(existingImage.imageUrl);
                const oldFilePath = path.join(__dirname, '../../public/uploads', oldFilename);

                if (fs.existsSync(oldFilePath) && oldFilename !== newUploadedFile.filename) { // Ensure not deleting newly uploaded file if somehow name matches
                    fs.unlinkSync(oldFilePath);
                    console.log(`Deleted old image file: ${oldFilePath}`);
                } else if (!fs.existsSync(oldFilePath)) {
                    console.warn(`Old image file not found on disk: ${oldFilePath}`);
                }
            } else if (manualImageUrl) {
                // No new file uploaded, but a new imageUrl was provided manually in the body.
                // This means the user wants to update the URL without uploading a new file.
                updateFields.imageUrl = manualImageUrl;
                // In this case, we don't delete the old file, as no new file replaces it.
                // If you *always* want a file on disk, you'd add more logic here.
            }

            // --- Handle isMain Status Update ---
            // isMain will come as a string 'true' or 'false' from form-data if checkbox is present
            if (isMain !== undefined) {
                updateFields.isMain = isMain === 'true';
            }

            // Check if any update data is actually provided (either file or text fields)
            if (Object.keys(updateFields).length === 0) {
                return sendErrorResponse(res, 400, 'No valid update data provided (neither new file, imageUrl, nor isMain).');
            }

            // Define allowed fields that can be updated.
            // Note: `imageUrl` is handled by file upload or manual `imageUrl` update.
            const ALLOWED_BODY_UPDATES = ['isMain', 'imageUrl']; // Explicitly list what req.body can directly update
            // Filter `updateFields` to only include allowed updates (including the new imageUrl if from file)
            const finalUpdateData = {};
            for (const key of Object.keys(updateFields)) {
                if (ALLOWED_BODY_UPDATES.includes(key)) {
                    finalUpdateData[key] = updateFields[key];
                }
            }

            // Ensure there's still something to update after filtering
            if (Object.keys(finalUpdateData).length === 0) {
                 return sendErrorResponse(res, 400, 'No valid update data provided after filtering.');
            }

            // Find the image by ID and update it.
            const updatedImage = await ProductImage.findByIdAndUpdate(
                id,
                finalUpdateData, // Use the carefully constructed update object
                { new: true, runValidators: true }
            ).select('-__v');

            if (!updatedImage) {
                // This should theoretically not happen if existingImage was found, but as a safeguard.
                return sendErrorResponse(res, 404, 'Product image not found during update confirmation.');
            }

            res.status(200).json({
                message: "Product image updated successfully",
                success: true,
                data: updatedImage
            });
        } catch (err) {
            // Handle Multer errors (e.g., file size limits, invalid file type)
            if (err instanceof multer.MulterError) {
                return sendErrorResponse(res, 400, err.message, err);
            }
            // Mongoose validation errors
            if (err.name === 'ValidationError') {
                // If a new file was uploaded but Mongoose validation failed, delete the new file.
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                const errors = Object.keys(err.errors).map(key => err.errors[key].message);
                return sendErrorResponse(res, 400, `Validation failed: ${errors.join(', ')}`, err);
            }
            // Custom file filter error (from utils/multerUpload.js)
            if (err.message.includes('Only image files')) {
                // If a new file was uploaded but file filter rejected it, delete the new file.
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return sendErrorResponse(res, 400, err.message, err);
            }
            // Generic server error
            sendErrorResponse(res, 500, "Failed to update product image due to server error.", err);
        }
    }
);

/**
 * @route DELETE /api/productimages/image/:id
 * @description Deletes a product image by its ID, and removes the associated file from disk.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth
 * @param {string} id - The MongoDB _id of the image to delete.
 */
productImageRouter.delete('/api/productimages/image/:id', userAuth, adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, 'Invalid image ID format.');
        }

        const deletedImage = await ProductImage.findByIdAndDelete(id);

        if (!deletedImage) {
            return sendErrorResponse(res, 404, 'Product image not found.');
        }

        const filename = path.basename(deletedImage.imageUrl);
        const filePath = path.join(__dirname, '../uploads', filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
        } else {
            console.warn(`File not found on disk, but database entry deleted: ${filePath}`);
        }

        res.status(200).json({
            message: "Product image deleted successfully",
            success: true,
            data: deletedImage
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to delete product image.", err);
    }
});

module.exports = productImageRouter;