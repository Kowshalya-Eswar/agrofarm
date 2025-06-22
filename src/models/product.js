
const mongoose = require("mongoose");
const productImageRouter = require("../routes/productImage");

productSchema = mongoose.Schema({
    productname: {
        type: String,     
        required: true,   
        trim: true,       
        unique: true,     
    },
    description: {
        type: String      
    },
    price: {
        type: Number,     
        required: true,    
        validate(value) { // Custom validation function for the price.
            if (value < 0) { // Checks if the price is a negative number.
                throw new Error('Product should have price'); // Throws an error if price is negative.
            }
        }
    },
    stock: {
        type: Number,
        required: true
    },
    unit: {
        type: String ,
        enum : {
            values: ['kg', 'single'],
            message: '{VALUE} not supported'
        }
    },
    sku: {
        type: String,     
        trim: true,       
        unique: true                                
    }
}, {
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
productSchema.virtual('images', {
  ref: 'ProductImage',
  localField: 'sku',
  foreignField: 'sku', // this matches in ProductImage
  justOne: false,
});

productSchema.set('toObject', { virtuals: true });
productSchema.set('toJSON', { virtuals: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;

