const amqp = require('amqplib');

const requestQueue = 'payment_request_queue';

async function sendPaymentRequest(order) {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(requestQueue, { durable: false });
        const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });

        const correlationId = generateUuid();

        return new Promise((resolve, reject) => {
            let timeoutId;

            channel.consume(replyQueue, msg => {
            if (msg.properties.correlationId === correlationId) {
                try {
                const response = JSON.parse(msg.content.toString());
                clearTimeout(timeoutId);
                resolve(response);
                } catch (parseError) {
                reject(parseError);
                } finally {
                // Clean up connections safely
                setTimeout(async () => {
                    try {
                    await channel.close();
                    await connection.close();
                    } catch {}
                }, 100);
                }
            }
            }, { noAck: true }).catch(err => {
            reject(err);
            });

            channel.sendToQueue(requestQueue,
            Buffer.from(JSON.stringify(order)),
            {
                correlationId,
                replyTo: replyQueue
            });

            // Timeout if no response within 15s
            timeoutId = setTimeout(() => {
            reject(new Error('Payment response timeout'));
            setTimeout(async () => {
                try {
                await channel.close();
                await connection.close();
                } catch {}
            }, 100);
            }, 15000);
        });
    } catch(err) {
        console.log(err.message);
    }
}


function generateUuid() {
    return Math.random().toString() + Math.random().toString() + Date.now();
}

module.exports = sendPaymentRequest;
