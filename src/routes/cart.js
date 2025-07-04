const express = require("express");
const sendErrorResponse = require("../utils/sendErrorResponse");
const redis = require("../utils/redisConnect");
const { userAuth } = require("../middleware/auth");

const cartRouter = express.Router();

const getStockKey = (productId) => `stock:${productId}`;

//Add item to cart
cartRouter.post("/api/cart/add", async (req, res) => {
    const { productId, quantity } = req.body;
    const stockKey = getStockKey(productId);
    
    try {
        const stock = await redis.get(stockKey);
        const currentStock = parseInt(stock || 0, 10);
        if (currentStock < quantity) {
            return sendErrorResponse(res, 400, "Not enough stock available");
        }

        await redis.decrby(stockKey, quantity);
        res.json({ message: "Item added to cart", status: true });
    } catch (err) {
        console.log(err);
        sendErrorResponse(res, 500, "Failed to add cart", err);
    }
});

// ➖ Remove item from cart
cartRouter.post("/api/cart/remove", async (req, res) => {
    const { productId, quantity } = req.body;
    const stockKey = getStockKey(productId);

    try {
        const restoreQty = parseInt(quantity || 0, 10);
        if (restoreQty <= 0) {
            return sendErrorResponse(res, 400, "Invalid quantity to restore");
        }

        await redis.incrby(stockKey, restoreQty);
        res.json({ message: "Item removed from cart", status: true });
    } catch (err) {
        console.error(err);
        sendErrorResponse(res, 500, "Failed to remove from cart", err);
    }
});

// 🧾 Set initial stock
cartRouter.post("/api/stock/set", userAuth, async (req, res) => {
    const { productId, stock } = req.body;
    const stockKey = getStockKey(productId);

    try {
        await redis.set(stockKey, stock);
        res.json({ message: "Stock initialized", status: true });
    } catch (err) {
        console.error(err);
        sendErrorResponse(res, 500, "Failed to set stock", err);
    }
});

// If cart get cleared completely
cartRouter.post('/api/cart/restore-stock', async (req, res) => {
  const { items } = req.body;
  try {
    for (const item of items) {
      const stockKey = `stock:${item.productId}`;
      await redis.incrby(stockKey, item.quantity);
    }

    res.json({ status: true, message: "Stock restored" });
  } catch (err) {
    console.error("Failed to restore stock", err);
    res.status(500).json({ status: false, message: "Stock restore failed" });
  }
});


// Check current stock for a product
cartRouter.get('/api/stock/:productId', async (req, res) => {
  const { productId } = req.params;
  const stockKey = `stock:${productId}`;

  try {
    const stock = await redis.get(stockKey);
    const currentStock = parseInt(stock, 10) || 0;

    res.json({
      productId,
      stock: currentStock,
      status: true,
    });
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, 500, "Failed to fetch stock", err);
  }
});


module.exports = cartRouter;
