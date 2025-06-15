// Import the Express library to create and manage the router
const express = require("express");
// Create a new router instance specifically for product-related routes
const productRouter = express.Router();
// Import a utility function for sending consistent error responses
const sendErrorResponse = require("../utils/sendErrorResponse");
// Import the Mongoose Product model, which interacts with the 'products' collection in MongoDB
const Product = require("../models/product.js");
// Import authentication middleware for user and admin roles
const {userAuth, adminAuth} = require('../middleware/auth');

/**
 * @route POST /api/product
 * @description Creates a new product in the database.
 * @middleware userAuth, adminAuth - Requires user authentication and admin privileges.
 * @body {object} - Contains product details like productname, description, price, unit, stock, sku.
 */
productRouter.post('/api/product',userAuth, adminAuth, async(req, res)=>{
    try {
        // Destructure product details from the request body
        const {productname, description, price, unit, stock, sku} = req.body;
        // Create a new Product document instance with the received data
        const product = new Product({
            productname,
            description,
            price,
            unit,
            stock,
            sku
        })

        // Save the new product document to the database
        await product.save();
        // Send a success response if the product is added successfully
        res.status(200).json({
            message:"product added successfully",
            success: true
        })

    } catch(err) {
        // If an error occurs during product creation, send an error response
        return sendErrorResponse(res, 400, 'failed to add product',err)
    }
})

/**
 * @route PATCH /api/product/:sku
 * @description Updates an existing product identified by its SKU.
 * @middleware userAuth, adminAuth - Requires user authentication and admin privileges.
 * @param {string} sku - The SKU of the product to update (from URL parameters).
 * @body {object} - Contains the fields to be updated (e.g., { "price": 25.99 }).
 */
productRouter.patch('/api/product/:sku',userAuth, adminAuth, async(req, res)=>{
    try {
        // Extract the SKU from the URL parameters
        const {sku} = req.params;
        // Get the update data from the request body
        const data = req.body;
        // Define an array of allowed fields that can be updated
        const ALLOWED_UPDATES = ["productname","price", "unit", "stock","description"];
        // Check if all keys in the request body are present in the ALLOWED_UPDATES array
        const is_allowed_updates = Object.keys(data).every(key =>
            ALLOWED_UPDATES.includes(key)
        )
        // If the request body contains any disallowed fields, throw an error
        if(!is_allowed_updates) {
            throw new Error("update not allowed");
        }
        // Find a product by SKU and update it with the provided data.
        // 'returnDocument: "after"' returns the modified document rather than the original.
        // 'runValidators: true' ensures schema validators are run during the update operation.
        const updatedProduct = await Product.findOneAndUpdate({sku:sku}, data, {
            returnDocument: "after",
            runValidators:true
        })
        // If no product was found or updated, throw an error
        if (!updatedProduct) {
            throw new Error("updated failed");
        }
        // Send a success response with the updated product data
        res.status(200).json({
            message:"product updated successfully",
            success: true,
            data : updatedProduct
        })

    } catch(err) {
        // If an error occurs during product update, send an error response
        return sendErrorResponse(res, 400, 'failed to update product',err)
    }
})

/**
 * @route GET /api/product
 * @description Retrieves a list of products with optional pagination, searching, and sorting.
 * @middleware userAuth - Requires user authentication.
 * @query page {number} - The page number for pagination (default: 1).
 * @query limit {number} - The number of items per page (default: 10, max: 100).
 * @query search {string} - A search term to filter products by name or description.
 * @query sortBy {string} - The field to sort the results by (e.g., 'price', 'createdAt').
 * @query order {string} - The sort order, 'asc' for ascending or 'desc' for descending (default: 'desc').
 */
productRouter.get('/api/product', userAuth, async(req,res)=>{
    try {
        // Destructure query parameters with default values
        const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        // Parse page and limit to integers
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit),100); // Ensure limit does not exceed 100

        // Validate page number
        if (isNaN(pageNum) || pageNum < 1) {
            return sendErrorResponse(res, 400, 'Invalid page number. Must be a positive integer.');
        }
        // Validate limit number
        if (isNaN(limitNum) || limitNum < 1) {
            return sendErrorResponse(res, 400, 'Invalid limit. Must be a positive integer.');
        }

        // Initialize an empty query filter object
        const queryFilter = {};
        // If a search term is provided, build a case-insensitive regex query for productname or description
        if (search) {
            queryFilter.$or = [
                { productname: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        // Calculate the number of documents to skip for pagination
        const skip = (pageNum - 1) * limitNum;
        // Initialize an empty sort options object
        const sortOptions = {};
        // Define allowed fields for sorting
        const validSortFields = ['productname', 'description', 'price', 'stock','quantity'];
        // Apply sorting if a valid sortBy field is provided
        if (validSortFields.includes(sortBy)) {
            sortOptions[sortBy] = (order === 'desc' ? -1 : 1);
        } else {
            // Default to sorting by 'createdAt' descending if sortBy is invalid
            sortOptions['createdAt'] = -1;
            console.warn(`Invalid sortBy field: ${sortBy}. Defaulting to 'createdAt'.`);
        }
        // Execute the Mongoose query: find, sort, skip, limit, and exclude the '__v' field
        const products = await Product.find(queryFilter).sort(sortOptions).skip(skip).limit(limitNum).select('-__v'); // Exclude the Mongoose version key
        // Get the total count of products matching the filter for pagination metadata
        const totalProducts = await Product.countDocuments(queryFilter);
        // Calculate the total number of pages
        const totalPages = Math.ceil(totalProducts / limitNum);
        // Send a success response with products data and pagination metadata
        res.status(200).json({
            success: true,
            message: 'Products retrieved successfully',
            data: products,
            pagination: {
                totalItems: totalProducts,
                totalPages: totalPages,
                currentPage: pageNum,
                itemsPerPage: limitNum
            }
        });
    } catch(err) {
        // If an error occurs during product retrieval, send an error response
        return sendErrorResponse(res, 400, 'failed to retrieve product',err )
    }
})

/**
 * @route DELETE /api/product/:sku
 * @description Deletes a product identified by its SKU.
 * @middleware userAuth, adminAuth - Requires user authentication and admin privileges.
 * @param {string} sku - The SKU of the product to delete (from URL parameters).
 */
/**
 * @route DELETE /api/product/:sku
 * @description Deletes a product identified by its SKU.
 * @middleware userAuth, adminAuth - Requires user authentication and admin privileges.
 * @param {string} sku - The SKU of the product to delete (from URL parameters).
 */
productRouter.delete("/api/product/:sku", userAuth, adminAuth, async(req,res)=>{
    try {
        // Correctly extract the SKU string from the URL parameters
        const { sku } = req.params;
        console.log("Attempting to delete product with SKU:", sku); // Log the received SKU (now a string)

        // Find and delete a product by its SKU
        // Await the Mongoose operation to get the result
        const deletedProduct = await Product.findOneAndDelete({sku: sku});

        // If no product was found and deleted (deletedProduct will be null)
        if (!deletedProduct) {
            // Send a 404 Not Found response
            return sendErrorResponse(res, 404, `Product with SKU '${sku}' not found.`);
        }
        // Send a success response if the product is deleted successfully
        res.status(200).json({
            status: true,
            message: `Product with SKU '${sku}' deleted successfully`,
            data: deletedProduct // Optionally return the deleted product data
        })
    } catch(err) {
        // If a server error occurs during product deletion, send an appropriate error response
        return sendErrorResponse(res, 500, 'Failed to delete product due to an internal server error.', err);
    }

})
// Export the productRouter to be used in other parts of the application (e.g., in app.js)
module.exports = productRouter;
