import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

const BCRYPT_ROUNDS = 10;

/** JWT payload must contain only `userId`. */
interface AccessTokenPayload {
  userId: string;
}

export interface AuthUserPublic {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { userId };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null || !("userId" in decoded)) {
      throw new HttpError(401, "Unauthorized", "INVALID_TOKEN");
    }
    const userId = (decoded as Record<string, unknown>).userId;
    if (typeof userId !== "string" || userId.length === 0) {
      throw new HttpError(401, "Unauthorized", "INVALID_TOKEN");
    }
    return { userId };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Unauthorized", "INVALID_TOKEN");
  }
}

function toPublicUser(row: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AuthUserPublic {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function register(input: RegisterInput): Promise<{ user: AuthUserPublic }> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        passwordHash,
        name: input.name.trim(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { user: toPublicUser(user) };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "Email already registered", "EMAIL_EXISTS");
    }
    throw e;
  }
}

export async function login(
  input: LoginInput
): Promise<{ token: string; user: Pick<AuthUserPublic, "id" | "email"> }> {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  let valid = false;
  if (user) {
    valid = await comparePassword(input.password, user.passwordHash);
  }

  if (!user || !valid) {
    throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const token = signAccessToken(user.id);
  return {
    token,
    user: { id: user.id, email: user.email },
  };
}

export async function getUserById(userId: string): Promise<AuthUserPublic> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found", "USER_NOT_FOUND");
  }

  return toPublicUser(user);
}
