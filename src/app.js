const express = require("express");

const app = express();
const PORT = process.env.PORT || 7777;
const connectDB = require("./config/database");
const User = require("./models/user.js");
const { ReturnDocument } = require("mongodb");
connectDB().then(()=>{
    console.log("database connection established");
}).catch(()=>{
    console.log("database not connected")
})
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.post("/api/user/register", async (req,res)=> {
    const user  = new User(req.body);
    try {
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
app.get("/api/users", async (req,res)=> {
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

app.get("/api/user/:emailId", async(req,res)=> {
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

app.delete("/api/user", async(req,res)=> {
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

app.patch("/api/user", async(req,res)=>{
    const data = req.body;
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
app.listen(7777,()=>{
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