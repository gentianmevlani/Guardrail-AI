import {
  json503AuthUnconfigured,
  resolveEmailPasswordAuthBackend,
} from "@/lib/auth-route-config";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    const backend = resolveEmailPasswordAuthBackend();

    if (backend.mode === "unconfigured") {
      return json503AuthUnconfigured(backend.devMessage);
    }

    if (backend.mode === "mock") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { success: false, error: "Please enter a valid email address" },
          { status: 400 },
        );
      }

      if (body.password.length < 6) {
        return NextResponse.json(
          { success: false, error: "Invalid password" },
          { status: 401 },
        );
      }

      if (
        body.email !== backend.mockEmail ||
        body.password !== backend.mockPassword
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid email or password" },
          { status: 401 },
        );
      }

      const mockUser = {
        id: `user_${Date.now()}`,
        email: body.email,
        name: body.email.split("@")[0],
        tier: "free",
        createdAt: new Date().toISOString(),
      };

      const sessionToken = Buffer.from(
        JSON.stringify({
          ...mockUser,
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      ).toString("base64");

      const res = NextResponse.json(
        {
          success: true,
          user: mockUser,
          message: "Login successful",
        },
        { status: 200 },
      );

      res.cookies.set("guardrail_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });

      return res;
    }

    const API_URL = backend.apiUrl;
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError: unknown) {
      const err = fetchError as Error;
      logger.error("Backend fetch error:", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to connect to authentication server. Please try again later.",
        },
        { status: 503 },
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      logger.error("Non-JSON response from backend:", {
        status: response.status,
        body: text.substring(0, 500),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Authentication server returned an invalid response",
        },
        { status: 502 },
      );
    }

    const data = await response.json();

    const res = NextResponse.json(data, { status: response.status });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      res.headers.set("Set-Cookie", setCookie);
    }

    const rememberMe = body.rememberMe || false;
    if (response.ok && data.success && rememberMe) {
      const cookies = res.cookies.getAll();
      cookies.forEach(cookie => {
        if (
          cookie.name === "refreshToken" ||
          cookie.name === "guardrail_session"
        ) {
          res.cookies.set(cookie.name, cookie.value, {
            ...cookie,
            maxAge: 30 * 24 * 60 * 60,
          });
        }
      });
    }

    return res;
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
