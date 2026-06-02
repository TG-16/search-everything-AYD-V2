const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { getUser, registerUser } = require("../models/userModel");

const register = async (req, res) => {
  // Implementation for user registration
  // ### validate input
  // ### check if user already exists
  // ### hash password
  // ### save user to database
  // ### generate JWT token
  // ### return response with user data and token
  // save the id to the memory with workspace related
  // save the limit and plan to the memory

  const { userName, email, password } = req.body;
  try {
    const existingUser = await getUser(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ status: false, message: "User already exist" });
    }

    const hashedPassword = await bcrypt.hash(password, 11);

    const registerdUser = await registerUser({
      userName,
      email,
      password: hashedPassword,
    });

    if (registerdUser) {
      const token = await jwt.sign(
        {
          userId: registerdUser.id,
        },
        process.env.JWT_SECRET_KEY,
        {
          expiresIn: "7d",
        },
      );
      //the message content should be changed to the appropriate datas
      return res
        .status(200)
        .json({ status: true, message: { message: "welcome", token } });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: false, message: "Server Error please try later" });
  }
};

const login = async (req, res) => {
  // Implementation for user login
  // ### validate input
  // ### check if user exists
  // ### compare passwords
  // ### generate JWT token
  // ### return response with user data and token
  // save the id to the memory with workspace related
  // save the limit and plan to the memory

  const { email, password } = req.body;

  try {
    const user = await getUser(email);

    if (!user) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid credintials" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid credintials" });
    }

    const token = await jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "7d",
      },
    );
    //the message content should be changed to the appropriate datas
    return res
      .status(200)
      .json({ status: true, message: { message: "welcome", token } });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: false, message: "Server Error please try later" });
  }
};

module.exports = {
  register,
  login,
};
