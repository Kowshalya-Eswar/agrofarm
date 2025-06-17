// Import the Mongoose library, which provides a straightforward, schema-based solution
// to model your application data for MongoDB.
const mongoose = require("mongoose");
const productImageRouter = require("../routes/productImage");

// Define the schema for the Product model.
// A Mongoose schema defines the structure of the documents within a MongoDB collection,
// enforcing validation, casting, and other operations.
productSchema = mongoose.Schema({
    // productName field:
    productname: {
        type: String,     // Specifies that the productname must be a string.
        required: true,   // Marks this field as mandatory; a product cannot be saved without a name.
        trim: true,       // Removes whitespace from both ends of the string before saving.
        unique: true,     // Ensures that each productname in the database must be unique.
                          // Mongoose will create a unique index for this field.
    },
    // description field:
    description: {
        type: String      // Specifies that the description must be a string.
    },
    // price field:
    price: {
        type: Number,     // Specifies that the price must be a number.
        reuired: true,    // Marks this field as mandatory. (Note: there's a typo here, it should be 'required')
        validate(value) { // Custom validation function for the price.
            if (value < 0) { // Checks if the price is a negative number.
                throw new Error('Product should have price'); // Throws an error if price is negative.
            }
        }
    },
    // stock field:
    stock: {
        type: Number,
        required: true
    },
    // unit field:
    unit: {
        type: String ,
        enum : {
            values: ['kg', 'number'],
            message: '{VALUE} not supported'
        }
    },
    // sku (Stock Keeping Unit) field:
    sku: {
        type: String,     // Specifies that the SKU must be a string.
        trim: true,       // Removes whitespace from both ends of the string.
        unique: true      // Ensures that each SKU in the database must be unique.
                          // This is critical for uniquely identifying products.
    }
}, {
    // Schema Options:
    // timestamps: true automatically adds `createdAt` and `updatedAt` fields to your schema.
    // `createdAt` stores the date when the document was first created.
    // `updatedAt` stores the date when the document was last updated.
    timestamps: true
});

function generateRandomSKU(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

productSchema.pre('save', function(next) {
    try {
        if (this.isNew) {
            this.sku = 'prod-'+generateRandomSKU(10);
            console.log(this.sku);
        }
    } catch(err) {
        console.log(err.message);
    }
    next();

})

// Create the Product model from the defined schema.
// 'Product' is the name of the model, which Mongoose will use to create
// a 'products' collection in your MongoDB database (pluralized lowercase).
const Product = mongoose.model("Product", productSchema);

// Export the Product model so it can be imported and used in other parts of your application,
// such as Express routes or other data handling files.
module.exports = Product;

