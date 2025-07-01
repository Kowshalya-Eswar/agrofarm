// Import the 'jsonwebtoken' library for verifying JSON Web Tokens (JWTs).
const jwt = require("jsonwebtoken");
// Import the Mongoose User model to interact with user data in the database.
const User = require("../models/user");

/**
 * @middleware userAuth
 * @description Authenticates a user by verifying their JWT from cookies.
 * If successful, it attaches the user document to `req.user`.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function in the stack.
 */
const userAuth = async(req,res,next) => {
    try {
        // Read the authentication token from the request's cookies.
        const { token } = req.cookies;
        // If no token is found in the cookies, throw an error indicating the user is not found/authenticated.
        if (!token) {
            res.status(200).json({
                status: false,
                message: "user not logged in"
            })
        }
        // Verify the token using the secret key from environment variables (process.env.TOKEN_KEY).
        // If the token is valid, it returns the decoded payload.
        const decodedToken = await jwt.verify(token, process.env.TOKEN_KEY);
        // Extract the user's ID (_id) from the decoded token.
        const {_id} = decodedToken;
        // Find the user in the database using the decoded ID.
        const user = await User.findById(_id);
        // If no user is found for the given ID (e.g., user deleted after token issued), throw an error.
        if (!user) {
            res.status(401).json({
                status: false,
                message: "user not found"
            })
        }

        // Attach the found user document to the request object.
        // This makes user information available to subsequent middleware and route handlers.
        req.user = user;
        // Call the next middleware function in the stack.
        next();
    } catch(err) {
        // If any error occurs during authentication (e.g., invalid token, token expired),
        // send a 400 Bad Request response with the error message.
        //res.status(400).send("ERROR:"+err.message)
    }
}

/**
 * @middleware adminAuth
 * @description Authorizes a user, ensuring they have 'admin' privileges.
 * This middleware should typically be used *after* `userAuth`.
 * @param {object} req - The Express request object (expected to have `req.user` populated by `userAuth`).
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function in the stack.
 */
const adminAuth = async(req,res,next) =>{
    // Check if the authenticated user's roles array includes 'admin'.
    // `req.user` is populated by the `userAuth` middleware.
    if (!req.user.role.includes('admin')) {
        // If the user does not have 'admin' role, send a 400 Bad Request response
        // indicating insufficient privileges.
        res.status(400).send("ERROR: user has no privilages to this operation")
    } else {
        // If the user has 'admin' role, call the next middleware function.
        next();
    }
}

// Export both userAuth and adminAuth middleware functions to be used in Express routes.
module.exports = {userAuth, adminAuth}
