//jshint esversion:6

require('dotenv').config();
const express = require ("express");
const bodyParser = require ("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
//const encrypt = require("mongoose-encryption"); //encrypts when you call save() decrypts when you call find()
//const md5 = require("md5"); // uses hash functions, dropped when starting to use bcrypt
const bcrypt = require("bcrypt"); // salting and hash functions
const saltRounds = 10; // times salt is added to password

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

// Connect to mongoDB database
mongoose.connect("mongodb://0.0.0.0:27017/userDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema({ //db schema
    email: String,
    password: String
});

//const secret = "Thisisourlittlesecret."; // |, now .env, used to encrypt db
//userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password'], excludeFromEncryption: ['email']}); // BEFORE CREATING MONGOOSE MODEL, removed when using hash f and md5

const User = new mongoose.model("User", userSchema) //user module ("name of collection", used schema)


// GET requests for main pages - login, register and home. -----------------------------
// not rendering secrets page unless user is logged in, so no get for this route
app.get("/", function (req, res){
    res.render("home");
});

app.get("/login", function (req, res){
    res.render("login");
});

app.get("/register", function (req, res){
    res.render("register");
});
// ---------------------------------------------------------------------------

// POST requests --------------------------------------------------------------
app.post("/register", function(req, res){

    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        const newUser = new User({ //create new user when they register using form
            email: req.body.username, //from their input name attributes
            password: hash
        });
        newUser.save(function(err) {  //check to see if errors during save process
            if (err) {
                console.log(err);
            } else {
                res.render("secrets"); //if no errors render secrets page
            };
        });
    });
});

app.post("/login", function(req, res){
    const username = req.body.username; //require user and password used by client
    const password = req.body.password;

    User.findOne({email: username}, function (err, foundUser) { // check to see if we have an email = username
        if (err) {
            console.log(err);
        } else {
            if (foundUser) { //check to see if we found a user w/ that email
                //if (foundUser.password === password) { //check if passwords match
                //    res.render("secrets"); //then render secrets page
                //};      used password      for tested user
                bcrypt.compare(password, foundUser.password, function(err, result) {
                    if (result === true) { // result = comparison btw passw and foundUser.passw
                        res.render("secrets");
                    };
                });
            };
        };
    });
});
// ----------------------------------------------------------------------------


// listen for server
app.listen(3000, function(){
    console.log("Server started on port 3000");
});