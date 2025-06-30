const sendErrorResponse = require("../utils/sendErrorResponse");
const Payment = require("../models/payment");
const razorpayInstance = require("../utils/razorpay");
const createPayment = async(userId, amount, firstName, lastName) =>{
    try {
            amount = amount * 100;
            if (!userId || amount === undefined || amount < 0) {
                return sendErrorResponse(res, 400, "Missing required payment fields: userId, amount.");
            }
            const receipt_no = "receipt_"+Math.random().toString(36).substring(2, 10);
            const orderfromRazor = await razorpayInstance.orders.create({
                "amount":amount,
                "currency":"INR",
                "receipt":receipt_no,
                "partial_payment":false,
                "notes": {
                    firstName,
                    lastName
                }
            })
        
            const {id:orderId, amount:amountPaid, receipt, status, notes} = orderfromRazor;

            /*const existingPayments = await Payment.find({orderId:orderId}).select('amountPaid');
            var totalPaid        = existingPayments.reduce((sum, payment) =>{
            return sum+payment.amountPaid;
            },0);
            totalPaid += amountPaid;
            let status = 'completed';
            if (order.totalAmount >= totalPaid) {
                status = 'partially paid'
            }*/
            const newPayment = new Payment({
                orderId,
                receipt,
                amountPaid,
                userId,
                status,
                notes
            });
            await newPayment.save();

            return({
                message: "payment created successfully",
                success: true,
                data: newPayment
            });

    } catch (err) {
       return({
          err: err,
          success: false
       })
    }
};

module.exports = createPayment