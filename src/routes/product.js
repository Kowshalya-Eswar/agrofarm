const express = require("express");
const productRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const Product = require("../models/product.js");
const {userAuth, adminAuth} = require('../middleware/auth');

/**
 * @route POST /api/product
 * @description Creates a new product in the database.
 * @middleware userAuth, adminAuth - Requires user authentication and admin privileges.
 * @body {object} - Contains product details like productname, description, price, unit, stock, sku.
 */
productRouter.post('/api/product',userAuth, adminAuth, async(req, res)=>{
    try {
        const {productname, description, price, unit, stock, sku} = req.body;
        const product = new Product({
            productname,
            description,
            price,
            unit,
            stock,
            sku
        })

        await product.save();
        res.status(200).json({
            message:"product added successfully",
            success: true
        })

    } catch(err) {
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
        const {sku} = req.params;
        const data = req.body;
        const ALLOWED_UPDATES = ["productname","price", "unit", "stock","description"];
        const is_allowed_updates = Object.keys(data).every(key =>
            ALLOWED_UPDATES.includes(key)
        )
        if(!is_allowed_updates) {
            throw new Error("update not allowed");
        }
        const updatedProduct = await Product.findOneAndUpdate({sku:sku}, data, {
            returnDocument: "after",
            runValidators:true
        })
        if (!updatedProduct) {
            throw new Error("updated failed");
        }
        res.status(200).json({
            message:"product updated successfully",
            success: true,
            data : updatedProduct
        })

    } catch(err) {
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
        const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit),100);

        if (isNaN(pageNum) || pageNum < 1) {
            return sendErrorResponse(res, 400, 'Invalid page number. Must be a positive integer.');
        }
        if (isNaN(limitNum) || limitNum < 1) {
            return sendErrorResponse(res, 400, 'Invalid limit. Must be a positive integer.');
        }

        const queryFilter = {};
        if (search) {
            queryFilter.$or = [
                { productname: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (pageNum - 1) * limitNum;
        const sortOptions = {};
        const validSortFields = ['productname', 'description', 'price', 'stock','quantity'];
        if (validSortFields.includes(sortBy)) {
            sortOptions[sortBy] = (order === 'desc' ? -1 : 1);
        } else {
            sortOptions['createdAt'] = -1;
            console.warn(`Invalid sortBy field: ${sortBy}. Defaulting to 'createdAt'.`);
        }
        const products = await Product.find(queryFilter).sort(sortOptions).skip(skip).limit(limitNum).select('-__v');
        const totalProducts = await Product.countDocuments(queryFilter);
        const totalPages = Math.ceil(totalProducts / limitNum);
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
        return sendErrorResponse(res, 400, 'failed to retrieve product',err )
    }
})

/**
 * @route DELETE /api/product/:sku
 * @description Deletes a product identified by its SKU.
 * @middleware userAuth, adminAuth - Requires user authentication and admin privileges.
 * @param {string} sku - The SKU of the product to delete (from URL parameters).
 */
productRouter.delete("/api/product/:sku", userAuth, adminAuth, async(req,res)=>{
    try {
        const { sku } = req.params;
        console.log("Attempting to delete product with SKU:", sku);

        const deletedProduct = await Product.findOneAndDelete({sku: sku});

        if (!deletedProduct) {
            return sendErrorResponse(res, 404, `Product with SKU '${sku}' not found.`);
        }
        res.status(200).json({
            status: true,
            message: `Product with SKU '${sku}' deleted successfully`,
            data: deletedProduct
        })
    } catch(err) {
        return sendErrorResponse(res, 500, 'Failed to delete product due to an internal server error.', err);
    }
})
module.exports = productRouter;
