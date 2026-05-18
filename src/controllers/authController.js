import { db } from '../config/db.js';
import { ptMembers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { success, error } from '../utils/apiResponse.js';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

export const register = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    const existing = await db.select({ id: ptMembers.id }).from(ptMembers).where(eq(ptMembers.email, email));
    if (existing.length) return error(res, 'Email already registered', 409);

    const hashed = await bcrypt.hash(password, 12);
    const fullName = `${first_name} ${last_name}`.trim();

    const [result] = await db.insert(ptMembers).values({
      firstName: first_name,
      lastName: last_name,
      name: fullName,
      email,
      password: hashed,
    });

    const token = generateToken(result.insertId);
    return success(res, { token }, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const rows = await db.select().from(ptMembers).where(eq(ptMembers.email, email));
    if (!rows.length) return error(res, 'Invalid credentials', 401);

    const member = rows[0];
    const match = await bcrypt.compare(password, member.password);
    if (!match) return error(res, 'Invalid credentials', 401);

    const token = generateToken(member.id);
    return success(res, {
      token,
      name: member.name,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};
