import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"; // Ensure this is set in the environment variables
const JWT_EXPIRATION = "30d"; // JWT expiration time

export async function POST(req) {
  const { username, password } = await req.json();
  const ipAddress = req.headers.get("x-forwarded-for") || req.ip || "unknown"; // Get user's IP address

  // Fetch record for this IP
  const failedAttempt = await prisma.failedLoginAttempt.findUnique({
    where: { ipAddress },
  });

  // If the IP is blocked
  if (failedAttempt && failedAttempt.blockedUntil && new Date() < failedAttempt.blockedUntil) {
    return NextResponse.json(
      { message: "Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin." },
      { status: 429 }
    );
  }

  // Fetch the admin user from the database
  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  // Check if the admin exists and is active
  if (!admin || !admin.active) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  // Compare the provided password with the hashed password in the database
  const passwordMatch = await bcrypt.compare(password, admin.password);

  if (passwordMatch) {
    // Reset failed attempts on successful login
    if (failedAttempt) {
      await prisma.failedLoginAttempt.delete({
        where: { ipAddress },
      });
    }

    // Extract permissions from the admin object
    const {
      canViewCustomers, canEditCustomers, canViewServices, canEditServices,
      canViewAdmins, canEditAdmins,
      canSeePasswords, canViewPhysicalProducts, canEditPhysicalProducts
    } = admin;

    // Create a JWT token with permissions
    const token = jwt.sign(
      {
        username: admin.username,
        name: admin.name,
        id: admin.id,
        permissions: {
          canViewCustomers, canEditCustomers, canViewServices, canEditServices,
          canViewAdmins, canEditAdmins,
          canSeePasswords, canViewPhysicalProducts, canEditPhysicalProducts
        }
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    return NextResponse.json({
      message: "Başarılı giriş",
      token,
    });
  }

  // Handle invalid login attempt
  if (failedAttempt) {
    let newAttempts = failedAttempt.attempts + 1;
    let blockTime = null;

    // If max attempts exceeded, block for a duration
    if (newAttempts >= MAX_ATTEMPTS) {
      blockTime = new Date(Date.now() + BLOCK_DURATION);
    }

    await prisma.failedLoginAttempt.update({
      where: { ipAddress },
      data: {
        attempts: newAttempts,
        blockedUntil: blockTime,
      },
    });
  } else {
    // First failed attempt from this IP
    await prisma.failedLoginAttempt.create({
      data: {
        ipAddress,
        attempts: 1,
      },
    });
  }

  return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
}
