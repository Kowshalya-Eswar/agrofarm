const mongoose = require("mongoose");
const validator = require("validator"); // For email validation

const contactSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(value) {
                return validator.isEmail(value);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    phone: {
        type: String,
        trim: true,
        // Optional: Add more specific phone number validation if needed
    },
    message: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

const Contact = mongoose.model("Contact", contactSchema);

module.exports = Contact;
