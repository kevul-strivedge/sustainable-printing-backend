import { db } from '../config/db.js';
import { ptMembers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
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

    const now = new Date();
    const [result] = await db.insert(ptMembers).values({
      firstName: first_name,
      lastName: last_name,
      name: fullName,
      email,
      password: hashed,
      status: 'Pending',
      contactType: 'sustainableprintingco',
      // NOT NULL columns with no DEFAULT in the actual table
      invoiceBusinessname: '',
      invoiceFirstName: '',
      invoiceLastName: '',
      invoiceAddress: '',
      invoiceSuburb: '',
      invoiceState: '',
      invoicePostcode: '',
      invoiceEmail: '',
      invoicePhone: '',
      invoiceMobile: '',
      passwordToken: '',
      rememberToken: '',
      // updatedAt DEFAULT '0000-00-00 00:00:00' is rejected by NO_ZERO_DATE strict mode
      updatedAt: now,
    });

    const token = generateToken(result.insertId);
    return success(res, { token }, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: ptMembers.id,
        firstName: ptMembers.firstName,
        lastName: ptMembers.lastName,
        businessname: ptMembers.businessname,
        address: ptMembers.address,
        suburb: ptMembers.suburb,
        state: ptMembers.state,
        postcode: ptMembers.postcode,
        email: ptMembers.email,
        notes: ptMembers.notes,
        phone: ptMembers.phone,
        mobile: ptMembers.mobile,
        businessTypeId: ptMembers.businessTypeId,
        heardFromId: ptMembers.heardFromId,
      })
      .from(ptMembers)
      .where(eq(ptMembers.id, req.user.id));

    if (!rows.length) return error(res, 'User not found', 404);

    const member = rows[0];

    const [businessTypes] = await db.execute(
      sql`SELECT id, business_type_name AS name FROM pt_business_types ORDER BY id`
    );
    const [heardFromList] = await db.execute(
      sql`SELECT id, heard_from_name AS name FROM pt_heard_from ORDER BY id`
    );

    return success(res, {
      ...member,
      website: member.notes ?? '',
      businessTypes,
      heardFromList,
    });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const {
      firstName, lastName, businessname, address, suburb,
      state, postcode, website, phone, mobile,
      businessTypeId, heardFromId,
    } = req.body;

    if (!firstName || !lastName || !businessname || !address || !suburb || !postcode) {
      return error(res, 'Required fields are missing', 400);
    }

    await db
      .update(ptMembers)
      .set({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        businessname,
        address,
        suburb,
        state: state ?? '',
        postcode,
        notes: website ?? '',
        phone: phone ?? '',
        mobile: mobile ?? '',
        businessTypeId: businessTypeId ? Number(businessTypeId) : null,
        heardFromId: heardFromId ? Number(heardFromId) : null,
        updatedAt: new Date(),
      })
      .where(eq(ptMembers.id, req.user.id));

    return success(res, null, 'Profile updated successfully');
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

    // Block accounts the Laravel admin has explicitly disabled.
    // Pending/Confirmed/Active all stay login-able (matches Laravel behaviour).
    if (member.status === 'Suspended') {
      return error(res, 'This account has been suspended. Please contact support.', 403);
    }

    // Opportunistic rehash: when a Laravel-era `$2y$10$…` (or our older `$2a$10$…`)
    // hash compares successfully, silently rewrite it with our current cost-12 format.
    // Each user transparently upgrades on their next login. Failure here must NEVER
    // block login — wrap in try/catch and swallow.
    if (member.password.startsWith('$2y$') || member.password.startsWith('$2a$10$')) {
      try {
        const upgraded = await bcrypt.hash(password, 12);
        await db.update(ptMembers).set({ password: upgraded }).where(eq(ptMembers.id, member.id));
      } catch { /* best-effort upgrade — ignore failures */ }
    }

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
