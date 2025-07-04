const express = require("express");
const paymentRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const Payment = require("../models/payment");
const Order = require("../models/order");
const { userAuth, adminAuth } = require('../middleware/auth');
const sendEmail = require("../utils/sendEmail");
const {validateWebhookSignature} = require('razorpay/dist/utils/razorpay-utils');
const mongoose = require('mongoose');

/**
 * @route GET /api/payments
 * @description Retrieves payment records. Admin can fetch all payments. Regular users can fetch their own payments.
 * Can filter payments by `orderId` or `transactionId` using query parameters.
 * @access Private (Authenticated User/Admin)
 * @middleware userAuth
 * @query orderId {string} - Optional. The MongoDB _id of the order to filter payments by.
 * @query transactionId {string} - Optional. The unique identifier of a payment transaction to filter by.
 */
paymentRouter.get('/api/payments', userAuth, async (req, res) => {
    try {
        const {orderId, transactionId} = req.query;
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
            const userorderIds = userOrders.map(order => order.orderId);
            queryFilter.orderId = {$in:userorderIds}
        }
        if (orderId) {
            if (!mongoose.Types.ObjectId.isValid(orderId)) {
                return sendErrorResponse(res,404,'invalid order id');
            }
            queryFilter.orderId = orderId;
            if(!isAdmin) {
                //check if any of the orderId in query filter has  orderId got in request
                if(!queryFilter.orderId.$in.some(id => id.equals(orderId))) {
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
        } else if (orderId) {
            message = `Payments retrieved successfully for order ID '${orderId}'`;
        } else if (!isAdmin) {
            message = "Your payments retrieved successfully";
        } else {
            message = "All payments retrieved successfully (Admin)";
        }

        if (payments.length === 0 && (orderId || transactionId || !isAdmin)) {
            // Return 404 only if a specific filter was applied (orderId or transactionId)
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
 * @route   POST /api/payment/hook
 * @desc    Razorpay Webhook Handler - Handles payment status updates from Razorpay
 * @access  Public (should be protected by signature verification) 
 **/
paymentRouter.post("/api/payment/hook", async(req, res) =>{
    try {
        const signature = req.get('X-Razorpay-Signature');
        const isWebhookValid = validateWebhookSignature(JSON.stringify(req.body), 
        signature,
        process.env.RAZORPAY_WEBHOOK_SECRET);

        if (!isWebhookValid) {
            return sendErrorResponse(res, 400, "webhook signature is invalid");
        } 
        const paymentDetails = req.body.payload.payment.entity;
        const payment = await Payment.findOne({ orderId: paymentDetails.order_id});
        payment.status = paymentDetails.status;
        await payment.save();
        const order = await Order.findOne({orderId:paymentDetails.order_id})
        if (req.body.event == "payment.captured") {
            order.status = "processing";
        } else if (req.body.event == "payment.failed") {
            order.status = "failed";
        }
        await order.save();
        if (req.body.event == "payment.captured") {
            const userEmail = req.user.email;
            const userName = req.user.firstName + " " + req.user.lastName; 

            // Convert orderItemsForDb into HTML table rows
            let itemsHtml = order.items.map(item => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.productNameAtOrder}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.qty}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">₹${item.priceAtOrder.toFixed(2)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">₹${(item.qty * item.priceAtOrder).toFixed(2)}</td>
                </tr>
            `).join('');

            const emailSubject = `Order Confirmation #${paymentDetails.order_id}`; // Use order ID in subject
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
                            <p>Thank you for your order with Cocofields! Your order #${paymentDetails.order_id} has been successfully placed and is being processed.</p>
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
                                            <td style="font-weight: bold;">₹${order.totalAmount.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p><strong>Shipping Address:</strong></p>
                            <ul style ="list-style-type: none; padding-left: 0; margin: 0;">
                            <li>${order.shippingAddress.street} </li>
                            <li>${order.shippingAddress.city} </li>
                            <li>${order.shippingAddress.state} </li>
                            <li>${order.shippingAddress.pincode} </li>
                            <li>${order.shippingAddress.country} </li>
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
            mailStatus = await sendEmail.run(emailSubject, emailHtmlBody);
        } 
        console.log("order updated");
        return res.status(200).json({ msg: "webhook received successfully" });

    } catch (err) {
        console.error("Error in webhook handler:", err);
        return res.status(500).json({ msg: err.message });
    }
})

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
            await Order.findByIdAndUpdate(updatedPayment.orderId, { status: 'processing' });
        } else if (updatedPayment.status === 'failed' || updatedPayment.status === 'refunded') {
            await Order.findByIdAndUpdate(updatedPayment.orderId, { status: 'cancelled' });
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
