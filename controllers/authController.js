const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  getUser,
  registerUser,
  updateUserPassword,
} = require("../models/userModel");
const sendResetLink = require("../utils/sendEmaill");

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

const resetPassword = async (req, res) => {
  // ### check if the user exist
  // ### sing the jwt with the old password
  // ### send an email with the jwt in attached with the reset link
  const { email } = req.body;

  try {
    const user = await getUser(email);

    if (!user) {
      return res.status(400).json({
        status: false,
        message:
          "If the user is valid you should recive a reset link to your email",
      });
    }

    const resetToken = await jwt.sign(
      { email },
      process.env.JWT_SECRET_KEY + user.password,
      { expiresIn: "11m" },
    );

    sendResetLink(email, resetToken).catch((error) => {
      console.error("Email delivery failed:", error);
    });

    return res.status(200).json({
      status: false,
      message:
        "If the user is valid you should recive a reset link to your email",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: false, message: "Server Error please try later" });
  }
};

const realResetPassword = async (req, res) => {
  // 1. Extract the token and the new password
  // Token can come from URL query parameters (?token=XYZ) or the request body
  const token = req.query.token || req.body.token;
  const { newPassword } = req.body;

  try {
    // 2. Decode the token WITHOUT verification first
    // We need to peek inside the payload to find the user's email
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.email) {
      return res.status(400).json({
        status: false,
        message: "Invalid or malformed reset token.",
      });
    }

    const email = decoded.email;

    // 3. Fetch the user from the database
    const user = await getUser(email);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User no longer exists.",
      });
    }

    // 4. Verify the token using the dynamic secret
    // If the password was already changed, user.password will be different,
    // and jwt.verify will instantly throw an error.
    try {
      jwt.verify(token, process.env.JWT_SECRET_KEY + user.password);
    } catch (jwtError) {
      return res.status(400).json({
        status: false,
        message:
          "This reset link is invalid, expired, or has already been used.",
      });
    }

    // 5. Hash the new password securely
    const hashedPassword = await bcrypt.hash(newPassword, 11);

    // 6. Update the password in your database
    // Replace this placeholder with your actual database update method
    await updateUserPassword(user.id, hashedPassword);

    // 7. Complete the request
    // Option A: If this is an API endpoint handling a frontend form submission (Recommended)
    return res.status(200).json({
      status: true,
      message: "Password has been successfully reset! You can now log in.",
    });

    /* // Option B: Optional Redirect to Login
    // If your backend directly handles the form submit and you want to bounce them to your login UI:
    return res.redirect("https://your-frontend-app.com/login?reset=success");
    */
  } catch (error) {
    console.error("Error during password reset execution:", error);
    return res.status(500).json({
      status: false,
      message: "Server error during password reset. Please try again later.",
    });
  }
};

module.exports = {
  register,
  login,
  resetPassword,
  realResetPassword,
};
