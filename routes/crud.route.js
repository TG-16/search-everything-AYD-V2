const express = require("express");
const router = express.Router();
const { workspace } = require("../controllers/crud.controller");
const registerValidation = require("../middlewares/validators/register.validator");

router.post("/register", workspace);

module.exports = router;
