"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide-react";
import { BeatLoader } from "react-spinners"; // Import BeatLoader
import { authManager } from "@/lib/auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showSlowMessage, setShowSlowMessage] = useState(false);
    const router = useRouter();
    const usernameInputRef = useRef(null);

    useEffect(() => {
        // Auto-focus the username input when component mounts
        if (usernameInputRef.current) {
            usernameInputRef.current.focus();
        }
        
        // Clear any existing tokens when on login page
        authManager.clearTokens();
    }, []);

    const toggleVisibility = () => setIsVisible(!isVisible);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(""); // Reset any previous errors
        setIsLoading(true); // Start loading
        setShowSlowMessage(false); // Reset slow message

        // Show "taking longer than expected" message after 3 seconds
        const slowMessageTimeout = setTimeout(() => {
            setShowSlowMessage(true);
        }, 3000);

        try {
            console.log("Starting login request..."); // Debug log
            
            // Add timeout to the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
                signal: controller.signal
            });

            clearTimeout(timeoutId); // Clear timeout if request completes
            clearTimeout(slowMessageTimeout); // Clear slow message timeout
            console.log("Login response status:", response.status); // Debug log

            const result = await response.json();
            console.log("Login result:", result); // Debug log

            if (response.ok) {
                // Store token in both localStorage and cookie for consistency
                localStorage.setItem("token", result.token);
                
                // Check if we're on HTTPS to determine if we should use secure cookies
                const isSecure = window.location.protocol === 'https:';
                document.cookie = `token=${result.token}; path=/; max-age=2592000; samesite=strict${isSecure ? '; secure' : ''}`;
                
                // Reset the auth manager's redirection flag
                authManager.isRedirecting = false;
                
                // Stop loading before redirect
                setIsLoading(false);
                setShowSlowMessage(false);
                
                router.push("/");
            } else {
                setIsLoading(false); // Stop loading
                setShowSlowMessage(false);
                if (response.status === 429) {
                    setError("Too many failed attempts. Try again later.");
                } else {
                    setError(result.message || "Invalid username or password");
                }
            }
        } catch (err) {
            console.error("Login error:", err); // Debug log
            setIsLoading(false); // Stop loading
            setShowSlowMessage(false);
            clearTimeout(slowMessageTimeout); // Clear slow message timeout
            
            if (err.name === 'AbortError') {
                setError("Login request timed out. Please check your connection and try again.");
            } else if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
                setError("Network error. Please check your connection and try again.");
            } else {
                setError("Something went wrong. Please try again.");
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Giriş
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                ref={usernameInputRef}
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <Input
                                type={isVisible ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                type="button"
                                onClick={toggleVisibility}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                aria-label="toggle password visibility"
                            >
                                {isVisible ? (
                                    <EyeOff className="h-4 w-4 mb-3.5" />
                                ) : (
                                    <Eye className="h-4 w-4 mb-3.5" />
                                )}
                            </button>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {showSlowMessage && isLoading && (
                            <Alert>
                                <AlertDescription>
                                    This is taking longer than expected. Please wait...
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 flex items-center justify-center"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <BeatLoader color="#ffffff" size={10} /> // Use BeatLoader
                            ) : (
                                "Giriş Yap"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}