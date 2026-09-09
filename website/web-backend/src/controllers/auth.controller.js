const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.SUPABASE_LEGACY_JWT_SECRET;
};

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    };
};

const register = async (req, res) => {
    try {
        const {
            email,
            password,
            shop_name,
            owner_name,
            mobile_number
        } = req.body;

        if (!email || !password || !shop_name || !owner_name) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const userResult = await client.query(
                `
                INSERT INTO users
                    (email, password_hash, profile_type)
                VALUES
                    ($1, $2, 'TENANT')
                RETURNING id, email, is_active, profile_type, created_at, updated_at
                `,
                [normalizedEmail, passwordHash]
            );

            const user = userResult.rows[0];

            const profileResult = await client.query(
                `
                INSERT INTO profiles
                    (user_id, shop_name, owner_name, mobile_number)
                VALUES
                    ($1, $2, $3, $4)
                RETURNING id, shop_name, owner_name, mobile_number, created_at, updated_at
                `,
                [user.id, shop_name.trim(), owner_name.trim(), mobile_number ? mobile_number.trim() : null]
            );

            const profile = profileResult.rows[0];

            await client.query("COMMIT");

            const accessToken = jwt.sign(
                {
                    sub: user.id,
                    type: user.profile_type
                },
                getJwtSecret(),
                {
                    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
                }
            );

            res.cookie("token", accessToken, getCookieOptions());

            return res.status(201).json({
                success: true,
                message: "Account created successfully",
                access_token: accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    profile_type: user.profile_type,
                    shop_name: profile.shop_name,
                    owner_name: profile.owner_name,
                    mobile_number: profile.mobile_number,
                    created_at: profile.created_at,
                    updated_at: profile.updated_at
                }
            });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const result = await pool.query(
            `
            SELECT
                u.id,
                u.email,
                u.password_hash,
                u.is_active,
                u.profile_type,
                u.created_at,
                p.shop_name,
                p.owner_name,
                p.mobile_number,
                p.updated_at
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE u.email = $1
            `,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const accessToken = jwt.sign(
            {
                sub: user.id,
                type: user.profile_type
            },
            getJwtSecret(),
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "7d"
            }
        );

        res.cookie("token", accessToken, getCookieOptions());

        return res.status(200).json({
            success: true,
            message: "Login successful",
            access_token: accessToken,
            user: {
                id: user.id,
                email: user.email,
                profile_type: user.profile_type,
                shop_name: user.shop_name,
                owner_name: user.owner_name,
                mobile_number: user.mobile_number,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.sub;

        const result = await pool.query(
            `
            SELECT
                u.id,
                u.email,
                u.profile_type,
                u.is_active,
                u.created_at,
                p.shop_name,
                p.owner_name,
                p.mobile_number,
                p.updated_at
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE u.id = $1
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.rows[0];

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                profile_type: user.profile_type,
                is_active: user.is_active,
                shop_name: user.shop_name,
                owner_name: user.owner_name,
                mobile_number: user.mobile_number,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { shop_name, owner_name, mobile_number } = req.body;

        const existingProfile = await pool.query(
            "SELECT id FROM profiles WHERE user_id = $1",
            [userId]
        );

        if (existingProfile.rows.length === 0) {
            await pool.query(
                `
                INSERT INTO profiles (user_id, shop_name, owner_name, mobile_number, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                `,
                [userId, shop_name || "", owner_name || "", mobile_number || ""]
            );
        } else {
            await pool.query(
                `
                UPDATE profiles
                SET
                    shop_name = COALESCE($1, shop_name),
                    owner_name = COALESCE($2, owner_name),
                    mobile_number = COALESCE($3, mobile_number),
                    updated_at = NOW()
                WHERE user_id = $4
                `,
                [
                    shop_name !== undefined ? shop_name.trim() : null,
                    owner_name !== undefined ? owner_name.trim() : null,
                    mobile_number !== undefined ? mobile_number.trim() : null,
                    userId
                ]
            );
        }

        const result = await pool.query(
            `
            SELECT
                u.id,
                u.email,
                u.profile_type,
                u.is_active,
                u.created_at,
                p.shop_name,
                p.owner_name,
                p.mobile_number,
                p.updated_at
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE u.id = $1
            `,
            [userId]
        );

        const updatedUser = result.rows[0];

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                profile_type: updatedUser.profile_type,
                is_active: updatedUser.is_active,
                shop_name: updatedUser.shop_name,
                owner_name: updatedUser.owner_name,
                mobile_number: updatedUser.mobile_number,
                created_at: updatedUser.created_at,
                updated_at: updatedUser.updated_at
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const logout = async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === "production";
        res.clearCookie("token", {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax"
        });

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    updateProfile
};