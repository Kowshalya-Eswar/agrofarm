const mongoose = require("mongoose");

// Define the schema for the ProductImage model.
// Each document in the 'productimages' collection will adhere to this structure.
const productImageSchema = mongoose.Schema({
    // productsku field:
    // This acts as a foreign key, linking an image to a specific product.
    productsku: {
        type: String,     // Must be a string.
        required: true,   // Mandatory, an image must belong to a product.
        trim: true,       // Removes leading/trailing whitespace.
        // Adding an index for faster lookups when querying images by product SKU.
        index: true
    },
    // imageUrl field:
    // Stores the URL where the image is hosted.
    imageUrl: {
        type: String,     // Must be a string.
        required: true,   // Mandatory, an image must have a URL.
        trim: true,       // Removes leading/trailing whitespace.
        // Custom validation to ensure the imageUrl is a valid URL format.
       /* validate: {
            validator: function(v) {
                // Basic regex for URL validation (can be more robust if needed).
                return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
            },
            message: props => `${props.value} is not a valid image URL!` // Custom error message.
        }*/
    },
    // isMain field:
    // A boolean flag indicating if this image is the primary (main) image for its product.
    isMain: {
        type: Boolean,    // Must be a boolean.
        default: false    // Defaults to false if not provided.
    }
}, {
    // Schema Options:
    // timestamps: true automatically adds `createdAt` and `updatedAt` fields
    // to track when the image document was created and last updated.
    timestamps: true
});

// Mongoose pre-save hook:
// This middleware runs before a new ProductImage document is saved.
// Its purpose is to ensure that only one image per product SKU can be marked as 'isMain'.
productImageSchema.pre('save', async function(next) {
    // Check if the current image is being set as the main image.
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
    // Call next() to proceed with the actual save operation.
    next();
});

const ProductImage = mongoose.model("ProductImage", productImageSchema);

// Export the ProductImage model so it can be imported and used
// in other parts of the application, such as Express routes.
module.exports = ProductImage;