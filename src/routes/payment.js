const express = require("express");
const paymentRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const Payment = require("../models/payment");
const Order = require("../models/order");
const { userAuth, adminAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

/**
 * @route POST /api/payments
 * @description Creates a new payment record for an order.
 * @access Private (Authenticated User/Admin) - A user might create their own payment, admin can too.
 * @middleware userAuth
 * @body {object} - Contains payment details: `order_id` (string), `method` (string), `transactionId` (string), `amountPaid` (number).
 */
paymentRouter.post('/api/payments', userAuth, async (req, res) => {
    try {
        const { order_id, method, transactionId, amountPaid } = req.body;

        if (!order_id || !method || !transactionId || amountPaid === undefined || amountPaid < 0) {
            return sendErrorResponse(res, 400, "Missing required payment fields: order_id, method, transactionId, amountPaid.");
        }

        if (!mongoose.Types.ObjectId.isValid(order_id)) {
            return sendErrorResponse(res, 400, 'Invalid order ID format.');
        }
        const order = await Order.findById(order_id).select('totalAmount status');
        if (!order) {
            return sendErrorResponse(res, 404, `Order with ID '${order_id}' not found.`);
        }
        const existingPayments = await Payment.find({order_id:order_id}).select('amountPaid');
        var totalPaid        = existingPayments.reduce((sum, payment) =>{
           return sum+payment.amountPaid;
        },0);
        totalPaid += amountPaid;
        let status = 'completed';
        if (order.totalAmount >= totalPaid) {
            status = 'partially paid'
        }
        const newPayment = new Payment({
            order_id,
            method,
            transactionId,
            amountPaid,
            status: status
        });

        await newPayment.save();

        await Order.findByIdAndUpdate(order_id, { status: 'processing' });

        res.status(201).json({
            message: "Payment recorded successfully",
            success: true,
            data: newPayment
        });

    } catch (err) {
        if (err.code === 11000) {
            return sendErrorResponse(res, 409, 'Payment with this transaction ID or for this order already exists.', err);
        }
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Payment validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to record payment due to an internal server error.", err);
    }
});

/**
 * @route GET /api/payments
 * @description Retrieves payment records. Admin can fetch all payments. Regular users can fetch their own payments.
 * Can filter payments by `order_id` or `transactionId` using query parameters.
 * @access Private (Authenticated User/Admin)
 * @middleware userAuth
 * @query order_id {string} - Optional. The MongoDB _id of the order to filter payments by.
 * @query transactionId {string} - Optional. The unique identifier of a payment transaction to filter by.
 */
paymentRouter.get('/api/payments', userAuth, async (req, res) => {
    try {
        const {order_id, transactionId} = req.query;
        const isAdmin = req.user.role.includes('admin');
        let queryFilter = {};
        if (!isAdmin) {
            const userOrders = await Order.find({user_id:req.user.user_id});
            if(userOrders.length == 0) {
                res.status(200).json({
                    message: 'no orders found for the user',
                    status: true
                })
            }
            const userorderIds = userOrders.map(order => order.order_id);
            queryFilter.order_id = {$in:userorderIds}
        }
        if (order_id) {
            if (!mongoose.Types.ObjectId.isValid(order_id)) {
                return sendErrorResponse(res,404,'invalid order id');
            }
            queryFilter.order_id = order_id;
            if(!isAdmin) {
                //check if any of the order_id in query filter has  order_id got in request
                if(!queryFilter.order_id.$in.some(id => id.equals(order_id))) {
                     res.status(200).json({
                        message: 'The order not found',
                        status: true
                    })
                } 
            }
        }
        if (transactionId) {
            queryFilter.transactionId = transactionId;
        }
        const payments = await Payment.find(queryFilter).select('-__v -_id');
        let message = "Payments retrieved successfully";
        if (transactionId) {
            message = `Payment${payments.length !== 1 ? 's' : ''} retrieved successfully for transaction ID '${transactionId}'`;
        } else if (order_id) {
            message = `Payments retrieved successfully for order ID '${order_id}'`;
        } else if (!isAdmin) {
            message = "Your payments retrieved successfully";
        } else {
            message = "All payments retrieved successfully (Admin)";
        }

        if (payments.length === 0 && (order_id || transactionId || !isAdmin)) {
            // Return 404 only if a specific filter was applied (order_id or transactionId)
            // or if it's a non-admin request with no payments found.
            // If it's an admin requesting all payments and none exist, it returns 200 with an empty array.
            return sendErrorResponse(res, 404, `No payments found matching the criteria.`);
        }

        res.status(200).json({
            message: message,
            success: true,
            data: payments
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve payments.", err);
    }
});

/**
 * @route PATCH /api/payments/:transactionId/status
 * @description Updates the status of a payment identified by its transaction ID.
 * @access Private (Admin Only) - Typically only admins or automated systems update payment status.
 * @middleware userAuth, adminAuth
 * @param {string} transactionId - The unique identifier of the payment transaction.
 * @body {object} - Contains the new status: `{ "status": "completed" }`
 */
paymentRouter.patch('/api/payments/:transactionId/status', userAuth, adminAuth, async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['pending', 'completed', 'failed', 'refunded', 'authorized'];
        if (!status || !allowedStatuses.includes(status)) {
            return sendErrorResponse(res, 400, 'Invalid or missing payment status. Allowed: ' + allowedStatuses.join(', '));
        }

        const updatedPayment = await Payment.findOneAndUpdate(
            { transactionId: transactionId },
            { status: status },
            { new: true, runValidators: true }
        ).select('-__v');

        if (!updatedPayment) {
            return sendErrorResponse(res, 404, `Payment with transaction ID '${transactionId}' not found.`);
        }

        if (updatedPayment.status === 'completed') {
            await Order.findByIdAndUpdate(updatedPayment.order_id, { status: 'processing' });
        } else if (updatedPayment.status === 'failed' || updatedPayment.status === 'refunded') {
            await Order.findByIdAndUpdate(updatedPayment.order_id, { status: 'cancelled' });
        }


        res.status(200).json({
            message: `Payment status updated to '${updatedPayment.status}' successfully`,
            success: true,
            data: updatedPayment
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to update payment status.", err);
    }
});

module.exports = paymentRouter;
