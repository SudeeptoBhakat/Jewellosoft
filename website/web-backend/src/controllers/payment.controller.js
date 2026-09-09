const crypto = require("crypto");
const pool = require("../config/db");
const razorpay = require("../config/razorpay");

const getPlans = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                id,
                code,
                name,
                amount,
                currency,
                billing_interval,
                billing_count,
                features
            FROM plans
            WHERE is_active = true
            ORDER BY amount ASC
            `
        );

        return res.status(200).json({
            success: true,
            plans: result.rows
        });
    } catch (error) {
        console.error("Get plans error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const createOrder = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { plan_id } = req.body;

        if (!plan_id) {
            return res.status(400).json({
                success: false,
                message: "Plan ID is required"
            });
        }

        const planResult = await pool.query(
            "SELECT * FROM plans WHERE id = $1 AND is_active = true",
            [plan_id]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Plan not found or inactive"
            });
        }

        const plan = planResult.rows[0];
        const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        let rzpOrder;
        try {
            rzpOrder = await razorpay.orders.create({
                amount: parseInt(plan.amount, 10),
                currency: plan.currency,
                receipt: receipt.substring(0, 40),
                notes: {
                    user_id: userId,
                    plan_id: plan.id
                }
            });
        } catch (gatewayError) {
            console.error("Razorpay order creation error:", gatewayError);
            return res.status(502).json({
                success: false,
                message: "Payment gateway communication failed",
                error: gatewayError.error?.description || gatewayError.message
            });
        }

        const orderResult = await pool.query(
            `
            INSERT INTO orders (user_id, plan_id, amount, currency, status, gateway_order_id)
            VALUES ($1, $2, $3, $4, 'CREATED', $5)
            RETURNING id, user_id, plan_id, amount, currency, status, gateway_order_id, created_at
            `,
            [userId, plan.id, plan.amount, plan.currency, rzpOrder.id]
        );

        return res.status(201).json({
            success: true,
            order: orderResult.rows[0],
            gateway_order_id: rzpOrder.id,
            key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
            plan: {
                id: plan.id,
                name: plan.name,
                amount: plan.amount,
                currency: plan.currency,
                billing_interval: plan.billing_interval
            }
        });
    } catch (error) {
        console.error("Create order error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            order_id,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing payment verification parameters"
            });
        }

        const secret = process.env.RAZORPAY_KEY_SECRET;
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            await pool.query(
                "UPDATE orders SET status = 'FAILED', updated_at = NOW() WHERE id = $1",
                [order_id]
            );
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature"
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const orderResult = await client.query(
                "SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE",
                [order_id, userId]
            );

            if (orderResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            const order = orderResult.rows[0];

            const planResult = await client.query(
                "SELECT * FROM plans WHERE id = $1",
                [order.plan_id]
            );

            const plan = planResult.rows[0];

            await client.query(
                "UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = $1",
                [order.id]
            );

            let paymentMethod = req.body.method || null;
            try {
                const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
                if (paymentDetails && paymentDetails.method) {
                    paymentMethod = paymentDetails.method;
                }
            } catch {
                if (!paymentMethod) {
                    paymentMethod = "ONLINE";
                }
            }

            await client.query(
                `
                INSERT INTO payments (order_id, user_id, amount, currency, status, gateway, gateway_payment_id, method, paid_at)
                VALUES ($1, $2, $3, $4, 'SUCCESS', 'RAZORPAY', $5, $6, NOW())
                ON CONFLICT (gateway_payment_id) DO UPDATE
                SET method = EXCLUDED.method, status = 'SUCCESS', paid_at = NOW()
                `,
                [order.id, userId, order.amount, order.currency, razorpay_payment_id, paymentMethod]
            );

            let intervalDays = 30;
            if (plan.billing_interval === "DAY") intervalDays = 1 * plan.billing_count;
            else if (plan.billing_interval === "WEEK") intervalDays = 7 * plan.billing_count;
            else if (plan.billing_interval === "MONTH") intervalDays = 30 * plan.billing_count;
            else if (plan.billing_interval === "YEAR") intervalDays = 365 * plan.billing_count;

            const activeSubQuery = await client.query(
                `
                SELECT
                    s.id,
                    s.plan_id,
                    s.status,
                    s.starts_at,
                    s.expires_at,
                    p.amount as plan_amount,
                    p.billing_interval as plan_billing_interval,
                    p.billing_count as plan_billing_count
                FROM subscriptions s
                JOIN plans p ON s.plan_id = p.id
                WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND s.expires_at > NOW()
                ORDER BY s.expires_at DESC
                LIMIT 1
                FOR UPDATE
                `,
                [userId]
            );

            let subResult;
            let actionMessage = "Subscription activated";

            if (activeSubQuery.rows.length === 0) {
                subResult = await client.query(
                    `
                    INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at)
                    VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + ($3 * INTERVAL '1 day'))
                    RETURNING id, user_id, plan_id, status, starts_at, expires_at
                    `,
                    [userId, plan.id, intervalDays]
                );
            } else {
                const currentSub = activeSubQuery.rows[0];

                if (currentSub.plan_id === plan.id) {
                    actionMessage = "Subscription renewed and extended";
                    subResult = await client.query(
                        `
                        UPDATE subscriptions
                        SET expires_at = expires_at + ($1 * INTERVAL '1 day'), updated_at = NOW()
                        WHERE id = $2
                        RETURNING id, user_id, plan_id, status, starts_at, expires_at
                        `,
                        [intervalDays, currentSub.id]
                    );
                } else if (Number(plan.amount) > Number(currentSub.plan_amount)) {
                    actionMessage = "Subscription upgraded with remaining credit prorated";
                    let currentCycleDays = 30;
                    if (currentSub.plan_billing_interval === "DAY") currentCycleDays = 1 * currentSub.plan_billing_count;
                    else if (currentSub.plan_billing_interval === "WEEK") currentCycleDays = 7 * currentSub.plan_billing_count;
                    else if (currentSub.plan_billing_interval === "MONTH") currentCycleDays = 30 * currentSub.plan_billing_count;
                    else if (currentSub.plan_billing_interval === "YEAR") currentCycleDays = 365 * currentSub.plan_billing_count;

                    const remainingMs = new Date(currentSub.expires_at) - new Date();
                    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
                    const unusedCredit = (remainingDays / currentCycleDays) * Number(currentSub.plan_amount);
                    const newDailyRate = Number(plan.amount) / intervalDays;
                    const bonusDays = Math.floor(unusedCredit / newDailyRate);
                    const totalDays = intervalDays + Math.max(0, bonusDays);

                    await client.query(
                        `
                        UPDATE subscriptions
                        SET status = 'CANCELLED', updated_at = NOW()
                        WHERE id = $1
                        `,
                        [currentSub.id]
                    );

                    subResult = await client.query(
                        `
                        INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at)
                        VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + ($3 * INTERVAL '1 day'))
                        RETURNING id, user_id, plan_id, status, starts_at, expires_at
                        `,
                        [userId, plan.id, totalDays]
                    );
                } else {
                    actionMessage = "Plan change scheduled for the end of your current cycle";
                    await client.query(
                        `
                        UPDATE subscriptions
                        SET status = 'CANCELLED', updated_at = NOW()
                        WHERE user_id = $1 AND status = 'PENDING'
                        `,
                        [userId]
                    );

                    subResult = await client.query(
                        `
                        INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at)
                        VALUES ($1, $2, 'PENDING', $3, $3 + ($4 * INTERVAL '1 day'))
                        RETURNING id, user_id, plan_id, status, starts_at, expires_at
                        `,
                        [userId, plan.id, currentSub.expires_at, intervalDays]
                    );
                }
            }

            const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

            await client.query(
                `
                INSERT INTO invoices (user_id, order_id, invoice_number, amount, currency, status, issued_at)
                VALUES ($1, $2, $3, $4, $5, 'ISSUED', NOW())
                `,
                [userId, order.id, invoiceNumber, order.amount, order.currency]
            );

            await client.query("COMMIT");

            return res.status(200).json({
                success: true,
                message: actionMessage,
                subscription: subResult.rows[0]
            });
        } catch (txError) {
            await client.query("ROLLBACK");
            throw txError;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Verify payment error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getUserSubscription = async (req, res) => {
    try {
        const userId = req.user.sub;

        await pool.query(
            `
            UPDATE subscriptions
            SET status = 'EXPIRED', updated_at = NOW()
            WHERE user_id = $1 AND status = 'ACTIVE' AND expires_at <= NOW()
            `,
            [userId]
        );

        await pool.query(
            `
            UPDATE subscriptions
            SET status = 'ACTIVE', updated_at = NOW()
            WHERE user_id = $1 AND status = 'PENDING' AND starts_at <= NOW() AND expires_at > NOW()
            `,
            [userId]
        );

        const subResult = await pool.query(
            `
            SELECT
                s.id,
                s.status,
                s.starts_at,
                s.expires_at,
                p.id as plan_id,
                p.code as plan_code,
                p.name as plan_name,
                p.amount as plan_amount,
                p.currency,
                p.billing_interval,
                p.features
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND s.expires_at > NOW()
            ORDER BY s.expires_at DESC
            LIMIT 1
            `,
            [userId]
        );

        const pendingSubResult = await pool.query(
            `
            SELECT
                s.id,
                s.status,
                s.starts_at,
                s.expires_at,
                p.id as plan_id,
                p.code as plan_code,
                p.name as plan_name,
                p.amount as plan_amount,
                p.currency,
                p.billing_interval
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = $1 AND s.status = 'PENDING' AND s.starts_at >= NOW()
            ORDER BY s.starts_at ASC
            LIMIT 1
            `,
            [userId]
        );

        const invoicesResult = await pool.query(
            `
            SELECT
                i.id,
                i.invoice_number,
                i.amount,
                i.currency,
                i.status,
                i.issued_at,
                p.method as payment_method
            FROM invoices i
            LEFT JOIN payments p ON i.order_id = p.order_id
            WHERE i.user_id = $1
            ORDER BY i.issued_at DESC
            LIMIT 15
            `,
            [userId]
        );

        return res.status(200).json({
            success: true,
            subscription: subResult.rows[0] || null,
            scheduled_subscription: pendingSubResult.rows[0] || null,
            invoices: invoicesResult.rows
        });
    } catch (error) {
        console.error("Get user subscription error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "placeholder_webhook_secret";

        if (signature) {
            const hmac = crypto.createHmac("sha256", webhookSecret);
            hmac.update(JSON.stringify(req.body));
            const expectedSignature = hmac.digest("hex");

            if (signature !== expectedSignature) {
                return res.status(400).json({ success: false, message: "Invalid webhook signature" });
            }
        }

        const event = req.body;
        const eventId = event?.payload?.payment?.entity?.id || event?.id || `evt_${Date.now()}`;
        const eventType = event?.event || "unknown";

        await pool.query(
            `
            INSERT INTO webhook_events (provider, event_id, event_type, payload, processed_at)
            VALUES ('RAZORPAY', $1, $2, $3, NOW())
            ON CONFLICT (provider, event_id) DO NOTHING
            `,
            [eventId, eventType, JSON.stringify(event)]
        );

        const paymentEntity = event?.payload?.payment?.entity;
        if (paymentEntity && paymentEntity.id && paymentEntity.method) {
            await pool.query(
                `
                UPDATE payments
                SET method = $1, updated_at = NOW()
                WHERE gateway_payment_id = $2
                `,
                [paymentEntity.method, paymentEntity.id]
            );
        }

        return res.status(200).json({ success: true, message: "Webhook processed" });
    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    getPlans,
    createOrder,
    verifyPayment,
    getUserSubscription,
    handleWebhook
};
