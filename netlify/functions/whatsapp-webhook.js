const crypto = require('crypto');

exports.handler = async (event, context) => {
    // META WEBHOOK VERIFICATION (GET request)
    if (event.httpMethod === 'GET') {
        const queryParams = event.queryStringParameters;

        // You should set this secret in your Netlify Environment Variables
        const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'my_secure_webhook_token';

        const mode = queryParams['hub.mode'];
        const token = queryParams['hub.verify_token'];
        const challenge = queryParams['hub.challenge'];

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('Webhook verified!');
            // Meta expects the challenge to be returned as an integer, not JSON
            return {
                statusCode: 200,
                body: challenge,
            };
        } else {
            return {
                statusCode: 403,
                body: 'Forbidden',
            };
        }
    }

    // META WEBHOOK EVENT HANDLING (POST request)
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);

            // Verify this is an event from the WhatsApp Business Account
            if (body.object === 'whatsapp_business_account') {

                // Loop through all entries and changes
                body.entry.forEach(entry => {
                    entry.changes.forEach(change => {
                        if (change.value.messages) {
                            // Handle incoming messages
                            change.value.messages.forEach(message => {
                                if (message.type === 'button') {
                                    // Example: User clicked a Quick Reply button
                                    console.log(`Button clicked! Target: ${message.button.text}, From: ${message.from}`);
                                }
                            });
                        }

                        // Check for Message Status updates (Read, Delivered, Sent, Failed)
                        // Marketing API click tracking also arrives here!
                        if (change.value.statuses) {
                            change.value.statuses.forEach(status => {

                                // Track standard statuses
                                console.log(`Message ID: ${status.id} is now ${status.status} for ${status.recipient_id}`);

                                // Track "clicked" events for Marketing Messages URL buttons!
                                // Meta sends status.status === 'clicked' and includes tracking metrics.
                                if (status.status === 'clicked') {
                                    console.log('URL CLICK EVENT DETECTED!');
                                    // You can optionally save this to your Supabase Database using the 
                                    // '@supabase/supabase-js' client and your SUPABASE_SERVICE_ROLE_KEY to track analytics!
                                }
                            });
                        }
                    });
                });

                // Always return a 200 OK to Meta to acknowledge receipt, otherwise they retry repeatedly
                return {
                    statusCode: 200,
                    body: 'EVENT_RECEIVED',
                };
            } else {
                return {
                    statusCode: 404,
                    body: 'Not Found',
                };
            }
        } catch (err) {
            console.error('Webhook Error:', err);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: err.message }),
            };
        }
    }

    return {
        statusCode: 405,
        body: 'Method Not Allowed',
    };
};
