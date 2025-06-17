// Import the Express library to create and manage the router instances.
const express = require("express")
// Create a new router instance specifically for user-related routes.
const userRouter = express.Router();
// Import a utility function for sending consistent error responses.
const sendErrorErrorResponse = require("../utils/sendErrorResponse");
// Import the 'validator' library for data validation (e.g., email format).
const validator = require("validator");
// Import the Mongoose User model, which interacts with the 'users' collection in MongoDB.
const User = require("../models/user.js");
// Import a custom utility function for validating user registration data.
const ValidateRegisterData = require('../utils/validate');
// Import authentication middleware for user and admin roles to protect routes.
const {userAuth, adminAuth} = require('../middleware/auth');

/**
 * @route POST /api/user/register
 * @description Handles user registration, creating a new user in the database.
 * @access Public (though a `userAuth` middleware is typically used for protected routes, it's not here for registration).
 * @body {object} - Contains user details: firstName, lastName, email, userName, age, password, phone, gender.
 */
userRouter.post("/api/user/register", async (req,res)=> {
    try {
        // Validate incoming registration data using a custom utility function.
        // This function is expected to throw an error if validation fails.
        ValidateRegisterData(req);
        // Destructure user details from the request body.
        const {firstName, lastName, email, userName, age, password, phone, gender, uuid} = req.body;
        // Create a new User document instance with the received data.
        user  = new User({
            firstName, lastName, email, userName, password, age, phone, gender, uuid
        });
        // Save the new user document to the database. This will trigger Mongoose schema validations.
        await user.save();
        // Send a success response if the user is added successfully.
        res.status(200).json({
            message: "user added successfully",
            success: true
        });
    } catch(err) {
        // If an error occurs (e.g., validation failure, database error), send an error response.
        return sendErrorErrorResponse(res, 400, 'failed to add user',err )
    }
})

/**
 * @route GET /api/users
 * @description Retrieves a list of users with optional pagination, filtering, and sorting.
 * @access Private (Admin Only) - Requires user authentication and admin privileges.
 * @middleware userAuth, adminAuth - Ensures only authenticated administrators can access this route.
 * @query page {number} - The page number for pagination (default: 1).
 * @query limit {number} - The number of items per page (default: 10, maximum: 100).
 * @query search {string} - A search term to filter users by username or email (case-insensitive).
 * @query sortBy {string} - The field to sort the results by (e.g., 'username', 'createdAt').
 * @query order {string} - The sort order, 'asc' for ascending or 'desc' for descending (default: 'desc').
 */
userRouter.get("/api/users", userAuth, adminAuth, async (req,res)=> {
    try {
        // Destructure query parameters, providing default values for pagination and sorting.
        const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        // Parse page and limit to integers.
        const pageNum = parseInt(page);
        // Ensure limit does not exceed a maximum of 100 items per page for performance.
        const limitNum = Math.min(parseInt(limit),100);

        // Validate page number: must be a positive integer.
        if (isNaN(pageNum) || pageNum < 1) {
            return sendErrorErrorResponse(res, 400, 'Invalid page number. Must be a positive integer.');
        }
        // Validate limit number: must be a positive integer.
        if (isNaN(limitNum) || limitNum < 1) {
            return sendErrorErrorResponse(res, 400, 'Invalid limit. Must be a positive integer.');
        }

        // Initialize an empty query filter object.
        const queryFilter = {};
        // If a search term is provided, build a case-insensitive regex query for 'username' or 'email'.
        if (search) {
            queryFilter.$or = [
                { username: { $regex: search, $options: 'i' } }, // Case-insensitive regex for username
                { email: { $regex: search, $options: 'i' } }     // Case-insensitive regex for email
            ];
        }
        // Calculate the number of documents to skip for pagination based on current page and limit.
        const skip = (pageNum - 1) * limitNum;
        // Initialize an empty object for sort options.
        const sortOptions = {};
        // Define a list of valid fields that can be used for sorting.
        const validSortFields = ['username', 'email', 'createdAt', 'updatedAt'];
        // Apply sorting if the provided 'sortBy' field is valid.
        if (validSortFields.includes(sortBy)) {
            // Set sort order based on 'order' query parameter (-1 for 'desc', 1 for 'asc').
            sortOptions[sortBy] = (order === 'desc' ? -1 : 1);
        } else {
            // If an invalid 'sortBy' field is provided, default to sorting by 'createdAt' in descending order.
            sortOptions['createdAt'] = -1;
            console.warn(`Invalid sortBy field: ${sortBy}. Defaulting to 'createdAt'.`);
        }
        // Execute the Mongoose query: find documents matching the filter, sort, skip, limit, and exclude the '__v' (version) field.
        const users = await User.find(queryFilter).sort(sortOptions).skip(skip).limit(limitNum).select('-__v'); // Exclude the Mongoose version key
        // Get the total count of documents that match the current filter, for pagination metadata.
        const totalUsers = await User.countDocuments(queryFilter);
        // Calculate the total number of pages required based on total items and items per page.
        const totalPages = Math.ceil(totalUsers / limitNum);
        // Send a success response with the retrieved users data and pagination metadata.
        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: users,
            pagination: {
                totalItems: totalUsers,
                totalPages: totalPages,
                currentPage: pageNum,
                itemsPerPage: limitNum
            }
        });
    } catch(err) {
        // If an error occurs during user retrieval, send an error response.
        return sendErrorErrorResponse(res, 400, 'failed to retrieve user',err )
    }
})

