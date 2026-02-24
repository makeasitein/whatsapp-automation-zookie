export const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;

    if (!keyId) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Razorpay Key ID in environment.' })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ key: keyId })
    };
};
