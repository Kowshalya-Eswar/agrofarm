// This file defines the Mongoose schema for the Order model, outlining its structure,
// data types, validations, and a pre-save hook for handling main image logic.

const mongoose = require("mongoose");

// Define the schema for the Order model.
const orderSchema = mongoose.Schema({
    _id: {
        type: String,
    },
    userId: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    items: [
        {
            _id: false,
            product_id: {
                type: String,
                required: true,
                ref:'Product',
                trim: true,
                index: true
            },
            qty: {
                type: Number,
                required: true,
                min: 1,
                validate: {
                    validator: Number.isInteger,
                    message: '{VALUE} is not an integer quantity.'
                }
            },
            priceAtOrder: {
                type: Number,
                required: true,
                min: 0
            },
            productNameAtOrder: {
                type: String,
                required: true
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    shippingAddress: { 
        street: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        state: {
            type: String,
            required: true,
            trim: true,
        },
        pincode: { 
            type: String, 
            required: true,
            trim: true,
        },
        country: {
            type: String,
            trim: true,
            default: 'India',
        },
        landmark: {
            type:String,
        }
    },
    deliveryDate: {
        type: Date,
    },
    status: {
        type: String,
        enum:{
        values:['pending', 'processing', 'shipped', 'delivered', 'cancelled', "failed"],
        message: '{VALUE} not supported'
        },
        default: 'pending'
    },
}, {
    timestamps: true
});

// Create the Order model from the defined schema.
const Order = mongoose.model("Order", orderSchema);

// Export the Order model.
module.exports = Order;
