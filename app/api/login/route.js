import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { checkAdminCredentials } from "@/lib/admin-auth";
import { PERMISSION_FIELDS } from "@/lib/jwt";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = "30d"; // JWT expiration time

export async function POST(req) {
  // Never sign tokens with a guessable fallback secret
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not configured");
    return NextResponse.json({ message: "Sunucu yapılandırma hatası" }, { status: 500 });
  }

  const { username, password } = await req.json();
  const result = await checkAdminCredentials(req, username, password);

  if (result.status === "blocked") {
    return NextResponse.json(
      { message: "Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin." },
      { status: 429 }
    );
  }

  if (result.status !== "ok") {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const { admin } = result;

  // Permissions in the token are informational; API routes reload them from the database (lib/jwt.js)
  const token = jwt.sign(
    {
      username: admin.username,
      name: admin.name,
      id: admin.id,
      permissions: Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, admin[field]])),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );

  return NextResponse.json({
    message: "Başarılı giriş",
    token,
  });
}
