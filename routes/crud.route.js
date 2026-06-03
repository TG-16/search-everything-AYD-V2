const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const limitChecker = require("../middlewares/limitChecker.middleware");
const { workspace } = require("../controllers/crud.controller");
const registerValidation = require("../middlewares/validators/register.validator");

router.post("/createWorkspace", auth, limitChecker, workspace);

module.exports = router;
