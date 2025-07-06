E-commerce Backend API
This project provides a robust backend API for an e-commerce application, handling core functionalities such as user management, product catalog, order processing, payment recording, shipment tracking, and contact message management. It's built with Node.js, Express.js, and MongoDB (via Mongoose).

✨ Features
User Management:
User registration and login (JWT-based authentication).

A password reset mail will send to user's mail, if they request to change password, by following that link they can reset password

Profile retrieval for authenticated users.

Password reset functionality.

Admin functionalities: Retrieve all users (with pagination, search, sort), retrieve a single user by email, update user details, delete users.

Product Management:
Admin functionalities: Create, update, retrieve (with pagination, search, sort), and delete products.

Order Management:
Authenticated users can create new orders (validates product stock, calculates total, deducts stock).

Users can retrieve their all orders (with populated user data).

Users can retrieve their own specific orders, while admins can retrieve any order.

Admin functionality: Update order status.

Payment Management:
Secure Payment Processing (Razorpay): Integrates Razorpay for securely processing all payment transactions, ensuring a robust and reliable checkout experience.

Record Multiple Payments per Order: Designed to record multiple individual payment transactions that contribute to a single order's total, supporting scenarios like partial payments or split transactions.

Dynamic Payment Status: The payment status (e.g., completed, partially paid, pending) is automatically determined based on the total amount received against the order's grand total.

Retrieve Payments:

Admin Access: Administrators can retrieve all payment records across the system.

User Access: Regular users can retrieve payment records specifically associated with their own orders.

Filtering: Payments can be efficiently filtered by orderId for targeted retrieval.

Shipment Management:
Admin functionality: Create new shipment records.

