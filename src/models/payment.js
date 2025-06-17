const mongoose = require("mongoose");

const paymentSchema = mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true // Keep index for efficient lookup
    },
    method: {
        type: String,
        required: true,
        trim: true
    },
    transactionId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'authorized','partially paid'],
        default: 'pending',
        required: true
    },
    amountPaid: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
