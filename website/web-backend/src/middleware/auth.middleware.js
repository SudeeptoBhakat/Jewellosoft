const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
    try {
        let token = req.cookies ? req.cookies.token : null;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const secret = process.env.JWT_SECRET || process.env.SUPABASE_LEGACY_JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = authenticate;