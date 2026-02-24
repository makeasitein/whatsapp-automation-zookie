export const handler = async (event, context) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Read environment variables (without the VITE_ prefix on the backend)
    // We check for both VITE_ and non-VITE_ just in case they haven't been renamed yet
    const wabaId = process.env.META_WABA_ID || process.env.VITE_META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;

    if (!wabaId || !accessToken) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Meta credentials (META_WABA_ID or META_ACCESS_TOKEN) in Netlify environment variables.' })
        };
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v23.0/${wabaId}/message_templates?fields=name,status,components,language,category`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error fetching templates:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
