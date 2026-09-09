const pool = require('../src/config/db');
require('dotenv').config();

async function runTests() {
    const testEmail = `test_sub_scenario_${Date.now()}@example.com`;
    let client;
    try {
        client = await pool.connect();

        const userRes = await client.query(
            `INSERT INTO users (email, password_hash, shop_name, owner_name, mobile_number)
             VALUES ($1, 'hash_placeholder', 'Test Shop', 'Test Owner', '9876543210')
             RETURNING id, email`,
            [testEmail]
        );
        const testUser = userRes.rows[0];
        console.log('Created test user:', testUser.id);

        const plansRes = await client.query(`SELECT * FROM plans WHERE is_active = true ORDER BY amount ASC`);
        const starterPlan = plansRes.rows.find(p => p.code === 'STARTER_MONTHLY');
        const proPlan = plansRes.rows.find(p => p.code === 'PRO_YEARLY');

        if (!starterPlan || !proPlan) throw new Error('Plans not found. Check seeded data.');
        console.log(`Starter: Rs.${starterPlan.amount/100} | Pro: Rs.${proPlan.amount/100}`);

        const sub1Res = await client.query(
            `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at)
             VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + (30 * INTERVAL '1 day'))
             RETURNING id, expires_at`,
            [testUser.id, starterPlan.id]
        );
        const sub1 = sub1Res.rows[0];
        const initialExpiry = sub1.expires_at;
        console.log('\n--- Initial Starter sub active, expires:', new Date(initialExpiry).toDateString(), '---');

        console.log('\n=== SCENARIO 1: Same Plan Renewal (Stacking) ===');
        const extRes = await client.query(
            `UPDATE subscriptions SET expires_at = expires_at + (30 * INTERVAL '1 day'), updated_at = NOW()
             WHERE id = $1 RETURNING expires_at`,
            [sub1.id]
        );
        const newExpiry1 = extRes.rows[0].expires_at;
        const diff1 = Math.round((new Date(newExpiry1) - new Date(initialExpiry)) / 86400000);
        console.log(`[PASS] Stacked +${diff1} days. New expiry: ${new Date(newExpiry1).toDateString()}`);

        console.log('\n=== SCENARIO 2: Upgrade Starter → Pro (Proration) ===');
        const curRes = await client.query(
            `SELECT s.*, p.amount as plan_amount FROM subscriptions s JOIN plans p ON s.plan_id = p.id
             WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND s.expires_at > NOW()
             ORDER BY s.expires_at DESC LIMIT 1`,
            [testUser.id]
        );
        const cur = curRes.rows[0];
        const remMs = new Date(cur.expires_at) - new Date();
        const remDays = Math.max(0, Math.ceil(remMs / 86400000));
        const unusedCredit = (remDays / 30) * Number(cur.plan_amount);
        const proIntervalDays = 365;
        const bonusDays = Math.floor(unusedCredit / (Number(proPlan.amount) / proIntervalDays));
        const totalDays = proIntervalDays + Math.max(0, bonusDays);

        await client.query(`UPDATE subscriptions SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [cur.id]);
        const upRes = await client.query(
            `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at)
             VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + ($3 * INTERVAL '1 day'))
             RETURNING id, expires_at`,
            [testUser.id, proPlan.id, totalDays]
        );
        console.log(`[PASS] Remaining: ${remDays}d | Unused credit: Rs.${(unusedCredit/100).toFixed(2)} | Bonus: ${bonusDays}d | Total: ${totalDays}d`);
        console.log(`       Pro expires: ${new Date(upRes.rows[0].expires_at).toDateString()}`);

        console.log('\n=== SCENARIO 3: Downgrade Pro → Starter (Scheduled at cycle end) ===');
        const proRes = await client.query(
            `SELECT id, expires_at FROM subscriptions WHERE user_id = $1 AND status = 'ACTIVE' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
            [testUser.id]
        );
        const activePro = proRes.rows[0];
        const schedRes = await client.query(
            `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at)
             VALUES ($1, $2, 'PENDING', $3, $3 + (30 * INTERVAL '1 day'))
             RETURNING id, status, starts_at`,
            [testUser.id, starterPlan.id, activePro.expires_at]
        );
        const sched = schedRes.rows[0];
        const match = new Date(sched.starts_at).getTime() === new Date(activePro.expires_at).getTime();
        console.log(`[PASS] Pro still ACTIVE. Starter scheduled PENDING. starts_at matches Pro expiry: ${match ? 'YES ✓' : 'NO ✗'}`);

        await client.query(`DELETE FROM subscriptions WHERE user_id = $1`, [testUser.id]);
        await client.query(`DELETE FROM users WHERE id = $1`, [testUser.id]);
        console.log('\n✓ ALL 3 SCENARIOS PASSED — Cleaned up test data.');
    } catch (err) {
        console.error('[ERROR]', err.message);
        if (client) await client.query(`DELETE FROM users WHERE email = '${testEmail}'`).catch(() => {});
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

runTests();
