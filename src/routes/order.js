const express = require("express");
const orderRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const Order = require("../models/order");
const Product = require("../models/product");
const { userAuth, adminAuth } = require('../middleware/auth');
const mongoose = require('mongoose');
const createPayment = require("../utils/createPayment");
/**
 * @route POST /api/orders
 * @description Creates a new order for the authenticated user.
 * It validates product availability, deducts stock, and calculates total amount server-side.
 * @access Private (Authenticated User)
 * @middleware userAuth
 * @body {object} - Contains order details: `items` (Array of objects: `{ product_id: string, qty: number }`), `address`: string.
 */
orderRouter.post('/api/orders', userAuth, async (req, res) => {
     let orderItemsForDb = [];
    try {
        const { items, shippingAddress } = req.body;
        const userId = req.user._id;

        if (!items || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
            return sendErrorResponse(res, 400, "Order must contain items and a shipping address.");
        }

        let calculatedTotalAmount = 0;
       
        for (const item of items) {
            if (!item.product_id || typeof item.qty !== 'number' || item.qty < 1 || !Number.isInteger(item.qty)) {
                return sendErrorResponse(res, 400, "Each item must have a valid product id and a positive integer quantity.");
            }

            const product = await Product.findOne({ _id: item.product_id });

            if (!product) {
                return sendErrorResponse(res, 404, `Product with product_id '${item.product_id}' not found.`);
            }
            if (product.stock < item.qty) {
                return sendErrorResponse(res, 400, `Insufficient stock for product '${product.productname}'. Available: ${product.stock}, Requested: ${item.qty}.`);
            }

            const updatedProduct = await Product.findOneAndUpdate(
                { _id: item.product_id, stock: { $gte: item.qty } },
                { $inc: { stock: -item.qty } },
                { new: true }
            );

            if (!updatedProduct) {
                return sendErrorResponse(res, 400, `Failed to update stock for product '${product.productname}'. Please try again.`);
            }

            const itemPrice = product.price;
            calculatedTotalAmount += itemPrice * item.qty;

            orderItemsForDb.push({
                product_id: product._id,
                qty: item.qty,
                priceAtOrder: itemPrice,
                productNameAtOrder: product.productname
            });
        }
        const result = await createPayment(userId, calculatedTotalAmount, req.user.firstName, req.user.lastName, req.user.email);
        if (!result.success) {
            const errorObj = result.err;
            const statusCode =  errorObj?.statusCode || 500;
            const description =  errorObj?.error?.description || 'internal server error';
            res.status(statusCode).json({
                status: false,
                description
            })
            return;
        }
  
        const newOrder = new Order({
            _id: result.data.orderId,
            userId,
            items: orderItemsForDb,
            totalAmount: calculatedTotalAmount,
            shippingAddress,
            status: 'pending'
        });

        await newOrder.save();
        res.status(201).json({
            message: result.message,
            success: true,
            data: {
                ...result.data.toJSON(), 
                key: process.env.RAZORPAY_KEY_ID,
            }
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Order validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to create order due to an internal server error.", err);
    }
});

/**
 * @route GET /api/orders
 * @description Retrieves all orders placed by current user in the system.
 * This endpoint can be extended with pagination, filtering, and sorting if needed.
 * @middleware userAuth
 */
orderRouter.get('/api/orders', userAuth, async (req, res) => {
    try {
       const orders = await Order.find({userId: req.user._id})
           .populate({ 
            path: 'userId',
            model: 'User', 
            select: 'userName email'
            })
            .select('-__v')
            .sort({ 'createdAt': -1 });

        if (orders.length === 0) {
            return sendErrorResponse(res, 404, "No orders found.");
        }

        res.status(200).json({
            message: "Orders retrieved successfully",
            success: true,
            data: orders
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve orders.", err);
    }
});

/**
 * @route GET /api/orders/:id
 * @description Retrieves a single order by its MongoDB ID.
 * A regular user can only retrieve their own orders. Admin can retrieve any order.
 * @access Private (Authenticated User or Admin)
 * @middleware userAuth
 * @param {string} id - The MongoDB _id of the order to retrieve.
 */
orderRouter.get('/api/orders/:id', userAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const isAdmin = req.user.role.includes('admin');

        const order = await Order.findById(id).populate({
            path :'userId',
            modal: 'User',
            select:'email userName'
        }).select('-__v');

        if (!order) {
            return sendErrorResponse(res, 404, 'Order not found.');
        }

        if (!isAdmin && order.userId._id.toString() !== userId.toString()) {
            return sendErrorResponse(res, 403, 'Unauthorized to access this order.');
        }

        res.status(200).json({
            message: "Order retrieved successfully",
            success: true,
            data: order
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve order.", err);
    }
});

/**
 * @route PATCH /api/orders/:id/status
 * @description Updates the status of an order identified by its MongoDB ID.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth
 * @param {string} id - The MongoDB _id of the order to update.
 * @body {object} - Contains the new status: `{ "status": "processing" }`
 */
orderRouter.patch('/api/orders/:id/status', userAuth, adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!status || !allowedStatuses.includes(status)) {
            return sendErrorResponse(res, 400, 'Invalid or missing order status. Allowed: ' + allowedStatuses.join(', '));
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { status: status },
            { new: true, runValidators: true }
        ).select('-__v');

        if (!updatedOrder) {
            return sendErrorResponse(res, 404, 'Order not found.');
        }

        res.status(200).json({
            message: `Order status updated to '${updatedOrder.status}' successfully`,
            success: true,
            data: updatedOrder
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to update order status.", err);
    }
});

// Export the orderRouter.
module.exports = orderRouter;
