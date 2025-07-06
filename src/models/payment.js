const mongoose = require("mongoose");

const paymentSchema = mongoose.Schema({
   userId: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    orderId: {
        type: String,
        required: true,
        index: true,
        ref: 'Order'
    },
    method: {
        type: String,
        trim: true
    },
    transactionId: {
        type: String,
        trim: true
    },
    notes: {
        type:Object,
    },
    receipt: {
        type: String,
        unique: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['created', 'captured', 'failed'],
        default: 'created',
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
