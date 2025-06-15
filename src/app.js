require('dotenv').config();
const express = require("express");
const userRouter = require("./routes/user");
const cookieParser = require("cookie-parser");
const app = express();
const PORT = process.env.PORT || 7777;
const connectDB = require("./config/database");
connectDB().then(()=>{
    console.log("database connection established");
}).catch(()=>{
    console.log("database not connected")
})
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use("/", userRouter);

app.listen(PORT,()=>{
    console.log("server is start running")
});
