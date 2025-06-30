const express = require("express");
const orderRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const Order = require("../models/order");
const Product = require("../models/product");
const { userAuth, adminAuth } = require('../middleware/auth');
const mongoose = require('mongoose');
const sendEmail = require("../utils/sendEmail");
const createPayment = require("../utils/createPayment");
/**
 * @route POST /api/orders
 * @description Creates a new order for the authenticated user.
 * It validates product availability, deducts stock, and calculates total amount server-side.
 * @access Private (Authenticated User)
 * @middleware userAuth
 * @body {object} - Contains order details: `items` (Array of objects: `{ sku: string, qty: number }`), `address`: string.
 */
orderRouter.post('/api/orders', userAuth, async (req, res) => {
     let orderItemsForDb = [];
    try {
        const { items, shippingAddress } = req.body;
        const userId = req.user.userId;

        if (!items || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
            return sendErrorResponse(res, 400, "Order must contain items and a shipping address.");
        }

        let calculatedTotalAmount = 0;
       

        for (const item of items) {
            if (!item.sku || typeof item.qty !== 'number' || item.qty < 1 || !Number.isInteger(item.qty)) {
                return sendErrorResponse(res, 400, "Each item must have a valid SKU and a positive integer quantity.");
            }

            const product = await Product.findOne({ sku: item.sku });

            if (!product) {
                return sendErrorResponse(res, 404, `Product with SKU '${item.sku}' not found.`);
            }
            if (product.stock < item.qty) {
                return sendErrorResponse(res, 400, `Insufficient stock for product '${product.productname}'. Available: ${product.stock}, Requested: ${item.qty}.`);
            }

            const updatedProduct = await Product.findOneAndUpdate(
                { sku: item.sku, stock: { $gte: item.qty } },
                { $inc: { stock: -item.qty } },
                { new: true }
            );

            if (!updatedProduct) {
                return sendErrorResponse(res, 400, `Failed to update stock for product '${product.productname}'. Please try again.`);
            }

            const itemPrice = product.price;
            calculatedTotalAmount += itemPrice * item.qty;

            orderItemsForDb.push({
                sku: product.sku,
                qty: item.qty,
                priceAtOrder: itemPrice,
                productNameAtOrder: product.productname
            });
        }
        const result = await createPayment(userId, calculatedTotalAmount, req.user.firstName, req.user.lastName);
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
            orderId: result.data.orderId,
            userId,
            items: orderItemsForDb,
            totalAmount: calculatedTotalAmount,
            shippingAddress,
            status: 'pending'
        });

        await newOrder.save();
        const userEmail = req.user.email;
        const userName = req.user.firstName + " " + req.user.lastName; 

        // Convert orderItemsForDb into HTML table rows
        let itemsHtml = orderItemsForDb.map(item => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.productNameAtOrder}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.qty}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">₹${item.priceAtOrder.toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">₹${(item.qty * item.priceAtOrder).toFixed(2)}</td>
            </tr>
        `).join('');

       const emailSubject = `Order Confirmation #${newOrder._id}`; // Use order ID in subject
        const emailHtmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; }
                    .header { background-color: #f8f8f8; padding: 15px; text-align: center; border-bottom: 1px solid #eee; }
                    .header h1 { margin: 0; color: #4CAF50; }
                    .content { padding: 20px 0; }
                    .table-container { overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #777; font-size: 0.9em; }
                    .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Order Confirmed - Cocofields</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${userName},</p>
                        <p>Thank you for your order with Cocofields! Your order #${newOrder._id} has been successfully placed and is being processed.</p>
                        <p><strong>Order Summary:</strong></p>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th>Quantity</th>
                                        <th>Price</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3" style="text-align: right; font-weight: bold;">Grand Total:</td>
                                        <td style="font-weight: bold;">₹${calculatedTotalAmount.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <p><strong>Shipping Address:</strong></p>
                        <ul style ="list-style-type: none; padding-left: 0; margin: 0;">
                        <li>${shippingAddress.street} </li>
                        <li>${shippingAddress.city} </li>
                        <li>${shippingAddress.state} </li>
                        <li>${shippingAddress.pincode} </li>
                        <li>${shippingAddress.country} </li>
                        </ul>
                        <p>We will notify you once your order has been shipped.</p>
                        <p>If you have any questions or require any changes to your order, please do not hesitate to contact us at <a href="mailto:support@cocofields.in">support@cocofields.in</a>.</p>
                        <p>Thank you for choosing Cocofields!</p>
                        <p style="text-align: center;">
                            <a href="https://www.cocofields.in/orders-history" class="button">Check Orders</a>
                        </p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Cocofields. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        const mailStatus = await sendEmail.run(emailSubject, emailHtmlBody);
        console.log(mailStatus);
    
        res.status(201).json({
            message: result.message,
            success: true,
            data: {
                ...result.data.toJSON(), 
                key: process.env.RAZORPAY_KEY_ID,
            }
        });
    } catch (err) {
        if (orderItemsForDb && orderItemsForDb.length > 0) {
            console.warn("Attempting to rollback stock due to order creation failure...");
            for (const item of orderItemsForDb) {
                await Product.updateOne({ sku: item.sku }, { $inc: { stock: item.qty } });
                console.log(`Rolled back ${item.qty} for SKU ${item.sku}`);
            }
        }
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Order validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to create order due to an internal server error.", err);
    }
});

/**
 * @route GET /api/orders
 * @description Admin: Retrieves all orders in the system.
 * This endpoint can be extended with pagination, filtering, and sorting if needed.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth
 */
orderRouter.get('/api/orders', userAuth, adminAuth, async (req, res) => {
    try {
       const orders = await Order.find({})
            // CORRECTED POPULATE: Use foreignField to match Order.userId with User.userId
            .populate({ path: 'userId', model: 'User', select: 'userName email userId -_id', foreignField: 'userId' })
            .select('-__v -_id')
            .sort({ createdAt: -1 });

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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, 'Invalid order ID format.');
        }

        const order = await Order.findById(id).populate({
            path :'userId',
            modal: 'User',
            foreignField: 'userId',
            select:'userId email userName -_id'
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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, 'Invalid order ID format.');
        }

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
