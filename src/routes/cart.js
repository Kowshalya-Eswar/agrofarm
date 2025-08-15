const express = require("express");
const sendErrorResponse = require("../utils/sendErrorResponse");
const redis = require("../utils/redisConnect");
const { userAuth } = require("../middleware/auth");

const cartRouter = express.Router();

const getStockKey = (productId) => `stock:${productId}`;

//Add item to cart
cartRouter.post("/api/cart/add", async (req, res) => {
    const { productId, quantity, cartId } = req.body;
    const stockKey = getStockKey(productId);
    const holdKey = `hold:${productId}:${cartId}`;
    try {
        const stock = await redis.get(stockKey);
        const currentStock = parseInt(stock || 0, 10);

        const currentHoldQuantityStr = await redis.hget(holdKey, 'quantity');
        const currentHoldQuantity = parseInt(currentHoldQuantityStr || 0, 10);

        const newTotalHoldQuantity = currentHoldQuantity + quantity;

        if (currentStock < newTotalHoldQuantity) {
            return sendErrorResponse(res, 400, "Not enough stock available");
        }

        await redis.decrby(stockKey, quantity);
        await redis.hset(holdKey, {
          quantity,
          createdAt: Date.now()
        });

        res.json({ message: "Item added to cart", status: true });
    } catch (err) {
        //console.log(err);
        sendErrorResponse(res, 500, "Failed to add cart", err);
    }
});

//  Remove item from cart
cartRouter.post("/api/cart/remove", async (req, res) => {
    const { productId, quantity, cartId } = req.body;

    const stockKey = getStockKey(productId);
    const holdKey = `hold:${productId}:${cartId}`;

    try {
        const restoreQty = parseInt(quantity, 10);
        if (isNaN(restoreQty) || restoreQty <= 0) {
            return sendErrorResponse(res, 400, "Invalid quantity to restore");
        }
        const currentHoldQuantityStr = await redis.hget(holdKey, 'quantity');
        const currentHoldQuantity = parseInt(currentHoldQuantityStr || 0, 10);

        if(restoreQty > currentHoldQuantity) {
           return sendErrorResponse(res, 400, "Cannot restore more stock than held in the cart");
        }
        // Increment stock back
        await redis.incrby(stockKey, restoreQty);

        if(restoreQty < currentHoldQuantity) {
           await redis.hincrby(holdKey, 'quantity', -restoreQty);
           return res.json({ message: "Item removed from cart and stock restored", status: true });
        }
        // Delete the hold hash (if it exists)
        const exists = await redis.exists(holdKey);
        if (exists) {
            await redis.del(holdKey);
        }

        res.json({ message: "Item removed from cart and stock restored", status: true });
    } catch (err) {
        //console.error("Error removing item from cart:", err);
        sendErrorResponse(res, 500, "Failed to remove from cart", err);
    }
});

//clear all hold keys once the order processed
cartRouter.post("/api/cart/clear-all-items", async (req, res) => {
    const { cartId } = req.body;

    if (!cartId) {
        return sendErrorResponse(res, 400, "Invalid request: cartId is required.");
    }

    try {
        let cursor = '0';
        let keysToDelete = [];
        const pattern = `hold:*:${cartId}`; // Matches "hold:<productId>:<cartId>"

        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            keysToDelete = keysToDelete.concat(keys);
            cursor = nextCursor;
        } while (cursor !== '0');

        if (keysToDelete.length > 0) {
            // Use UNLINK for asynchronous deletion (non-blocking) which is good for many keys.
            // If UNLINK is not available or you prefer DEL, you can use multi.del().
            await redis.unlink(keysToDelete); // UNLINK is generally preferred for deleting many keys at once

            res.json({
                message: `Cart ${cartId} holds cleared. ${keysToDelete.length} items' holds deleted (no stock restoration).`,
                status: true,
                removedHoldCount: keysToDelete.length // Renamed for clarity
            });
        } else {
            res.json({
                message: `No active holds found for cart ${cartId} to clear.`,
                status: true,
                removedHoldCount: 0
            });
        }

    } catch (err) {
        //console.error("Error clearing cart holds after order:", err);
        sendErrorResponse(res, 500, "Failed to clear cart holds", err);
    }
});

// Set initial stock
cartRouter.post("/api/stock/set", userAuth, async (req, res) => {
    const { productId, stock } = req.body;
    const stockKey = getStockKey(productId);

    try {
        await redis.set(stockKey, stock);
        res.json({ message: "Stock initialized", status: true });
    } catch (err) {
        //console.error(err);
        sendErrorResponse(res, 500, "Failed to set stock", err);
    }
});

// If cart get cleared completely
cartRouter.post('/api/cart/restore-stock', async (req, res) => {
  const { items, cartId } = req.body;

  if (!cartId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ status: false, message: "Invalid request" });
  }

  try {
    for (const item of items) {
      const holdKey = `hold:${item.productId}:${cartId}`;
      const stockKey = `stock:${item.productId}`;
  
      // Fetch held quantity from Redis hash
      //const quantityStr = await redis.hget(holdKey, "quantity");
      const qty = parseInt(item.quantity || "0", 10);

      if (qty > 0) {
        await redis.incrby(stockKey, qty);
        await redis.del(holdKey);

        //console.log(`Restored ${qty} units for product ${item.productId} from cart ${cartId}`);
      } else {
        //console.warn(`No valid hold quantity for product ${item.productId} and cart ${cartId}`);
      }
    }

    res.json({ status: true, message: "Stock restored from cart" });
  } catch (err) {
    //console.error("Failed to restore stock:", err);
    res.status(500).json({ status: false, message: "Stock restore failed", error: err.message });
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
    //console.error(err);
    sendErrorResponse(res, 500, "Failed to fetch stock", err);
  }
});


module.exports = cartRouter;
