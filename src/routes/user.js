const express = require("express")
const userRouter = express.Router();
const sendErrorErrorResponse = require("../utils/sendErrorResponse");
const validator = require("validator");
const User = require("../models/user.js");
const ValidateRegisterData = require('../utils/validate');
const {userAuth, adminAuth} = require('../middleware/auth');
const { loginLimiter, signupLimiter } = require("../middleware/rateLimit");
const sendEmail = require("../utils/sendEmail")

/**
 * @route POST /api/user/register
 * @description Handles user registration, creating a new user in the database.
 * @access Public (though a `userAuth` middleware is typically used for protected routes, it's not here for registration).
 * @body {object} - Contains user details: firstName, lastName, email, userName, age, password, phone, gender.
 */
userRouter.post("/api/user/register", signupLimiter, async (req,res)=> {
    try {
        ValidateRegisterData(req);
        const {firstName, lastName, email, userName, age, password, phone, gender, role} = req.body;
        user = new User({
            firstName, lastName, email, userName, password, age, phone, gender, role
        });
        await user.save();
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
                .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #777; font-size: 0.9em; }
                .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Cocofields!</h1>
                </div>
                <div class="content">
                    <p>Hello ${userName},</p>
                    <p>Welcome to the Cocofields family! We're thrilled to have you join us.</p>
                    <p>Your account has been successfully created. You can now explore our wide range of products and enjoy a seamless shopping experience.</p>

                    <p>Start shopping now:</p>
                    <p style="text-align: center;">
                        <a href="https://www.cocofields.in" class="button">Go to Cocofields</a>
                    </p>

                    <p>If you have any questions, please don't hesitate to contact our support team at <a href="mailto:support@cocofields.in">support@cocofields.in</a>.</p>
                    <p>Happy Shopping!</p>
                    <p>The Cocofields Team</p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Cocofields. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        const mailStatus = await sendEmail.run('Welcome to Cocofields!', emailHtmlBody);
        console.log(mailStatus);
        res.status(200).json({
            message: "user added successfully",
            success: true
        });
    } catch(err) {
           // --- Enhanced Error Handling for Registration ---
        let customMessage = 'failed to add user';
        let statusCode = 400; // Default to Bad Request

        if (err.code === 11000) { // Duplicate key error (e.g., unique index violation)
            // Extract the duplicated field from the error message
            const field = Object.keys(err.keyValue)[0];
            customMessage = `${field.charAt(0).toUpperCase() + field.slice(1)} '${err.keyValue[field]}' is already registered.`;
            statusCode = 409; // Conflict
        } else if (err.name === 'ValidationError') { // Mongoose validation errors
            // Collect all validation error messages
            const errors = Object.keys(err.errors).map(key => err.errors[key].message);
            customMessage = `Validation failed: ${errors.join('; ')}`;
            statusCode = 400;
        } else {
             // Handle errors thrown by ValidateRegisterData utility
            if (err.message.includes("Firstname or Lastname should be present")) {
                customMessage = err.message;
                statusCode = 400;
            }
             // Fallback for other unexpected errors
             customMessage = err.message || customMessage;
             statusCode = 500; // Internal Server Error for unhandled cases
        }

        // Send an error response with the custom message and appropriate status code.
        return sendErrorErrorResponse(res, statusCode, customMessage, err);
    }
})

/**
 * @route GET /api/users
 * @description Retrieves a list of users with optional pagination, filtering, and sorting.
 * @access Private (Admin Only) - Requires user authentication privilages.
 * @middleware userAuth - Ensures only authenticated administrators can access this route.
 * @query page {number} - The page number for pagination (default: 1).
 * @query limit {number} - The number of items per page (default: 10, maximum: 100).
 * @query search {string} - A search term to filter users by username or email (case-insensitive).
 * @query sortBy {string} - The field to sort the results by (e.g., 'username', 'createdAt').
 * @query order {string} - The sort order, 'asc' for ascending or 'desc' for descending (default: 'desc').
 */
userRouter.get("/api/users", userAuth, async (req,res)=> {
    try {
        const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit),100);

        if (isNaN(pageNum) || pageNum < 1) {
            return sendErrorErrorResponse(res, 400, 'Invalid page number. Must be a positive integer.');
        }
        if (isNaN(limitNum) || limitNum < 1) {
            return sendErrorErrorResponse(res, 400, 'Invalid limit. Must be a positive integer.');
        }

        const queryFilter = {};
        if (search) {
            queryFilter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (pageNum - 1) * limitNum;
        const sortOptions = {};
        const validSortFields = ['username', 'email', 'createdAt', 'updatedAt'];
        if (validSortFields.includes(sortBy)) {
            sortOptions[sortBy] = (order === 'desc' ? -1 : 1);
        } else {
            sortOptions['createdAt'] = -1;
            console.warn(`Invalid sortBy field: ${sortBy}. Defaulting to 'createdAt'.`);
        }
        const users = await User.find(queryFilter).sort(sortOptions).skip(skip).limit(limitNum).select('-__v');
        const totalUsers = await User.countDocuments(queryFilter);
        const totalPages = Math.ceil(totalUsers / limitNum);
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
        return sendErrorErrorResponse(res, 400, 'failed to retrieve user',err )
    }
})

