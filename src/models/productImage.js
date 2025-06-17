const mongoose = require("mongoose");

const productImageSchema = mongoose.Schema({
    productsku: {
        type: String,     
        required: true,   
        trim: true,       
        index: true
    },
    
    imageUrl: {
        type: String,     
        required: true,   
        trim: true,       
        validate: {
            validator: function(v) {
                return validator.isURL(v); // Use validator.isURL()
            },
            message: props => `${props.value} is not a valid image URL!` // Custom error message
        }
        // Custom validation to ensure the imageUrl is a valid URL format.
       /* validate: {
            validator: function(v) {
                // Basic regex for URL validation (can be more robust if needed).
                return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
            },
            message: props => `${props.value} is not a valid image URL!` // Custom error message.
        }*/
    },
    isMain: {
        type: Boolean,    // Must be a boolean.
        default: false    // Defaults to false if not provided.
    }
}, {
    timestamps: true
});


productImageSchema.pre('save', async function(next) {
    if (this.isMain) {
        // If it is, update all other images associated with the same product SKU
        // to set their 'isMain' flag to false.
        // `this.constructor` refers to the ProductImage model itself.
        // `_id: { $ne: this._id }` ensures the current image itself is not updated.
        await this.constructor.updateMany(
            { productsku: this.productsku, _id: { $ne: this._id } },
            { $set: { isMain: false } }
        );
    }
    next();
});

const ProductImage = mongoose.model("ProductImage", productImageSchema);
module.exports = ProductImage;