const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
// Set up view engine and middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const { isValidObjectId } = require("mongoose");

// Route to render index page
app.get("/", (req, res) => {
  res.render("index");
});

// Route to render login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Route for user registration
app.post("/register", async (req, res) => {
  try {
    const { email, password, username, name, age } = req.body;

    // Check if user already exists
    let user = await userModel.findOne({ email });
    if (user) return res.status(400).send("User already registered");

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with hashed password
    user = await userModel.create({
      username,
      email,
      age,
      name,
      password: hashedPassword,
    });

    const token = JWT.sign({ email: email, userid: user._id }, "shhhh");
    res.cookie("token", token);
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Route for user login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send("Incorrect password");
    }

    const token = JWT.sign({ email: email, userid: user._id }, "shhhh");
    res.cookie("token", token);
    res.redirect("/profile");
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route for user logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send("You must be logged in");
  }

  try {
    const decoded = JWT.verify(token, "shhhh");
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error in token verification:", error);
    res.status(401).send("Invalid token");
  }
}

// Protected route for user profile
app.get("/profile", isLoggedIn, async (req, res) => {
  //   res.send(`Welcome ${req.user.email}`);
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
  res.render("profile", { user });
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");

  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();
  res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");

  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content },
    { new: true }
  );

  res.redirect("/profile");
});


app.get("/delete/:id", isLoggedIn, async (req, res) => {
    try {
        const postId = req.params.id;
        if (!isValidObjectId(postId)) {
            return res.status(400).send("Invalid post ID");
        }
        const deletedPost = await postModel.findByIdAndDelete(postId);
        if (!deletedPost) {
            return res.status(404).send("Post not found");
        }
        res.redirect("/profile");
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/post", isLoggedIn, async (req, res) => {
  //   res.send(`Welcome ${req.user.email}`);
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;
  let post = await postModel.create({
    user: user._id,
    // content: content,
    content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
