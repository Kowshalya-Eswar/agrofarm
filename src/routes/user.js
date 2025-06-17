const express = require("express")
const userRouter = express.Router();
const sendErrorErrorResponse = require("../utils/sendErrorResponse");
const validator = require("validator");
const User = require("../models/user.js");
const ValidateRegisterData = require('../utils/validate');
const {userAuth, adminAuth} = require('../middleware/auth');

/**
 * @route POST /api/user/register
 * @description Handles user registration, creating a new user in the database.
 * @access Public (though a `userAuth` middleware is typically used for protected routes, it's not here for registration).
 * @body {object} - Contains user details: firstName, lastName, email, userName, age, password, phone, gender.
 */
userRouter.post("/api/user/register", async (req,res)=> {
    try {
        ValidateRegisterData(req);
        const {firstName, lastName, email, userName, age, password, phone, gender, role} = req.body;
        user = new User({
            firstName, lastName, email, userName, password, age, phone, gender, role
        });
        await user.save();
        res.status(200).json({
            message: "user added successfully",
            success: true
        });
    } catch(err) {
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
 * @access Private (Admin Only) - Requires user authentication and admin privileges.
 * @middleware userAuth, adminAuth - Ensures only authenticated administrators can access this route.
 * @param {string} emailId - The email address of the user to retrieve (from URL parameters).
 */
userRouter.get("/api/user/:emailId", userAuth,adminAuth, async(req,res)=> {
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
 * @access Private (Admin Only) - Requires user authentication and admin privileges.
 * @middleware userAuth, adminAuth - Ensures only authenticated administrators can access this route.
 * @body {object} - Contains the user's email (for identification) and fields to update (e.g., { "email": "user@example.com", "firstName": "NewName" }).
 * Allowed update fields are: firstName, lastName, gender, age, phone, role.
 */
userRouter.patch("/api/user", userAuth, adminAuth, async(req,res)=>{
    const data = req.body;
    const ALLOWED_UPDATES = ["firstName","lastName","gender","age","phone","role"];
    const isUpdateAllowed = Object.keys(data).every((k) =>
        ALLOWED_UPDATES.includes(k)
    );
    if(!isUpdateAllowed) {
        return sendErrorErrorResponse(res, 400, 'update not allowed',[]);
    }
    try{
       const user = await User.findOneAndUpdate({email:data.email}, data, {
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
userRouter.post("/api/login", async(req,res)=>{
    try {
        const {password, email} = req.body;
        if (!validator.isEmail(email)) {
             throw new Error("invalid mail id");
        }
        const userData = await User.findOne({email:email});
        if (!userData) {
           throw new Error("wrong credentials");
        }
        const isPasswordValid = await userData.verifyPassword(password);
        if (isPasswordValid) {
            const token = await userData.getJWT();
            res.cookie("token", token );
            res.status(200).json({
                success:true,
                message:"login successfull"
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
