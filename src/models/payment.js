const mongoose = require("mongoose");

const paymentSchema = mongoose.Schema({
   userId: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true 
    },
    paymentService_order_id: {
        type: String,
        required: true,
        index: true 
    },
    method: {
        type: String,
        trim: true
    },
    transactionId: {
        type: String,
        unique: true,
        trim: true
    },
    receipt: {
        type: String,
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
