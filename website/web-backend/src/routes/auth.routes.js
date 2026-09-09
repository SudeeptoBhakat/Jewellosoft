const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const {
    register,
    login,
    logout,
    getProfile,
    updateProfile
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/profile", authenticate, getProfile);
router.get("/me", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

module.exports = router;