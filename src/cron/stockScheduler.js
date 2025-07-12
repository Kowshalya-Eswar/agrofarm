const cron = require('node-cron');
const Order  = require("../models/order");
const Product = require("../models/product");
const redis = require("../utils/redisConnect");

// Function to handle stock rollback
async function rollbackStock(order) {
    if (order.items && order.items.length > 0) {
        console.warn(`Attempting to rollback stock for Order ID: ${order.orderId} (Status: ${order.status})`);
        let rollbackSuccess = false;
        for (const item of order.items) {
            try {
                await Product.updateOne({ _id: item.product_id }, { $inc: { stock: item.qty } });
                rollbackSuccess = true;
                console.log(`Rolled back ${item.qty} for product ${item.product_id} (Order ID: ${order.orderId})`);
            } catch (error) {
                rollbackSuccess = false;
                console.error(`Error rolling back stock for product ${item.product_id} (Order ID: ${order.orderId}):`, error);
            }
        }
          if (rollbackSuccess) {
            if (order.status === 'pending') {
                try {
                    // Delete the pending order after successful stock rollback
                    await Order.updateOne({ _id: order._id }, { $set: { status: 'pending_stock_rolledback' } });
                    console.log(`Successfully deleted PENDING Order ID: ${order._id} after stock rollback.`);
                } catch (error) {
                    console.error(`Error deleting PENDING Order ID: ${order._id} after stock rollback:`, error);
                    // Optionally, update status to reflect deletion failure if needed
                }
            } else if (order.status === 'failed') {
                try {
                    // For failed orders, update status instead of deleting
                    await Order.updateOne({ _id: order._id }, { $set: { status: 'failed_stock_rolledback' } });
                    console.log(`Updated FAILED Order ID: ${order._id} to 'failed_stock_rolledback' after stock rollback.`);
                } catch (error) {
                    console.error(`Error updating FAILED Order ID: ${order.orderId} status after stock rollback:`, error);
                }
            } else {
                console.log(`Order ID: ${order.orderId} (Status: ${order.status}) was processed, but not deleted or updated due to its status.`);
            }
        } else {
            console.error(`Stock rollback failed for some items in Order ID: ${order.orderId}. Order not deleted/updated.`);
        }
    }
}

//function restores the items in the redis stock

async function restoreExpiringCartHolds() {
    try {
        const keys = await redis.keys("hold:*");

        if (keys.length === 0) {
            console.log(`[${new Date().toISOString()}] No expiring hold keys found.`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Found ${keys.length} hold keys. Checking for expiry...`);

        const now = Date.now();
        const HOLD_EXPIRY_SECONDS = parseInt(process.env.HOLD_EXPIRY_SECONDS || "900", 10); // default 15 mins

        for (const key of keys) {
            const holdData = await redis.hgetall(key);

            const quantity = parseInt(holdData.quantity, 10);
            const createdAt = parseInt(holdData.createdAt, 10);

            if (!quantity || !createdAt || isNaN(quantity) || isNaN(createdAt)) {
                console.warn(`Skipping invalid hold key: ${key}`);
                continue;
            }

            const age = now - createdAt;

            if (age < HOLD_EXPIRY_SECONDS * 1000) {
                continue; // still valid
            }

            const productId = key.split(":")[1];
            const stockKey = `stock:${productId}`;

            await redis.incrby(stockKey, quantity);
            await redis.del(key);

            console.log(`Restored ${quantity} stock for ${productId} from expired hold: ${key}`);
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error restoring expiring cart holds:`, err);
    }
}


// Schedule the cron job to run every 15 minutes
// Cron syntax: * * 15 * * * *
// Minute: */15 (every 15th minute: 0, 15, 30, 45)
// Hour, Day of Month, Month, Day of Week: * (every)
/*cron.schedule('1/15 * * * *', async () => {
   //console.log(`[${new Date().toISOString()}] Running stock management cron job for pending/failed orders...`);
    //const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    try {
        // Find orders that are:
        // 1. In 'pending' status AND older than 15 minutes OR
        // 2. In 'failed' status
    
      /*  const ordersToProcess = await Order.find({
            $or: [
                {
                    status: 'pending',
                    createdAt: { $lt: fifteenMinutesAgo }
                },
                {
                    status: 'failed'
                }
            ]
        });

        if (ordersToProcess.length > 0) {
            console.log(`Found ${ordersToProcess.length} orders to process (pending > 15m or failed).`);
            for (const order of ordersToProcess) {
                console.log(`Processing Order ID: ${order.orderId}, Current Status: ${order.status}`);
                await rollbackStock(order);
            }
        } else {
            console.log('No pending orders older than 15 minutes or failed orders found.');
        }*/
   /*     // Also restore Redis stock holds (cart logic)
        await restoreExpiringCartHolds();

    } catch (error) {
        console.error('Error in stock management cron job:', error);
    }
});*/