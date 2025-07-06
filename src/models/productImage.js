const mongoose = require("mongoose");
const productImageSchema = mongoose.Schema({
    product_id: {
        type: String,     
        required: true,   
        trim: true,       
        index: true,
        ref: 'Product'
    },
    
    imageUrl: {
        type: String,     
        required: true,   
        trim: true
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
        // If it is, update all other images associated with the same product id
        // to set their 'isMain' flag to false.
        // `this.constructor` refers to the ProductImage model itself.
        // `_id: { $ne: this._id }` ensures the current image itself is not updated.
        await this.constructor.updateMany(
            { product_id: this.product_id, _id: { $ne: this._id } },
            { $set: { isMain: false } }
        );
    }
    next();
});


const ProductImage = mongoose.model("ProductImage", productImageSchema);
module.exports = ProductImage;