/**
 * @route GET /api/user/:emailId
 * @description Retrieves a single user by their email address.
 * @access Private - Requires user authentication privilege.
 * @middleware userAuth - Ensures only authenticated users can access this route.
 * @param {string} emailId - The email address of the user to retrieve (from URL parameters).
 */
userRouter.get("/api/user/:emailId", userAuth, async(req,res)=> {
    const {emailId} = req.params;
    try{
        user = await User.find({email: emailId}).select('-__v');
        res.status(200).json({
            data: user,
            success: true,
            message:"user retrieved successfully"
            }
        )
    } catch(err) {
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
    const emailId = req.body.email;
    try{
        const deleteUser = await User.findOneAndDelete({email:emailId});
        if (!deleteUser) {
            return sendErrorErrorResponse(res, 404, 'user with email Id not found');
        }
        res.status(200).json({
            message:"user deleted succussfully",
            success:true,
        })
    }catch(err) {
        return sendErrorErrorResponse(res, 400, 'unable to delete the user', err)
    }
})

/**
 * @route PATCH /api/user
 * @description Updates an existing user's information.
 * @access Private - Requires user authentication privilege.
 * @middleware userAuth - Ensures only authenticated administrators can access this route.
 * @body {object} - Contains the user's email (for identification) and fields to update (e.g., { "email": "user@example.com", "firstName": "NewName" }).
 * Allowed update fields are: firstName, lastName, gender, age, phone, role.
 */
userRouter.patch("/api/user", userAuth, async(req,res)=>{
    const data = req.body;
    const ALLOWED_UPDATES = ["firstName","lastName","gender","age","phone","role"];
    const isUpdateAllowed = Object.keys(data).every((k) =>
        ALLOWED_UPDATES.includes(k)
    );
    if(!isUpdateAllowed) {
        return sendErrorErrorResponse(res, 400, 'update not allowed',[]);
    }
    try{
       const user = await User.findOneAndUpdate({email:req.user.email}, data, {
        returnDocument: "after",
        runValidators:true
        });
        if (!user) {
            return sendErrorErrorResponse(res, 404, 'user with email Id not found');
        }
        res.status(200).json({
            message:"user updated succussfully",
            success:true,
            data: user
        })
    }catch(err) {
        return sendErrorErrorResponse(res, 400, 'unable to update the user', err)
    }
})

/**
 * @route POST /api/login
 * @description Authenticates a user and issues a JWT token upon successful login.
 * @access Public - Does not require authentication.
 * @body {object} - Contains user credentials: { "email": "user@example.com", "password": "yourpassword" }.
 */
userRouter.post("/api/login", loginLimiter, async(req,res)=>{
    try {
        const {password, email} = req.body;
        if (!validator.isEmail(email)) {
             throw new Error("invalid mail id");
        }
        const userData = await User.findOne({email:email});
         // Destructure userData to exclude the password before sending to the client
        const { password: _password, ...userWithoutPassword } = userData.toObject(); // .toObject() converts Mongoose document to plain JS object

        if (!userData) {
           throw new Error("wrong credentials");
        }
        const isPasswordValid = await userData.verifyPassword(password);
        if (isPasswordValid) {
            const token = await userData.getJWT();
            res.cookie("token", token );
            res.status(200).json({
                success:true,
                message:"login successfull",
                data : userWithoutPassword
            })
        } else {
            throw new Error("wrong credentials");
        }
    }
    catch(err) {
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
        user_id = req.user._id;
        await User.findByIdAndUpdate(user_id,{password:req.body.password}, {
            runValidators:true
        });
        res.status(200).json({
            success: true,
            message: "password updated successfully"
        })

    } catch(err) {
        sendErrorErrorResponse(res, 400, 'reset password failed', err);
    }

})

/**
 * @route GET /api/logout
 * @description Logs out the user by clearing their authentication token cookie.
 * @access Public - Does not strictly require authentication to clear a cookie, but typically follows a login.
 */
userRouter.get("/api/logout", (req,res)=> {
    res.cookie('token', null, {
        expires: new Date(Date.now()),
    }).send("logout successfully");
})

module.exports = userRouter;