/**
 * @route GET /api/user/:emailId
 * @description Retrieves a single user by their email address.
 * @access Private (Admin Only) - Requires user authentication and admin privileges.
 * @middleware userAuth, adminAuth - Ensures only authenticated administrators can access this route.
 * @param {string} emailId - The email address of the user to retrieve (from URL parameters).
 */
userRouter.get("/api/user/:emailId", userAuth,adminAuth, async(req,res)=> {
    // Extract the emailId from the URL parameters.
    const {emailId} = req.params;
    try{
        // Find a user by their email address and exclude the '__v' field.
        // Note: `User.find()` returns an array, even if only one match. `User.findOne()` might be more appropriate for unique fields.
        user = await User.find({email: emailId}).select('-__v');
        // Send a success response with the retrieved user data.
        res.status(200).json({
            data: user,
            success: true,
            message:"user retrieved successfully"
            }
        )
    } catch(err) {
        // If an error occurs during user retrieval, send an error response.
        return sendErrorErrorResponse(res, 400, 'failed to retrieve user',err )
    }
})

/**
 * @route DELETE /api/user
 * @description Deletes a user by their email address provided in the request body.
 * @access Private (Admin Only) - Requires user authentication and admin privileges.
 * @middleware userAuth, adminAuth - Ensures only authenticated administrators can access this route.
 * @body {object} - Contains the email of the user to be deleted: { "email": "user@example.com" }.
 */
userRouter.delete("/api/user", userAuth, adminAuth, async(req,res)=> {
    // Extract the emailId from the request body.
    const emailId = req.body.email;
    try{
        // Find and delete a single user document by their email.
        const deleteUser = await User.findOneAndDelete({email:emailId});
        // If no user was found and deleted, send a 404 Not Found error.
        if (!deleteUser) {
            return sendErrorErrorResponse(res, 404, 'user with email Id not found');
        }
        // Send a success response if the user is deleted successfully.
        res.status(200).json({
            message:"user deleted succussfully",
            success:true,
        })
    }catch(err) {
        // If an error occurs during user deletion, send an error response.
        return sendErrorErrorResponse(res, 400, 'unable to delete the user', err)
    }
})

/**
 * @route PATCH /api/user
 * @description Updates an existing user's information.
 * @access Private (Admin Only) - Requires user authentication and admin privileges.
 * @middleware userAuth, adminAuth - Ensures only authenticated administrators can access this route.
 * @body {object} - Contains the user's email (for identification) and fields to update (e.g., { "email": "user@example.com", "firstName": "NewName" }).
 * Allowed update fields are: firstName, lastName, gender, age, phone, role.
 */
