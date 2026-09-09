const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const {
    getPlans,
    createOrder,
    verifyPayment,
    getUserSubscription,
    handleWebhook
} = require("../controllers/payment.controller");

const router = express.Router();

router.get("/plans", getPlans);
router.post("/create-order", authenticate, createOrder);
router.post("/verify-payment", authenticate, verifyPayment);
router.get("/subscription", authenticate, getUserSubscription);
router.post("/webhook", handleWebhook);

module.exports = router;
