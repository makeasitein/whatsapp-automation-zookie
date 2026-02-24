export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Read environment variables (without the VITE_ prefix on the backend)
    const phoneId = process.env.META_PHONE_ID || process.env.VITE_META_PHONE_ID;
    const accessToken = process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;

    if (!phoneId || !accessToken) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Meta credentials (META_PHONE_ID or META_ACCESS_TOKEN) in Netlify environment variables.' })
        };
    }

    try {
        // Parse the incoming request payload from the frontend
        const payload = JSON.parse(event.body);

        const response = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error sending message:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
