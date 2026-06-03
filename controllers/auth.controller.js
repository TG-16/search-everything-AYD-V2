const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto"); 

const {
  getUser,
  registerUser,
  updateUserPassword,
} = require("../models/user.model");
const sendResetLink = require("../utils/sendEmaill");

// Initialize Google OAuth Client with Secret and Redirect URL
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL,
);

// =========================================================
// STEP 1: Redirect the user to Google's Consent Screen
// =========================================================
const initiateGoogleAuth = (req, res) => {
  // Generate the URL the user needs to visit to log in with Google
  const url = googleClient.generateAuthUrl({
    access_type: "offline", // Gives you a refresh token if you need it later
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile", // To get their name
      "https://www.googleapis.com/auth/userinfo.email", // To identify them
    ],
  });

  // Send the user directly to Google
  return res.redirect(url);
};

// =========================================================
// STEP 2: Handle the Callback from Google
// =========================================================
const handleGoogleCallback = async (req, res) => {
  // Google appends a ?code=XYZ query parameter to this URL
  const { code } = req.query;

  if (!code) {
    return res
      .status(400)
      .json({ status: false, message: "Authorization code missing" });
  }

  try {
    // Exchange the temporary code for access and ID tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Verify the ID token contained in the response to get user details
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { name, email } = payload;

    // Check if user exists, if not register them
    let user = await getUser(email);

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 11);

      user = await registerUser({
        userName: name,
        email,
        password: hashedPassword,
        auth_provider: "google"
      });
    }

    // Generate your application's regular session JWT token
    const appToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

    // CRITICAL: Because this is a browser redirect, you cannot send a JSON response.
    // Instead, redirect the user back to your frontend dashboard/login page
    // and pass your app's token via a query parameter.
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth-success?token=${appToken}&name=${name}`,
    );
  } catch (error) {
    console.error("Google Callback Error:", error);
    // Redirect to frontend error page if something breaks
    //******************************************************
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
    );
  }
};

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
      auth_provider: "local"
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
  initiateGoogleAuth,
  handleGoogleCallback,
  register,
  login,
  resetPassword,
  realResetPassword,
};
