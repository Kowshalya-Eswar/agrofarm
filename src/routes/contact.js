const express = require("express");
const contactRouter = express.Router();
const sendErrorResponse = require("../utils/sendErrorResponse"); 
const Contact = require("../models/contact");
const { userAuth, adminAuth } = require('../middleware/auth');
const mongoose = require('mongoose'); // For ObjectId validation
const validator = require('validator'); // For email validation if needed in routes (already in model)


/**
 * @route POST /api/contacts
 * @description Creates a new contact entry in the database.
 * @access Private (Authenticated User) - Can be public for actual contact forms, but requested as private.
 * @middleware userAuth
 * @body {object} - Contains contact details: `name` (string), `email` (string), `phone` (string, optional), `message` (string).
 */
contactRouter.post('/api/contacts', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        if (!name || !email || !message) {
            return sendErrorResponse(res, 400, "Missing required contact fields: name, email, message.");
        }

        // Additional validation for email format if not already strictly handled by model
        if (!validator.isEmail(email)) {
            return sendErrorResponse(res, 400, "Invalid email address format.");
        }

        const newContact = new Contact({
            name,
            email,
            phone,
            message
        });

        await newContact.save();

        res.status(201).json({
            message: "Contact message sent successfully",
            success: true,
            data: newContact
        });

    } catch (err) {
        if (err.code === 11000) { // Duplicate key error (e.g., email unique)
            return sendErrorResponse(res, 409, 'A contact with this email already exists.', err);
        }
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            return sendErrorResponse(res, 400, `Contact validation failed: ${errors.join(', ')}`, err);
        }
        sendErrorResponse(res, 500, "Failed to send contact message due to an internal server error.", err);
    }
});

/**
 * @route GET /api/contacts
 * @description Retrieves a list of contact messages. Requires admin privileges to view all.
 * Allows searching by `name`, `email`, `phone`, or `message` via `search` query parameter.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth
 * @query search {string} - Optional. A search term to filter contacts by name, email, phone, or message.
 */
contactRouter.get('/api/contacts', userAuth, adminAuth, async (req, res) => {
    try {
        const { search } = req.query;
        let queryFilter = {};

        if (search) {
            const searchRegex = { $regex: search, $options: 'i' }; // Case-insensitive regex
            queryFilter.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { message: searchRegex }
            ];
        }

        const contacts = await Contact.find(queryFilter).select('-_id -__v');

        let message = "Contacts retrieved successfully";
        if (search) {
            message = `Contacts retrieved successfully matching search '${search}'`;
        }

        if (contacts.length === 0) {
            return sendErrorResponse(res, 404, `No contacts found matching the criteria.`);
        }

        res.status(200).json({
            message: message,
            success: true,
            data: contacts
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to retrieve contacts.", err);
    }
});

/**
 * @route DELETE /api/contacts/:id
 * @description Deletes a contact message by its MongoDB ID.
 * @access Private (Admin Only)
 * @middleware userAuth, adminAuth
 * @param {string} id - The MongoDB _id of the contact message to delete.
 */
contactRouter.delete('/api/contacts/:id', userAuth, adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, 'Invalid contact ID format.');
        }

        const deletedContact = await Contact.findByIdAndDelete(id);

        if (!deletedContact) {
            return sendErrorResponse(res, 404, `Contact with ID '${id}' not found.`);
        }

        res.status(200).json({
            message: "Contact deleted successfully",
            success: true,
            data: deletedContact
        });
    } catch (err) {
        sendErrorResponse(res, 500, "Failed to delete contact.", err);
    }
});

module.exports = contactRouter;
