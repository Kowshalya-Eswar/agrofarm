require('dotenv').config();
const express = require("express");
const bcrypt = require("bcrypt");
const validator = require("validator");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = process.env.PORT || 7777;
const connectDB = require("./config/database");
const User = require("./models/user.js");
const ValidateRegisterData = require('./utils/validate');
const {userAuth, adminAuth} = require('./middleware/auth');
connectDB().then(()=>{
    console.log("database connection established");
}).catch(()=>{
    console.log("database not connected")
})
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.post("/api/user/register", async (req,res)=> {
    try {
        //validation of the data

        ValidateRegisterData(req);
        const {firstName, lastName, email, userName, age, password, phone, gender} = req.body;
        //encrypt the password
         const passwordHash = await bcrypt.hash(password,10);
        user  = new User({
            firstName, lastName, email, userName, password:passwordHash, age, phone, gender
        });

        await user.save();
        res.send({'message': "user added successfully"});
    } catch(err) {
        return sendErrorResponse(res, 400, 'failed to add user',err )
    }
})
/**
 * @route GET /api/users
 * @description Get a list of users with pagination, filtering, and sorting
 * @query page {number} - Page number (default: 1)
 * @query limit {number} - Number of items per page (default: 10, max: 100)
 * @query search {string} - Search term for username or email
 * @query sortBy {string} - Field to sort by (e.g., 'username', 'createdAt')
 * @query order {string} - Sort order ('asc' or 'desc', default: 'asc')
 */
app.get("/api/users", userAuth, adminAuth, async (req,res)=> {
    try {
        const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit),100);
        
        if (isNaN(pageNum) || pageNum < 1) {
            return sendErrorResponse(res, 400, 'Invalid page number. Must be a positive integer.');
        }
        if (isNaN(limitNum) || limitNum < 1) {
            return sendErrorResponse(res, 400, 'Invalid limit. Must be a positive integer.');
        }

        const queryFilter = {};
        if (search) {
            // Case-insensitive search on username or email
            queryFilter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (pageNum - 1) * limitNum;
         // Build sort options
        const sortOptions = {};
        const validSortFields = ['username', 'email', 'createdAt', 'updatedAt'];
        if (validSortFields.includes(sortBy)) {
            sortOptions[sortBy] = (order === 'desc' ? -1 : 1);
        } else {
            sortOptions['createdAt'] = -1;
            console.warn(`Invalid sortBy field: ${sortBy}. Defaulting to 'createdAt'.`);
        }
         const users = await User.find(queryFilter).sort(sortOptions).skip(skip).limit(limitNum).select('-__v'); // Exclude the Mongoose version key
         // Get total count for pagination metadata
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
          return sendErrorResponse(res, 400, 'failed to retrieve user',err )
    }
})

app.get("/api/user/:emailId", userAuth,adminAuth, async(req,res)=> {
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
         return sendErrorResponse(res, 400, 'failed to retrieve user',err )
    }
})

app.delete("/api/user", userAuth, adminAuth, async(req,res)=> {
    const emailId = req.body.email;
    try{
        const deleteUser = await User.findOneAndDelete({email:emailId});
        if (!deleteUser) {
            return sendErrorResponse(res, 404, 'user with email Id not found');
        }
        res.status(200).json({
            message:"user deleted succussfully",
            success:true,
        })
    }catch(err) {
        return sendErrorResponse(res, 400, 'unable to delete the user', err)
    }
})

app.patch("/api/user", userAuth, adminAuth, async(req,res)=>{
    const data = req.body;
    const ALLOWED_UPDATES = ["firstName","lastName","gender","age","phone","role"];
    const isUpdateAllowed = Object.keys(data).every((k) => 
        ALLOWED_UPDATES.includes(k)
    );
    if(!isUpdateAllowed) {
        return sendErrorResponse(res, 400, 'update not allowed',[]);
    }
    try{
       const user = await User.findOneAndUpdate({email:data.email}, data, {
        returnDocument: "after",
        runValidators:true
        });
        if (!user) {
            return sendErrorResponse(res, 404, 'user with email Id not found');
        }
        res.status(200).json({
            message:"user updated succussfully",
            success:true,
            data: user
        })
    }catch(err) {
        return sendErrorResponse(res, 400, 'unable to update the user', err)
    }
})

app.post("/api/login", async(req,res)=>{
    try {
        const {password, email} = req.body;
        if (!validator.isEmail(email)) {
             throw new Error("invalid mail id");
        }
        const userData = await User.findOne({email:email});
        if (!userData) {
           throw new Error("wrong credentials");
        }
        const isPasswordValid = await bcrypt.compare(password, userData.password)
        if (isPasswordValid) {
            const token = await jwt.sign({_id:userData._id},process.env.TOKEN_KEY, {expiresIn: "1d"})
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
        return sendErrorResponse(res, 400, 'login attempt failed', err)
    }
})

app.get("/api/profile", userAuth, (req,res)=>{
    res.json({
        success:true,
        data:req.user
    })
})
app.listen(PORT,()=>{
    console.log("server is start running")
});

// Helper function for sending consistent error responses
const sendErrorResponse = (res, statusCode, message, error = null) => {
    console.error(`Error ${statusCode}: ${message}`, error);
    res.status(statusCode).json({
        success: false,
        message: message,
        error: error ? error.message : null
    });
};