const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const limitChecker = require("../middlewares/limitChecker.middleware");
const { getDashboardOverview } = require("../controllers/helper.controller");

router.post("/dashboard", auth, limitChecker, getDashboardOverview);


module.exports = router;
