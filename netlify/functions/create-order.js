import Razorpay from 'razorpay';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const rzp = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
            key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
        });

        const options = {
            amount: 99900, // Rs 999
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await rzp.orders.create(options);

        return {
            statusCode: 200,
            body: JSON.stringify(order)
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
