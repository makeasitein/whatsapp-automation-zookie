const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = JSON.parse(event.body);

        const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid payment signature" }) };
        }

        // Initialize Supabase admin client to bypass RLS and update profile
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'dummy_url',
            process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key'
        );

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ payment_status: true })
            .eq('id', userId);

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Payment verified successfully." })
        };
    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
