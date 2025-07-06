const express = require("express");
const shipmentRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse");
const Shipment = require("../models/shipment");
const Order = require("../models/order"); // Needed for authorization checks
const { userAuth, adminAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

/**
 * @route POST /api/shipments
 * @description Creates a new shipment record for an order.
 * @access Private (Admin Only) - Typically only admins or fulfillment systems create shipments.
 * @middleware userAuth, adminAuth
 * @body {object} - Contains shipment details: `orderId` (string), `carrier` (string), `trackingNumber` (string), `origin` (string), `destination` (string).
 */
shipmentRouter.post('/api/shipments', userAuth, adminAuth, async (req, res) => {
    try {
        const { orderId, carrier, trackingNumber, origin, destination } = req.body;

        if (!orderId || !carrier || !trackingNumber || !origin || !destination) {
            return sendErrorResponse(res, 400, "Missing required shipment fields.");
        }

        // Check if the order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return sendErrorResponse(res, 404, `Order with ID '${orderId}' not found.`);
        }

        const newShipment = new Shipment({
            orderId,
            carrier,
            trackingNumber,
            origin,
            destination,
            status: 'pending', // Initial status
            routes: [{ location: origin, description: 'Shipment created and awaiting pickup' }] // Initial route entry
        });

        await newShipment.save();

        // Optional: Update the associated order's status to 'shipped' if that's your workflow
        await Order.findByIdAndUpdate(orderId, { status: 'shipped' });

        res.status(201).json({
            message: "Shipment created successfully",
            success: true,
            data: newShipment
        });

    } catch (err) {
        if (err.code === 11000) { // Duplicate key error (e.g., trackingNumber or orderId unique)
            return sendErrorResponse(res, 409, 'Shipment with this tracking number or for this order already exists.', err);
        }
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Shipment validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to create shipment due to an internal server error.", err);
    }
});
/**
 * @route POST /api/shipments
 * @description delete the shipment record
 * @access Private (Authenticated User/Admin)
 * @middleware userAuth
 * @body {object} contains shipment id
 */
shipmentRouter.delete('/api/shipments', userAuth, adminAuth, async (req, res) => {
    try {
        const { shipping_id } = req.body;

        if (!shipping_id) {
            return sendErrorResponse(res, 400, "Shipping id is required.");
        }
        const deleted_shipment = await Shipment.findByIdAndDelete(shipping_id);

        res.json({
            message: "Shipment deleted successfully",
            success: true,
            data: deleted_shipment
        });

    } catch (err) {
        sendErrorResponse(res, 500, "Failed to delete shipment entry.", err);
    }
});

/**
 * @route GET /api/shipments
 * @description Retrieves shipment records. Admin can fetch all shipments. Regular users can fetch shipments for their own orders.
 * Can filter shipments by `orderId` or `trackingNumber` using query parameters.
 * @access Private (Authenticated User/Admin)
 * @middleware userAuth
 * @query orderId {string} - Optional. The MongoDB _id of the order to filter shipments by.
 * @query trackingNumber {string} - Optional. The unique tracking number to filter by.
 */
