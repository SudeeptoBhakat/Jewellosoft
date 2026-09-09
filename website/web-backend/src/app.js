const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes.js");
const paymentRoutes = require("./routes/payment.routes.js");

const app = express();

app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL;

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, origin || true);
            }
            return callback(null, origin || true);
        },
        credentials: true
    })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/v1/health", (req, res) => {
    res.json({
        success: true,
        message: "Jewellosoft web API running"
    });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/payment", paymentRoutes);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;