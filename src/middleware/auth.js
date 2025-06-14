const jwt = require("jsonwebtoken");
const User = require("../models/user");
const userAuth = async(req,res,next) =>  {
    try {
        //Read the token from the req cookies
        const { token } = req.cookies;
        if (!token) {
             throw new Error("user not found");
        }
        const decodedToken = await jwt.verify(token, process.env.TOKEN_KEY);
        const {_id} = decodedToken;
        const user = await User.findById(_id);
        if (!user) {
            throw new Error("user not found");
        }
        
        req.user = user;
        next();
    } catch(err) {
        res.status(400).send("ERROR:"+err.message)
    }
}

const adminAuth = async(req,res,next) =>{
    if (!req.user.role.includes('admin')) {
        res.status(400).send("ERROR: user has no privilages to this operation")
    } else {
        next();
    }
}

module.exports = {userAuth, adminAuth}