shipmentRouter.get('/api/shipments', userAuth, async (req, res) => {
    try {
        const { orderId, trackingNumber } = req.query;
        const isAdmin = req.user.role.includes('admin');
        const currentUserId = req.user._id;

        let queryFilter = {};

        // Base filter: If not admin, restrict to user's orders
        if (!isAdmin) {
            const userOrders = await Order.find({ userId: currentUserId }).select('_id');
            const userOrderIds = userOrders.map(order => order._id);

            if (userOrderIds.length === 0) {
                return res.status(200).json({
                    message: "No shipments found for this user.",
                    success: true,
                    data: []
                });
            }
            queryFilter.orderId = { $in: userOrderIds };
        }

        // Apply optional orderId filter
        if (orderId) {
            queryFilter.orderId = orderId;
            if (!isAdmin) {
                if (!queryFilter.orderId.$in.some(id => id.equals(orderId))) {
                    return sendErrorResponse(res, 403, 'Unauthorized to view shipments for this order ID.');
                }   
            }
        }

        // Apply optional trackingNumber filter
        if (trackingNumber) {
            queryFilter.trackingNumber = trackingNumber;
        }

        const shipments = await Shipment.find(queryFilter).select('-__v');

        let message = "Shipments retrieved successfully";
        if (trackingNumber) {
            message = `Shipment${shipments.length !== 1 ? 's' : ''} retrieved successfully for tracking number '${trackingNumber}'`;
        } else if (orderId) {
            message = `Shipments retrieved successfully for order ID '${orderId}'`;
        } else if (!isAdmin) {
            message = "Your shipments retrieved successfully";
        } else {
            message = "All shipments retrieved successfully (Admin)";
        }

        if (shipments.length === 0 && (orderId || trackingNumber || !isAdmin)) {
            return sendErrorResponse(res, 404, `No shipments found matching the criteria.`);
        }

        res.status(200).json({
            message: message,
            success: true,
            data: shipments
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve shipments.", err);
    }
});

/**
 * @route GET /api/shipments/:trackingNumber
 * @description Retrieves a single shipment record by its tracking number.
 * @access Private (Authenticated User/Admin) - User can fetch their own shipment, admin can fetch any.
 * @middleware userAuth
 * @param {string} trackingNumber - The unique tracking number of the shipment.
 */
shipmentRouter.get('/api/shipments/:trackingNumber', userAuth, async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const isAdmin = req.user.role.includes('admin');
        const currentUserId = req.user._id;

        const shipment = await Shipment.findOne({ trackingNumber: trackingNumber }).select('-__v');

        if (!shipment) {
            return sendErrorResponse(res, 404, `Shipment with tracking number '${trackingNumber}' not found.`);
        }

        // Authorization check: If not admin, ensure the shipment belongs to user's order
        if (!isAdmin) {
            const order = await Order.findById(shipment.orderId).select('userId');
            if (!order || order.userId.toString() !== currentUserId.toString()) {
                return sendErrorResponse(res, 403, 'Unauthorized to view this shipment.');
            }
        }

        res.status(200).json({
            message: "Shipment retrieved successfully",
            success: true,
            data: shipment
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve shipment.", err);
    }
});

/**
 * @route PATCH /api/shipments/:trackingNumber/status
 * @description Updates the status of a shipment identified by its tracking number.
 * @access Private (Admin Only) - Typically only admins or automated systems update shipment status.
 * @middleware userAuth, adminAuth
 * @param {string} trackingNumber - The unique tracking number of the shipment.
 * @body {object} - Contains the new status: `{ "status": "shipped" }`
 */
shipmentRouter.patch('/api/shipments/:trackingNumber/status', userAuth, adminAuth, async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['pending', 'shipped', 'in transit', 'delivered', 'failed', 'returned'];
        if (!status || !allowedStatuses.includes(status)) {
            return sendErrorResponse(res, 400, 'Invalid or missing shipment status. Allowed: ' + allowedStatuses.join(', '));
        }

        const updatedShipment = await Shipment.findOneAndUpdate(
            { trackingNumber: trackingNumber },
            { status: status },
            { new: true, runValidators: true }
        ).select('-_id -__v');

        if (!updatedShipment) {
            return sendErrorResponse(res, 404, `Shipment with tracking number '${trackingNumber}' not found.`);
        }

        // Optional: Update associated order status if shipment is delivered
        if (updatedShipment.status === 'delivered') {
            await Order.findOneAndUpdate({_id: updatedShipment.orderId}, { status: 'delivered' });
        } else if (updatedShipment.status === 'failed' || updatedShipment.status === 'returned') {
            await Order.findOneAndUpdate({_id: updatedShipment.orderId}, { status: 'shipment_failed' }); 
        }


        res.status(200).json({
            message: `Shipment status updated to '${updatedShipment.status}' successfully`,
            success: true,
            data: updatedShipment
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to update shipment status.", err);
    }
});

/**
 * @route PATCH /api/shipments/:trackingNumber/route
 * @description Adds a new route checkpoint to a shipment's tracking history.
 * @access Private (Admin Only) - Only admins or automated systems should update route progress.
 * @middleware userAuth, adminAuth
 * @param {string} trackingNumber - The unique tracking number of the shipment.
 * @body {object} - Contains route details: `location` (string), `description` (string), `timestamp` (optional, Date string).
 */
shipmentRouter.patch('/api/shipments/:trackingNumber/route', userAuth, adminAuth, async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const { location, description, timestamp } = req.body;

        if (!location || !description) {
            return sendErrorResponse(res, 400, "Missing required route fields: location, description.");
        }

        const newRouteEntry = {
            location,
            description,
            timestamp: timestamp ? new Date(timestamp) : Date.now()
        };

        const updatedShipment = await Shipment.findOneAndUpdate(
            { trackingNumber: trackingNumber },
            { $push: { routes: newRouteEntry } }, // Atomically push new entry to array
            { new: true, runValidators: true }
        ).select('-_id -__v');

        if (!updatedShipment) {
            return sendErrorResponse(res, 404, `Shipment with tracking number '${trackingNumber}' not found.`);
        }

        res.status(200).json({
            message: "Shipment route updated successfully",
            success: true,
            data: updatedShipment
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to update shipment route.", err);
    }
});


module.exports = shipmentRouter;
