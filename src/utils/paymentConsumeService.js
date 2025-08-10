const amqp = require('amqplib');
const Order = require('../models/Order'); 
const sendEmail = require('./sendEmail'); 
let connection, channel;

async function processPaymentStatusUpdated(paymentDetails, paymentStatus) {
    try {
        const order = await Order.findById(paymentDetails.order_id)
        if (paymentStatus == "captured") {
            order.status = "processing";
        } else if (paymentStatus == "payment.failed") {
            order.status = "failed";
        }
        await order.save();
        console.log("order saved");
        if (paymentStatus == "captured") {
            const notes = paymentDetails.notes;
            const userEmail = notes ? notes.email : 'N/A';
            const firstName = notes ? notes.firstName : 'N/A';
            const lastName = notes ? notes.lastName : 'N/A';
            const userName = firstName + " " + lastName
            // Convert orderItemsForDb into HTML table rows
            let itemsHtml = order.items.map(item => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.productNameAtOrder}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.qty}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">₹${item.priceAtOrder.toFixed(2)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">₹${(item.qty * item.priceAtOrder).toFixed(2)}</td>
                </tr>
            `).join('');

            const emailSubject = `Order Confirmation #${paymentDetails.order_id}`; // Use order ID in subject
            const emailHtmlBody = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; }
                        .header { background-color: #f8f8f8; padding: 15px; text-align: center; border-bottom: 1px solid #eee; }
                        .header h1 { margin: 0; color: #4CAF50; }
                        .content { padding: 20px 0; }
                        .table-container { overflow-x: auto; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #777; font-size: 0.9em; }
                        .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Order Confirmed - Cocofields</h1>
                        </div>
                        <div class="content">
                            <p>Hello ${userName},</p>
                            <p>Thank you for your order with Cocofields! Your order #${paymentDetails.order_id} has been successfully placed and is being processed.</p>
                            <p><strong>Order Summary:</strong></p>
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Product Name</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${itemsHtml}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="3" style="text-align: right; font-weight: bold;">Grand Total:</td>
                                            <td style="font-weight: bold;">₹${order.totalAmount.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p><strong>Shipping Address:</strong></p>
                            <ul style ="list-style-type: none; padding-left: 0; margin: 0;">
                            <li>${order.shippingAddress.street} </li>
                            <li>${order.shippingAddress.city} </li>
                            <li>${order.shippingAddress.state} </li>
                            <li>${order.shippingAddress.pincode} </li>
                            <li>${order.shippingAddress.country} </li>
                            </ul>
                            <p>We will notify you once your order has been shipped.</p>
                            <p>If you have any questions or require any changes to your order, please do not hesitate to contact us at <a href="mailto:support@cocofields.in">support@cocofields.in</a>.</p>
                            <p>Thank you for choosing Cocofields!</p>
                            <p style="text-align: center;">
                                <a href="https://www.cocofields.in/orders-history" class="button">Check Orders</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} Cocofields. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            mailStatus = await sendEmail.run(emailSubject, emailHtmlBody, userEmail);
            console.log("mailsent");
        }
    } catch(err) {
        console.log(err);
    }
}

async function startConsumer() {
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();

  const exchange = 'payment_events';
  await channel.assertExchange(exchange, 'fanout', { durable: true });

  // Create a unique, exclusive queue for this consumer
  const q = await channel.assertQueue('', { exclusive: true });

  // Bind queue to the fanout exchange (routingKey ignored)
  await channel.bindQueue(q.queue, exchange, '');

  console.log("Waiting for messages in queue:", q.queue);

  channel.consume(q.queue, async (msg) => {
    if (msg !== null) {
        const content = msg.content.toString();
        const data = JSON.parse(content); // Parses JSON string to JS object
        await processPaymentStatusUpdated(data.paymentDetails, data.paymentStatus)
        channel.ack(msg);
    }
  }, { noAck: false });
}

async function connectWithRetry() {
  const RETRY_INTERVAL = 5000;
  while (true) {
    try {
      await startConsumer();
      break; // Connected successfully, exit loop
    } catch (err) {
      console.error('RabbitMQ connect failed, retrying in 5s...', err);
      await new Promise(res => setTimeout(res, RETRY_INTERVAL));
    }
  }
}
connectWithRetry();

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  try {
    await channel.close();
    await connection.close();
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
});

