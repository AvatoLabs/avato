// MinkHub Mobile API Client (Phase 1 Placeholder)

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3010/api';

/**
 * Basic fetch client wrapper to interact with MinkHub Web API
 */
export const fetchMinkHubApi = async (endpoint: string, options?: RequestInit) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[API Error]', endpoint, error);
        throw error;
    }
};

/**
 * Chat Services
 */
export const chatService = {
    getSessions: () => fetchMinkHubApi('/trpc/session.getSessions'),
    getMessages: (sessionId: string) => fetchMinkHubApi(`/trpc/message.getMessages?input={"sessionId":"${sessionId}"}`),
    sendMessage: (sessionId: string, text: string) =>
        fetchMinkHubApi('/chat/completions', { // Assuming proxy route or direct API
            method: 'POST',
            body: JSON.stringify({
                messages: [{ role: 'user', content: text }],
                sessionId,
            }),
        }),
};