Retrieve shipment records (admin can see all, regular users see their own orders' shipments; filter by orderId or trackingNumber).

Retrieve a single shipment by tracking number (user/admin).

Admin functionality: Update shipment status and add new route checkpoints to tracking history.

Contact Management:
Users can submit contact messages.

Admin functionality: Retrieve all contact messages (with search across name, email, phone, message).

Admin functionality: Delete contact messages.

Automated Stock & Order Cleanup (Cron Job Feature)
Our system employs a robust cron job to ensure efficient and accurate stock management, particularly for orders in pending or failed states. This automated process works in conjunction with our Redis-based cart hold system, where stock is initially reserved when items are added to a user's cart.

Key Responsibilities of the Cron Job:

Stock Rollback for Pending Orders (Overdue):

The cron job periodically scans for orders that have been in a pending status for longer than 15 minutes.

For such overdue pending orders, it increases the main product stock (stock:<productId>) in Redis for all associated items. This restores the reserved stock back to general availability, as the order has not been finalized within the expected timeframe.

Concurrently, it clears the corresponding Redis cart hold keys (hold:<productId>:<cartId>) for these items, releasing the temporary reservation.

Stock Rollback for Failed Orders:

The cron job identifies orders that are in a failed status.

For these failed orders, it increases the main product stock (stock:<productId>) in Redis for all associated products, returning them to general availability.

Similar to overdue pending orders, it clears the corresponding Redis cart hold keys (hold:<productId>:<cartId>) for these items.

Order Status Update for Cleanup Tracking:

Failed Orders: After successfully rolling back stock for a failed order, the cron job updates the order's status to failed_stock_rolledback. This preserves a historical record and clearly indicates that the stock has been re-integrated into inventory.

Overdue Pending Orders: After successfully rolling back stock for an overdue pending order, the cron job updates the order's status to pending_stock_rolledback. This provides a clear audit trail for pending orders that didn't convert and had their stock returned.

How it integrates with the Cart System:

Initial Stock Reservation (Cart Add): When a user adds an item to their cart via the API, the global stock:<productId> in Redis is immediately decremented, and a hold:<productId>:<cartId> key is created to temporarily reserve that quantity for the specific cart.

Manual Cart Removal: If a user manually removes an item from their cart (before an order is placed), the stock:<productId> is immediately incremented back, and the specific hold:<productId>:<cartId> key is updated or deleted.

Order Success (Hold Clear Only): When an order is successfully placed and processed, the API will only delete the hold:<productId>:<cartId> keys associated with that order's cartId. The actual deduction from the main stock (and permanent commitment) for successful orders is handled by processing logic, which is then reflected correctly in your main database. The cron job then ensures that any unsuccessful reservations (pending/failed) are corrected.

Robust Error Handling: Includes internal try...catch blocks to manage database operation failures and log errors.

Email Notifications (via AWS SES):
Order Confirmation Mail: Users receive an automated order confirmation email upon successful payment for their order.

Registration Confirmation Mail: Users receive a welcome and confirmation email immediately after successful registration

General Features:
Authentication & Authorization: Secure routes using JWT (JSON Web Tokens) with distinct roles (user, admin).

Centralized Error Handling: Consistent JSON error responses.

🚀 Technologies Used
Node.js: JavaScript runtime environment.

Express.js: Web application framework for Node.js.

MongoDB: NoSQL database.

Mongoose: MongoDB object data modeling (ODM) library for Node.js.

dotenv: For loading environment variables from a .env file.

jsonwebtoken: For implementing JWT-based authentication.

bcryptjs: (Assumed) For password hashing.

cookie-parser: Middleware to parse cookies.

validator: For string validation and sanitization.

Multer: Middleware for handling multipart/form-data, primarily used for file uploads (e.g., images).

UUID: Generates universally unique identifiers (UUIDs) for distinct entities like users or orders.

express-rate-limit: Express.js middleware to limit the rate of requests from specific IP addresses.

AWS SDK (Amazon SES): Integrates with Amazon SES to send various types of transactional and notification emails.

Razorpay: Integrated payment gateway to process payments when users proceed to checkout.

node-cron: For scheduling recurring tasks like the stock update.

⚙️ Setup Instructions
Prerequisites
Node.js (LTS version recommended)

MongoDB (Community Server recommended)

Installation
Clone the repository:

Bash

git clone <repository-url>
cd <project-directory>
Install dependencies:

Bash

npm install
Environment Variables
Create a .env file in the root of your project and add the following environment variables:

PORT=7777
DATABASE_URL=mongodb://localhost:27017/your_database_name
TOKEN_KEY=your_super_secret_jwt_key
AWS_ACCESS_KEY_ID=Your_AWS_Access_Key_ID
AWS_SECRET_ACCESS_KEY=Your_AWS_Secret_Access_Key
ADMIN_EMAIL=admin@example.com
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
PORT = The port your Express server will run on.
HOST_IP = Redis server IP address (EC2 public IP)
REDIS_PORT= Redis port (default is 6379)
REDIS_PASSWORD = Redis password (set in redis.conf)

DATABASE_URL: Your MongoDB connection string.

TOKEN_KEY: A strong, secret key for signing and verifying JWTs.

AWS_ACCESS_KEY_ID: Your AWS access key ID, used by the AWS SDK to authenticate with services like SES.

AWS_SECRET_ACCESS_KEY: Your AWS secret access key, used in conjunction with the access key ID for authenticating AWS service requests.

ADMIN_EMAIL: The email address designated to receive notifications from the application via SES.

RAZORPAY_KEY_ID: Your Razorpay key ID, used for creating and making payments.

RAZORPAY_KEY_SECRET: Your Razorpay secret key, used for creating and making payments.

RAZORPAY_WEBHOOK_SECRET: Your Razorpay webhook secret used to handle webhook responses.

🔒 Authentication & Authorization
JWT (JSON Web Tokens): Used for secure user authentication. Upon successful login, a JWT is issued and stored in an HTTP-only cookie.

userAuth Middleware: Verifies the JWT from incoming requests. If valid, it populates req.user with the authenticated user's details, making them available to subsequent route handlers.

adminAuth Middleware: Used after userAuth. It checks if the authenticated user (req.user) has the admin role, enforcing administrative privileges for specific routes.

🚨 Error Handling
The API uses a consistent error response structure through a centralized error handling utility (e.g., sendErrorResponse). Errors are returned as JSON objects with success: false, a message field, and an optional error field containing the underlying error message (without sensitive details).

🔧 Redis Integration
This project uses Redis to manage real-time stock levels for products. When users add or remove items from the cart, stock is adjusted instantly using Redis commands like decrby and incrby.