const mongoose = require("mongoose");

const shipmentSchema = mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        unique: true, // Assuming one main shipment record per order
        index: true
    },
    carrier: {
        type: String,
        required: true,
        trim: true
    },
    trackingNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'shipped', 'in transit', 'delivered', 'failed', 'returned'],
        default: 'pending',
        required: true
    },
    origin: {
        type: String,
        required: true,
        trim: true
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    routes: [ // Array to store routing information/checkpoints
        {
            location: {
                type: String,
                trim: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            description: {
                type: String,
                trim: true
            },
            _id: false // Exclude _id for subdocuments
        }
    ]
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

const Shipment = mongoose.model("Shipment", shipmentSchema);

module.exports = Shipment;