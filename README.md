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

Admins can retrieve all orders (with populated user data).

Users can retrieve their own specific orders, while admins can retrieve any order.

Admin functionality: Update order status.

Payment Management:

Record multiple payments for a single order.

Payment status (completed, partially paid) determined by total amount paid against order total.

Retrieve payments (admin can see all, regular users see their own; filter by orderId or transactionId).

Admin functionality: Update payment status.

Shipment Management:

Admin functionality: Create new shipment records.

Retrieve shipment records (admin can see all, regular users see their own orders' shipments; filter by orderId or trackingNumber).

Retrieve a single shipment by tracking number (user/admin).

Admin functionality: Update shipment status and add new route checkpoints to tracking history.

Contact Management:

Users can submit contact messages.

Admin functionality: Retrieve all contact messages (with search across name, email, phone, message).

Admin functionality: Delete contact messages.

Authentication & Authorization: Secure routes using JWT (JSON Web Tokens) with distinct roles (user, admin).

Centralized Error Handling: Consistent JSON error responses.

🚀 Technologies Used
Node.js: JavaScript runtime environment.

Express.js: Web application framework for Node.js.

MongoDB: NoSQL database.

Mongoose: MongoDB object data modeling (ODM) library for Node.js.

dotenv: For loading environment variables from a .env file.

jsonwebtoken: For implementing JWT-based authentication.

bcryptjs: (Assumed for password hashing, though not explicitly in provided code snippets).

cookie-parser: Middleware to parse cookies.

validator: For string validation and sanitization.

Multer: Middleware for handling multipart/form-data, primarily used for file uploads (e.g., images) to the server.

UUID: Generates universally unique identifiers (UUIDs) for distinct entities like users or orders.

express-rate-limit: Express.js middleware to limit the rate of requests from specific IP addresses, preventing abuse and ensuring fair usage.

AWS SDK (Amazon SES): Integrates with Amazon SES to send various types of transactional and notification emails from the application.

razorpay : used to integrate RazorPay payment gateway to process the payment when user proceeds to checkout

⚙️ Setup Instructions
Prerequisites
Node.js (LTS version recommended)

MongoDB (Community Server recommended)

Installation
Clone the repository:

git clone <repository-url>
cd <project-directory>

Install dependencies:

npm install

Environment Variables
Create a .env file in the root of your project and add the following environment variables:

PORT=7777
DATABASE_URL=mongodb://localhost:27017/your_database_name
TOKEN_KEY=your_super_secret_jwt_key

PORT: The port your Express server will run on.

DATABASE_URL: Your MongoDB connection string.

TOKEN_KEY: A strong, secret key for signing and verifying JWTs.

AWS_ACCESS_KEY_ID: Your AWS access key ID, used by the AWS SDK to authenticate with services like SES.

AWS_SECRET_ACCESS_KEY: Your AWS secret access key, used in conjunction with the access key ID for authenticating AWS service requests.

ADMIN_EMAIL: The email address designated to receive notifications (e.g., order confirmations, new user registrations) from the application via SES.

RAZORPAY_KEY_ID : Your Razorpay key id, used for creating and making payments

RAZORPAY_KEY_SECRET = Your Razorpay secret key, used for creating and making payments

RAZORPAY_WEBHOOK_SECRET = Your RazorPay webhook secret used to handle the webhook response

Admin Only

🔒 Authentication & Authorization
JWT (JSON Web Tokens): Used for secure user authentication. Upon successful login, a JWT is issued and stored in an HTTP-only cookie.

userAuth Middleware: Verifies the JWT from incoming requests. If valid, it populates req.user with the authenticated user's details, making them available to subsequent route handlers.

adminAuth Middleware: Used after userAuth. It checks if the authenticated user (req.user) has the admin role, enforcing administrative privileges for specific routes.

🚨 Error Handling
The API uses a consistent error response structure through the sendErrorResponse utility. Errors are returned as JSON objects with success: false, a message field, and an optional error field containing the underlying error message (without sensitive details).