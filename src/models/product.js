
const mongoose = require("mongoose");
const redis = require('../utils/redisConnect');
const getStockKey = (productId) => `stock:${productId}`;
const ProductImage = require("../models/productImage");
productSchema = mongoose.Schema({
    _id: {
        type: String                                
    },
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
            values: ['kg', 'single', 'litre'],
            message: '{VALUE} not supported'
        }
    },
  
}, {
    timestamps: true
});

function generateRandomProductId(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

productSchema.pre('save', async function (next) {
  try {
    if (this.isNew) {
      this._id = 'prod-' + generateRandomProductId(10);
      await redis.set(getStockKey(this._id), this.stock);
    }
    next();
  } catch (err) {
    console.error('Error in pre-save:', err);
    next(err); // pass error to Mongoose
  }
});

productSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      await redis.del(getStockKey(doc._id));
      await ProductImage.deleteMany({ product_id: this._id });
    } catch (err) {
      console.error('delete failed:', err);
    }
  }
});

/*
// After stock is updated via findOneAndUpdate
productSchema.post('findOneAndUpdate', async function (doc) {
  try {
    if (!doc) return;

    // Get update object
    const update = this.getUpdate();
    const stock = update?.stock ?? update?.$set?.stock;

    if (stock !== undefined) {
      await redis.set(getStockKey(doc._id), stock);
    }
  } catch (err) {
    console.error('Failed to update Redis stock in findOneAndUpdate:', err);
  }
});
productSchema.post('updateOne', async function () {
  try {
    const query = this.getQuery();      
    const update = this.getUpdate();   

    // You need to find the updated document manually
    const product = await this.model.findOne(query);
    if (product && typeof product.stock === 'number') {
      await redis.set(`stock:${product._id}`, product.stock);
    }
  } catch (err) {
    console.error('Failed to update Redis stock in updateOne:', err);
  }
});
*/
productSchema.virtual('images', {
  ref: 'ProductImage',
  localField: '_id',
  foreignField: 'product_id', // this matches in ProductImage
  justOne: false,
});

productSchema.set('toObject', { virtuals: true });
productSchema.set('toJSON', { virtuals: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;