userRouter.patch("/api/user", userAuth, adminAuth, async(req,res)=>{
    // Get the data to update from the request body.
    const data = req.body;
    // Define an array of allowed fields that can be updated for a user.
    const ALLOWED_UPDATES = ["firstName","lastName","gender","age","phone","role"];
    // Check if all keys in the request body are present in the ALLOWED_UPDATES array.
    const isUpdateAllowed = Object.keys(data).every((k) =>
        ALLOWED_UPDATES.includes(k)
    );
    // If the request body contains any disallowed fields, send an error response.
    if(!isUpdateAllowed) {
        return sendErrorErrorResponse(res, 400, 'update not allowed',[]);
    }
    try{
        // Find a user by their email and update their information.
        // 'returnDocument: "after"' ensures the updated document is returned.
        // 'runValidators: true' ensures Mongoose schema validators are run on the updated fields.
       const user = await User.findOneAndUpdate({email:data.email}, data, {
        returnDocument: "after",
        runValidators:true
        });
        // If no user was found with the provided email, send a 404 Not Found error.
        if (!user) {
            return sendErrorErrorResponse(res, 404, 'user with email Id not found');
        }
        // Send a success response with the updated user data.
        res.status(200).json({
            message:"user updated succussfully",
            success:true,
            data: user
        })
    }catch(err) {
        // If an error occurs during user update, send an error response.
        return sendErrorErrorResponse(res, 400, 'unable to update the user', err)
    }
})

/**
 * @route POST /api/login
 * @description Authenticates a user and issues a JWT token upon successful login.
 * @access Public - Does not require authentication.
 * @body {object} - Contains user credentials: { "email": "user@example.com", "password": "yourpassword" }.
 */
userRouter.post("/api/login", async(req,res)=>{
    try {
        // Destructure email and password from the request body.
        const {password, email} = req.body;
        // Validate email format using the 'validator' library.
        if (!validator.isEmail(email)) {
             throw new Error("invalid mail id");
        }
        // Find a user in the database by their email.
        const userData = await User.findOne({email:email});
        // If no user is found with the given email, throw an error.
        if (!userData) {
           throw new Error("wrong credentials");
        }
        // Verify the provided password against the hashed password stored in the database.
        const isPasswordValid = await userData.verifyPassword(password);
        // If the password is valid:
        if (isPasswordValid) {
            // Generate a JSON Web Token (JWT) for the authenticated user.
            const token = await userData.getJWT();
            // Set the JWT as an HTTP-only cookie in the response.
            res.cookie("token", token );
            // Send a success response for login.
            res.status(200).json({
                success:true,
                message:"login successfull"
            })
        } else {
            // If the password is not valid, throw an error.
            throw new Error("wrong credentials");
        }
    }
    catch(err) {
        // If any error occurs during the login process, send an error response.
        return sendErrorErrorResponse(res, 400, 'login attempt failed', err)
    }
})

/**
 * @route GET /api/profile
 * @description Retrieves the profile data of the currently authenticated user.
 * @access Private - Requires user authentication.
 * @middleware userAuth - Ensures only authenticated users can access their profile.
 * @returns {object} - Contains the authenticated user's data (available via `req.user` from middleware).
 */
userRouter.get("/api/profile", userAuth, (req,res)=>{
    // Send a success response with the authenticated user's data.
    // The `req.user` object is populated by the `userAuth` middleware after successful token verification.
    res.json({
        success:true,
        data:req.user
    })
})

/**
 * @route PATCH /api/resetPassword
 * @description Allows an authenticated user to reset their password.
 * @access Private - Requires user authentication.
 * @middleware userAuth - Ensures only the authenticated user can change their own password.
 * @body {object} - Contains the new password: { "password": "new_secure_password" }.
 */
userRouter.patch("/api/resetPassword", userAuth, async(req,res)=>{
    try {
        // Extract the user's ID from the authenticated request object (set by `userAuth` middleware).
        user_id = req.user._id;
        // Find the user by ID and update their password.
        // `runValidators: true` ensures the password hashing/validation logic in the schema is applied.
        await User.findByIdAndUpdate(user_id,{password:req.body.password}, {
            runValidators:true
        });
        // Send a success response after the password is updated.
        res.status(200).json({
            success: true,
            message: "password updated successfully"
        })

    } catch(err) {
        // If an error occurs during password reset, send an error response.
        sendErrorErrorResponse(res, 400, 'reset password failed', err);
    }

})

/**
 * @route GET /api/logout
 * @description Logs out the user by clearing their authentication token cookie.
 * @access Public - Does not strictly require authentication to clear a cookie, but typically follows a login.
 */
userRouter.get("/api/logout", (req,res)=> {
    // Clear the 'token' cookie by setting its expiration to an immediate past date.
    res.cookie('token', null, {
        expires: new Date(Date.now()),
    }).send("logout successfully"); // Send a confirmation message.
})

// Export the userRouter to be used in other parts of the application (e.g., imported into app.js).
module.exports = userRouter;
