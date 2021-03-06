const router = require("express").Router();
const crypto = require("crypto");
const userDB = require("../Database/Users.schema");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");
const {
  usernameCheck,
  emailCheck,
  passwordCheck,
} = require("../middlewares/validators");

//helpers or shared logic
function checkErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const sentErrors = {};
    for (let error in errors.mapped()) {
      sentErrors[error] = errors.mapped()[error].msg;
    }
    return res.status(400).send(sentErrors);
  }
}
function isSignedAlready(req, res) {
  console.log(" A route has been called");
  const accesstoken = req.headers["accesstoken"];
  if (accesstoken) {
    try {
      const verified = jwt.verify(accesstoken, process.env.JWT_SECRET_KEY);
      res.status(400).send("You are already signed in");
      return;
    } catch (err) {}
  }
}
function hashPass(data) {
  const hash = crypto.createHmac("sha256", process.env.HASH_SECRET_KEY);
  const hashedPassword = hash.update(data.password).digest("hex");
  data.password = hashedPassword;
}

//Routes
//sign-up
router.post(
  "/sign-up",
  usernameCheck(),
  emailCheck(),
  passwordCheck(),
  async (req, res) => {
    checkErrors(req, res);
    //check if the user already is signed in (logged in)
    isSignedAlready(req, res);
    //get the data of the user
    const data = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    };

    //hash the password
    hashPass(data);
    //save the user data to the database
    userDB
      .findOne({ $or: [{ username: data.username }, { email: data.email }] })
      .then((user) => {
        if (user) {
          return res.send("User already exists With that email or username");
        } else {
          userDB.create({ ...data, id: uuidv4() }).then((user) => {
            return res.send("You have been Registered");
          });
        }
      });
  }
);

//POST Route =>Sign in
router.post(
  "/sign-in",
  usernameCheck(),
  emailCheck(),
  passwordCheck(),
  async (req, res) => {
    checkErrors(req, res);
    //check if the user already is signed in (logged in)
    isSignedAlready(req, res);
    //get the data of the user
    const data = {
      email: req.body.email,
      password: req.body.password,
    };
    //hash the password
    hashPass(data);
    //save the user data to the database
    userDB.findOne({ email: data.email }).then((user) => {
      if (user) {
        if (user.password === data.password) {
          const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, {
            expiresIn: 3600,
          });
          return res.json({ accessToken: token });
        } else {
          res.status(400).send("Password is Wrong !!!!");
        }
      } else {
        return res.send(
          "There is no user with that email, Make sure it is the right email or Sign up to our website"
        );
      }
    });
  }
);

//PUT Route => Edit user's data , user is being found using his json web token
router.put(
  "/edit",
  usernameCheck(),
  emailCheck(),
  passwordCheck(),
  async (req, res) => {
    checkErrors(req, res);
    const accesstoken = req.headers["accesstoken"]; // so we can get the accesstoken differently

    if (accesstoken) {
      try {
        const verified = jwt.verify(accesstoken, process.env.JWT_SECRET_KEY);
        const data = req.body;
        //hash the password
        hashPass(data);
        userDB
          .findOneAndUpdate({ id: verified?.id }, data)
          .then((updatedUser) => {
            return res
              .status(200)
              .send("User data has been successfully updated");
          });
      } catch (err) {
        return res
          .status(400)
          .send("You session has been expired, Login again please.");
      }
    } else {
      return res
        .status(400)
        .send("You session has been expired, Login again please.");
    }
  }
);

//Delete route => Delete user, user is being found using his json web token
router.delete("/delete", async (req, res) => {
  const accesstoken = req.headers["accesstoken"];
  if (accesstoken) {
    try {
      const verified = jwt.verify(accesstoken, process.env.JWT_SECRET_KEY);
      await userDB.deleteOne({ username: verified.username });
      return;
    } catch (err) {
      return res.status(400).send("Error trying to delete user");
    }
  }
});

//Get route => All users
router.get("/users", (req, res) => {
  const accesstoken = req.headers["accesstoken"];
  if (accesstoken) {
    try {
      const verified = jwt.verify(accesstoken, process.env.JWT_SECRET_KEY);
      const users = await userDB.find({}).select({ username: 1 });
      return res.status(200).send(users);
    } catch (err) {
      return res.status(400).send("Couldn't get users");
    }
  }
});

module.exports = router;
