//jshint esversion:6

require('dotenv').config();
const express = require ("express");
const bodyParser = require ("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const findOrCreate = require("mongoose-findorcreate")
//const encrypt = require("mongoose-encryption"); //encrypts when you call save() decrypts when you call find()
//const md5 = require("md5"); // uses hash functions, dropped when starting to use bcrypt
//const bcrypt = require("bcrypt"); // salting and hash functions
//const saltRounds = 10; // times salt is added to password
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose"); //passport plugin, easy to build username and password login
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const FacebookStrategy = require( 'passport-facebook' ).Strategy;

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "alittlesecret.",
    resave: false, //forces session to be saved to session store, even if it was not modified during request
    saveUninitialized: false //forces uninitialized (new but unmodified) session to be saved to store
})); //initialize passport after this
app.use(passport.initialize()); // initialize passport
app.use(passport.session()); // use passport to setup session, SESSION = time client spends with server

// Connect to mongoDB database ------------------------------------------------------
mongoose.connect("mongodb://0.0.0.0:27017/userDB", {useNewUrlParser: true});
//mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({ //db schema
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose); //used to hash and salt passwords + put in db
userSchema.plugin(findOrCreate);

//const secret = "Thisisourlittlesecret."; // |, now .env, used to encrypt db
//userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password'], excludeFromEncryption: ['email']}); // BEFORE CREATING MONGOOSE MODEL, removed when using hash f and md5

const User = new mongoose.model("User", userSchema) //user module ("name of collection", used schema)

passport.use(User.createStrategy());
passport.serializeUser(function(User, done) {
    done(null, User);
  }); //creates cookie and stores data - usrname, password
passport.deserializeUser(function(User, done) {
    done(null, User);
  }); //crumble cookie, see data inside

passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets", //what I used in the google app
    passReqToCallback   : true
  },
  function (request, accessToken, refreshToken, profile, done) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));
passport.use(new FacebookStrategy({
    clientID:     process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

// GET requests for main pages - login, register and home. -----------------------------
// not rendering secrets page unless user is logged in, so no get for this route
app.get("/", function (req, res){
    res.render("home");
});

app.get('/auth/google', //use google strategy
  passport.authenticate('google', { scope:
      [ 'email', 'profile' ] }
));
app.get('/auth/facebook', //use google strategy
  passport.authenticate('facebook', { scope:
      [ 'email', 'profile' ] }
));

app.get( '/auth/google/secrets',
    passport.authenticate( 'google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
}));
app.get( '/auth/facebook/secrets',
passport.authenticate( 'facebook', { failureRedirect: '/login' }),
function(req, res) {
  res.redirect('/secrets');
});

app.get("/login", function (req, res){
    res.render("login");
});


app.get("/register", function (req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    if (req.isAuthenticated()) {
        User.find({"secret": {$ne: null}}, function(err, foundUsers){
            if (err) {
                console.log(err);
            } else {
                if (foundUsers) {
                    res.render("secrets", {usersWithSecrets: foundUsers});
                };
            };
        });
    } else {
        res.redirect("/login");
    };
});

app.get("/logout", function(req, res){
    req.logout(function(err) {
        if (err) { 
            console.log(err); 
        } else {
            res.redirect('/');
        }
      });
});

app.get("/submit", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})
// ---------------------------------------------------------------------------

// POST requests --------------------------------------------------------------
app.post("/register", function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        };
    });
   /* bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
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
    });*/ //emptied after using passport
});

app.post("/login", passport.authenticate("local"), function(req, res){
    res.redirect("/secrets");
    /*const username = req.body.username; //require user and password used by client
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
    });*/ //emptied after using passport
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;

    console.log(req.user._id.toString());

    User.findById(req.user._id.toString(), function(err, foundUser){
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets");
                });
            };
        };
    });
})
// ----------------------------------------------------------------------------


// listen for server
app.listen(3000, function(){
    console.log("Server started on port 3000");
});