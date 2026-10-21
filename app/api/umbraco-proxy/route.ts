import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
    }

    // Get headers from the request
    const xsrfToken = request.headers.get('x-umb-xsrf-token');
    const cookieHeader = request.headers.get('x-umb-cookie');

    if (!xsrfToken) {
        return NextResponse.json({ error: 'XSRF token is required' }, { status: 400 });
    }

    try {
        const response = await fetch(
            `https://gncmenu.com/umbraco/backoffice/UmbracoApi/Media/GetById?id=${encodeURIComponent(id)}`,
            {
                method: 'GET',
                headers: {
                    "X-UMB-XSRF-TOKEN": xsrfToken,
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/plain, */*",
                    "Cookie": cookieHeader || '',
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Umbraco API error: ${response.status}`, details: errorText },
                { status: response.status }
            );
        }

        // 1. Get the response as text first
        const rawText = await response.text();

        // 2. Remove the AngularJS/Umbraco security prefix: )]}',
        const cleanJson = rawText.replace(/^\)\]\}',\n/, "");

        try {
            // 3. Parse the cleaned string
            const data = JSON.parse(cleanJson);
            return NextResponse.json(data);
        } catch (parseError) {
            // Fallback if the response wasn't actually prefixed or is malformed
            console.error("JSON Parse Error:", parseError);
            return NextResponse.json({ error: "Invalid JSON response", raw: rawText }, { status: 500 });
        }
    } catch (error) {
        console.error('Proxy errorXXXX:', error);
        return NextResponse.json(
            { error: 'Failed to fetch from Umbraco API', details: error.message },
            { status: 500 }
        );
    }
}