export const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const wabaId = process.env.META_WABA_ID || process.env.VITE_META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;

    if (!wabaId || !accessToken) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Meta credentials (META_WABA_ID or META_ACCESS_TOKEN) in environment.' })
        };
    }

    try {
        const res = await fetch(`https://graph.facebook.com/v25.0/${wabaId}?fields=marketing_messages_onboarding_status`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await res.json();
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error fetching WABA status:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
