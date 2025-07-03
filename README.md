E-commerce Backend API
This project provides a robust backend API for an e-commerce application, handling core functionalities such as user management, product catalog, order processing, payment recording, shipment tracking, and contact message management. It's built with Node.js, Express.js, and MongoDB (via Mongoose).

✨ Features
User Management:
User registration and login (JWT-based authentication).

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

Filtering: Payments can be efficiently filtered by orderId or transactionId for targeted retrieval.

Shipment Management:
Admin functionality: Create new shipment records.

Retrieve shipment records (admin can see all, regular users see their own orders' shipments; filter by orderId or trackingNumber).

Retrieve a single shipment by tracking number (user/admin).

Admin functionality: Update shipment status and add new route checkpoints to tracking history.

Contact Management:
Users can submit contact messages.

Admin functionality: Retrieve all contact messages (with search across name, email, phone, message).

Admin functionality: Delete contact messages.

Automated Stock & Order Cleanup (Cron Job Feature):
Stock Rollback for Overdue Pending Orders: Automatically identifies orders that have been in a pending status for more than 15 minutes and increases the stock of their associated products.

Stock Rollback for Failed Orders/ Pending Orders: Identifies orders that are in a failed status and increases the stock of their associated products.

Status Update for Failed Orders: For failed orders, their status is updated to failed_stock_rolledback after stock rollback, preserving a record.

Status Update for Pending Orders: For failed orders, their status is updated to pending_stock_rolledback after stock rollback, preserving a record.

Scheduled Automation: Runs automatically every 15 minutes to continuously monitor and process orders.

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

node-cron: For scheduling recurring tasks like the stock and order cleanup.

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