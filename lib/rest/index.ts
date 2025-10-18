export class RestClient {
    private _base_url: string;

    constructor(base_url: string) {
        this._base_url = base_url;
    }

    async get(url: string) {
        const response = await fetch(`${this._base_url}${url}`);
        return response.json();
    }

    async post(url: string, data: any) {
        const response = await fetch(`${this._base_url}${url}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
                const errorData = await response.json();
                if (errorData.error || errorData.message) {
                    errorMessage = errorData.error || errorData.message;
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                } else {
                    errorMessage = JSON.stringify(errorData);
                }
            } catch (jsonError) {
                try {
                    const textContent = await response.text();
                    if (textContent) {
                        errorMessage = textContent;
                    }
                } catch (textError) {
                    // Keep the default HTTP error message
                }
            }

            console.error(`API Error [${response.status}]:`, errorMessage);
            throw new Error(errorMessage);
        }

        return response.json();
    }
}

const restClient = new RestClient(process.env.NEXT_PUBLIC_API_URL!);

export default restClient;